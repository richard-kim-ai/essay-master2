import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  COURSE_TYPES,
  isLearnerAccount,
  parseCourseTypeFromUserTag,
  type CourseType,
} from "@shared/course";
import {
  calculateAge,
  GUARDIAN_CONSENT_VERSION,
  GUARDIAN_RELATIONS,
} from "@shared/guardian";
import * as db from "./db";
import {
  createVerificationToken,
  hashVerificationToken,
  sendGuardianConsentEmail,
} from "./email";
import { clearGuardianStatusCache } from "./_core/trpc";

const GUARDIAN_CONSENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The request contract used by auth.chooseLearningCourse.  Relationship values
 * deliberately come from shared/guardian so this endpoint and the consent UI
 * cannot drift from the consent ledger's vocabulary.
 */
export const chooseLearningCourseInput = z.object({
  courseType: z.enum(COURSE_TYPES),
  birthDate: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "생년월일은 YYYY-MM-DD 형식으로 입력해 주세요."
    )
    .optional(),
  guardian: z
    .object({
      name: z.string().trim().min(2).max(40),
      email: z
        .string()
        .trim()
        .email()
        .transform(value => value.toLowerCase()),
      relation: z.enum(GUARDIAN_RELATIONS),
    })
    .optional(),
});

export type ChooseLearningCourseInput = z.infer<
  typeof chooseLearningCourseInput
>;

export type EnrollmentUser = {
  id: number;
  role: string;
  tag?: string | null;
  name?: string | null;
  email?: string | null;
};

export type ChooseLearningCourseResult = {
  courseType: CourseType;
  requiresGuardianConsent: boolean;
  guardianEmailSent: boolean;
};

function forbiddenLearnerSelection(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "학습자 계정만 학습 과정을 선택할 수 있습니다.",
  });
}

function alreadySelected(): never {
  throw new TRPCError({
    code: "CONFLICT",
    message:
      "이미 선택한 과정이 있습니다. 과정 변경은 관리자에게 문의해 주세요.",
  });
}

function normalizedEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function guardianConsentUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/guardian-consent?token=${encodeURIComponent(token)}`;
}

/**
 * Persist a learner's one-time explicit course choice.
 *
 * The initial DB reread prevents a stale session from being treated as current
 * authority. `selectUserCourse` then repeats the same checks inside a locked
 * transaction, atomically creating a pending guardian-consent record (when
 * necessary) before changing the user tag. Mail is intentionally delivered
 * only after that transaction commits; a failed delivery leaves a resendable
 * pending record rather than an orphaned selection state.
 */
export async function chooseLearningCourse(
  user: EnrollmentUser,
  rawInput: ChooseLearningCourseInput,
  origin: string
): Promise<ChooseLearningCourseResult> {
  const input = chooseLearningCourseInput.parse(rawInput);

  // Do not trust the session snapshot for authorization or selected-course
  // status. A role/tag could have changed since the session was issued.
  if (!isLearnerAccount(user)) forbiddenLearnerSelection();
  if (parseCourseTypeFromUserTag(user.tag)) alreadySelected();

  const current = await db.getUserById(user.id);
  if (!current || !isLearnerAccount(current)) forbiddenLearnerSelection();
  if (parseCourseTypeFromUserTag(current.tag)) alreadySelected();

  if (input.courseType !== "elementary") {
    // selectUserCourse locks the user row and conditionally updates only an
    // unselected learner, so two simultaneous choices cannot both succeed.
    await db.selectUserCourse(current.id, input.courseType);
    clearGuardianStatusCache(current.id);
    return {
      courseType: input.courseType,
      requiresGuardianConsent: false,
      guardianEmailSent: false,
    };
  }

  // This intentionally matches the existing elementary signup requirements:
  // elementary enrollment requires a real, plausible birth date and legal
  // guardian information, regardless of the calculated age.
  if (!input.birthDate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "초등 과정 학생은 생년월일을 입력해야 합니다.",
    });
  }
  const age = calculateAge(input.birthDate);
  if (age === null || age > 120) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "생년월일을 정확히 입력해 주세요.",
    });
  }
  if (!input.guardian) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "초등 과정 학생은 법정대리인(보호자) 정보를 입력해야 합니다.",
    });
  }
  if (
    normalizedEmail(input.guardian.email) === normalizedEmail(current.email)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "보호자 이메일은 학생 이메일과 달라야 합니다.",
    });
  }

  // Preserve any existing consent record. In particular, do not make a new
  // consent ledger row for an already pending child: the resend flow owns link
  // rotation for that record, and a freshly generated, unpersisted token must
  // never be emailed.
  const latestGuardianConsent = await db.getLatestGuardianConsentForUser(
    current.id
  );
  const guardianAlreadyApproved = latestGuardianConsent?.status === "approved";
  const guardianAlreadyPending = latestGuardianConsent?.status === "pending";
  let guardianToken: string | null = null;
  let guardianConsent: Parameters<typeof db.selectUserCourse>[2];

  if (!guardianAlreadyApproved && !guardianAlreadyPending) {
    guardianToken = createVerificationToken();
    guardianConsent = {
      userId: current.id,
      childBirthDate: input.birthDate,
      guardianName: input.guardian.name,
      guardianRelation: input.guardian.relation,
      guardianEmail: input.guardian.email,
      tokenHash: hashVerificationToken(guardianToken),
      tokenExpiresAt: new Date(Date.now() + GUARDIAN_CONSENT_TTL_MS),
      consentVersion: GUARDIAN_CONSENT_VERSION,
    };
  }

  // selectUserCourse creates the pending ledger entry before updating the tag,
  // and rejects a second concurrent choice. Do not call createGuardianConsent
  // outside that transaction.
  await db.selectUserCourse(current.id, input.courseType, guardianConsent);
  clearGuardianStatusCache(current.id);

  if (guardianAlreadyApproved) {
    return {
      courseType: input.courseType,
      requiresGuardianConsent: false,
      guardianEmailSent: false,
    };
  }

  // A previous pending ledger entry remains the single source of truth. The
  // existing resend route can send a current link, but selection never creates
  // a duplicate row or mails a token that was not stored transactionally.
  if (guardianAlreadyPending || !guardianToken) {
    return {
      courseType: input.courseType,
      requiresGuardianConsent: true,
      guardianEmailSent: false,
    };
  }

  let guardianEmailSent = false;
  try {
    await sendGuardianConsentEmail({
      to: input.guardian.email,
      guardianName: input.guardian.name,
      childName: current.name || "학생",
      consentUrl: guardianConsentUrl(origin, guardianToken),
    });
    guardianEmailSent = true;
  } catch (error) {
    // The pending database record is deliberately retained so the existing
    // resend flow can issue a new link. Do not turn a mail-provider outage
    // into a second selection/consent-record attempt.
    console.error("[Guardian] course selection consent email failed", error);
  }

  return {
    courseType: input.courseType,
    requiresGuardianConsent: true,
    guardianEmailSent,
  };
}
