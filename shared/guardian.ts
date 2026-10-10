// 만 14세 미만 아동 가입 시 법정대리인(보호자) 동의에 쓰는 공용 규칙과 동의서 문구.
// 서버(가입 검증·동의 기록)와 화면(가입 입력·동의 페이지)이 같은 기준을 쓰도록 한 곳에 둔다.

export const GUARDIAN_CONSENT_AGE = 14;
// 동의서 문구가 바뀌면 값을 올려, 어떤 문구에 동의했는지 기록으로 구분한다.
export const GUARDIAN_CONSENT_VERSION = "2026-10-v1";
export const GUARDIAN_CONSENT_METHOD = "email_confirmation";
export const GUARDIAN_RELATIONS = ["부", "모", "그 밖의 법정대리인"] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];

const BIRTH_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD 형식의 실제 달력 날짜인지 확인한다. */
export function parseBirthDate(value: string): Date | null {
  const match = BIRTH_DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    return null;
  }
  return date;
}

/** 만 나이(생일이 지나야 한 살이 늘어난다). 형식이 잘못됐거나 미래 날짜면 null. */
export function calculateAge(birthDate: string, now: Date = new Date()): number | null {
  const birth = parseBirthDate(birthDate);
  if (!birth) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age < 0 ? null : age;
}

export function requiresGuardianConsent(birthDate: string, now: Date = new Date()): boolean {
  const age = calculateAge(birthDate, now);
  return age !== null && age < GUARDIAN_CONSENT_AGE;
}

/** 보호자 화면에 아동 정보를 그대로 노출하지 않도록 이름 가운데를 가린다. */
export function maskName(name: string | null | undefined): string {
  const value = (name ?? "").trim();
  if (value.length <= 1) return value || "아동";
  if (value.length === 2) return `${value[0]}*`;
  return `${value[0]}${"*".repeat(value.length - 2)}${value[value.length - 1]}`;
}

export const GUARDIAN_CONSENT_TITLE = "만 14세 미만 아동 개인정보 수집·이용 및 법정대리인 동의서";

export const GUARDIAN_CONSENT_INTRO =
  "논술 마스터는 「개인정보 보호법」 제22조의2에 따라 만 14세 미만 아동의 개인정보를 수집·이용하려는 경우 법정대리인의 동의를 받습니다. 아래 내용을 확인한 뒤 동의 여부를 선택해 주세요.";

export const GUARDIAN_CONSENT_SECTIONS: ReadonlyArray<{ title: string; items: readonly string[] }> = [
  {
    title: "1. 수집하는 개인정보 항목",
    items: [
      "아동 정보: 이름, 이메일, 생년월일, 학습 과정, 서비스 이용 기록(학습 진도, 제출한 답안, AI 첨삭 결과)",
      "법정대리인 정보: 성명, 이메일, 아동과의 관계",
    ],
  },
  {
    title: "2. 수집 및 이용 목적",
    items: ["아동 회원 가입 및 본인 확인, 학습 서비스 제공, 문의·민원 처리"],
  },
  {
    title: "3. 보유 및 이용 기간",
    items: ["회원 탈퇴 또는 삭제 요청 처리 시 지체 없이 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다."],
  },
  {
    title: "4. 동의 거부권 및 불이익",
    items: ["법정대리인은 동의를 거부할 권리가 있습니다. 동의하지 않으면 아동은 서비스를 이용할 수 없습니다. 동의 후에도 언제든 철회, 열람, 정정을 요청할 수 있습니다."],
  },
];

export const GUARDIAN_AGREEMENT_LABELS = {
  agreeCollection: "(필수) 만 14세 미만 아동의 개인정보 수집 및 이용에 동의합니다.",
  agreeGuardian: "(필수) 본인은 위 아동의 법정대리인임을 확인하며, 동의합니다.",
} as const;
