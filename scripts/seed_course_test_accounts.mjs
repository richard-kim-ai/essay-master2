import {
  addLearningGroupMember,
  assignStudentTeacher,
  createClassAssignment,
  createEmailUser,
  getLearningGroupsWithMembers,
  getStudentClassAssignmentDetails,
  getStudentClassAssignments,
  getTeacherClassAssignmentSubmissions,
  getUserByEmail,
  reviewStudentClassAssignment,
  saveLearningGroup,
  submitStudentClassAssignment,
  updateTeacherStatus,
} from "../server/db.ts";
import { hashPassword, verifyPassword } from "../server/email.ts";
import { appRouter } from "../server/routers.ts";

const PASSWORD = process.env.QA_ACCOUNT_PASSWORD;
const ADMIN_EMAIL = "nicky@ufinsu.com";
const TEST_PREFIX = "qa-202608-course";

function createCaller(user) {
  return appRouter.createCaller({
    user,
    req: { protocol: "https", headers: {} },
    res: { clearCookie: () => undefined },
  });
}

const accountPlan = [
  { courseType: "elementary", courseLabel: "초등", teacherEmail: "qa.teacher.elementary.a@essaymaster.test", teacherName: "QA 초등 담당교사 A", studentEmail: "qa.student.elementary.a@essaymaster.test", studentName: "QA 초등 학생 A", groupName: "QA 테스트 · 초등 A반" },
  { courseType: "elementary", courseLabel: "초등", teacherEmail: "qa.teacher.elementary.b@essaymaster.test", teacherName: "QA 초등 담당교사 B", studentEmail: "qa.student.elementary.b@essaymaster.test", studentName: "QA 초등 학생 B", groupName: "QA 테스트 · 초등 B반" },
  { courseType: "middle_high", courseLabel: "중고등", teacherEmail: "qa.teacher.middlehigh@essaymaster.test", teacherName: "QA 중고등 담당교사", studentEmail: "qa.student.middlehigh@essaymaster.test", studentName: "QA 중고등 학생", groupName: "QA 테스트 · 중고등 논술반" },
  { courseType: "high_univ", courseLabel: "고등/대입", teacherEmail: "qa.teacher.highuniv@essaymaster.test", teacherName: "QA 고등/대입 담당교사", studentEmail: "qa.student.highuniv@essaymaster.test", studentName: "QA 고등/대입 학생", groupName: "QA 테스트 · 고등/대입 논술반" },
  { courseType: "general_adult", courseLabel: "일반/직장인", teacherEmail: "qa.teacher.generaladult@essaymaster.test", teacherName: "QA 일반/직장인 담당교사", studentEmail: "qa.student.generaladult@essaymaster.test", studentName: "QA 일반/직장인 학생", groupName: "QA 테스트 · 일반/직장인 논술반" },
];

async function ensureTeacher(plan, passwordHash) {
  let teacher = await getUserByEmail(plan.teacherEmail);
  if (!teacher) {
    teacher = await createEmailUser({
      openId: `${TEST_PREFIX}:teacher:${plan.courseType}:${plan.teacherEmail.split("@")[0]}`,
      name: plan.teacherName,
      email: plan.teacherEmail,
      passwordHash,
      loginMethod: "email",
      emailVerifiedAt: new Date(),
      role: "teacher",
      teacherLevel: 2,
      teacherStatus: "approved",
      tag: `${plan.courseLabel} 테스트 교사`,
    });
  } else if (teacher.role !== "teacher" || teacher.teacherStatus !== "approved") {
    throw new Error(`테스트 교사 이메일이 다른 계정 상태로 존재합니다: ${plan.teacherEmail}`);
  }
  await updateTeacherStatus(teacher.id, "approved", 2);
  return teacher;
}

async function ensureStudent(plan, teacherId, passwordHash) {
  let student = await getUserByEmail(plan.studentEmail);
  if (!student) {
    student = await createEmailUser({
      openId: `${TEST_PREFIX}:student:${plan.courseType}:${plan.studentEmail.split("@")[0]}`,
      name: plan.studentName,
      email: plan.studentEmail,
      passwordHash,
      loginMethod: "email",
      emailVerifiedAt: new Date(),
      role: "user",
      tag: plan.courseLabel,
      teacherId,
      preferredTeacherId: teacherId,
    });
  } else if (student.role !== "user") {
    throw new Error(`테스트 학생 이메일이 다른 계정 상태로 존재합니다: ${plan.studentEmail}`);
  }
  return student;
}

async function ensureGroup(plan, teacherId, adminId) {
  const existing = (await getLearningGroupsWithMembers()).find((group) => group.name === plan.groupName);
  const group = await saveLearningGroup({
    groupId: existing?.id,
    name: plan.groupName,
    groupType: "class",
    courseType: plan.courseType,
    description: `${plan.courseLabel} 과정 권한·과제 흐름 검증용 전용 테스트 반`,
    teacherId,
    isActive: 1,
    createdBy: adminId,
  });
  if (!group) throw new Error(`테스트 반 생성에 실패했습니다: ${plan.groupName}`);
  return group;
}

async function ensureAssignmentAndExercise(plan, teacher, student, group) {
  const assignments = await getStudentClassAssignments(student.id);
  const title = `[QA 테스트] ${plan.courseLabel} 논술 과제`;
  let assignment = assignments.find((item) => item.groupId === group.id && item.title === title);
  if (!assignment) {
    const created = await createClassAssignment(teacher.id, {
      groupId: group.id,
      title,
      instructions: `${plan.courseLabel} 과정에 맞추어 자신의 주장을 한 문장으로 제시하고, 이를 뒷받침하는 근거를 두 가지 이상 작성하세요.`,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    assignment = (await getStudentClassAssignments(student.id)).find((item) => item.id === created.assignmentId);
  }
  if (!assignment) throw new Error(`테스트 과제를 확인할 수 없습니다: ${plan.groupName}`);

  if (!assignment.submission || assignment.submission.status !== "reviewed") {
    await submitStudentClassAssignment(student.id, assignment.id, `${plan.courseLabel} 과정의 논술 답안입니다. 저는 학교와 지역사회가 안전한 보행 환경을 함께 만들어야 한다고 주장합니다. 첫째, 통학로의 위험 구간을 조사하여 개선하면 학생들의 일상 안전을 높일 수 있습니다. 둘째, 주민과 학교가 정기적으로 의견을 나누면 예산과 시설을 더 필요한 곳에 우선 배치할 수 있습니다. 따라서 근거를 확인하고 함께 실천하는 과정이 필요합니다.`);
  }

  const submissions = await getTeacherClassAssignmentSubmissions(teacher.id);
  const submission = submissions.find((item) => item.assignmentId === assignment.id && item.studentId === student.id);
  if (!submission) throw new Error(`교사 제출물 조회 권한 검증에 실패했습니다: ${plan.teacherEmail}`);

  if (!submission.teacherComment || submission.status !== "reviewed") {
    await reviewStudentClassAssignment(teacher.id, submission.id, { score: 88, teacherComment: "주장과 두 가지 근거가 분명합니다. 다음에는 근거가 왜 중요한지 한 문장 더 설명해보세요." });
  }

  const details = await getStudentClassAssignmentDetails(student.id);
  const verified = details.find((item) => item.id === assignment.id);
  if (!verified || verified.submissionStatus !== "reviewed" || !verified.submission?.teacherComment) {
    throw new Error(`학생의 채점 결과 조회 검증에 실패했습니다: ${plan.studentEmail}`);
  }
  const studentApiAssignments = await createCaller(student).student.myAssignments();
  if (!studentApiAssignments.some((item) => item.id === assignment.id && item.submissionStatus === "reviewed")) {
    throw new Error(`학생 과제 조회 API 권한 검증에 실패했습니다: ${plan.studentEmail}`);
  }
  const teacherApiSubmissions = await createCaller(teacher).teacherOperations.classAssignmentSubmissions();
  if (!teacherApiSubmissions.some((item) => item.id === verified.submission.id && item.studentId === student.id)) {
    throw new Error(`교사 제출물 조회 API 권한 검증에 실패했습니다: ${plan.teacherEmail}`);
  }
  return { assignmentId: assignment.id, submissionId: verified.submission.id, studentApiAccess: true, teacherApiAccess: true, aiFeedbackVisibleAfterReview: Boolean(verified.aiFeedback), aiGenerationDeferred: true };
}

async function main() {
  if (!PASSWORD || PASSWORD.length < 12) throw new Error("QA_ACCOUNT_PASSWORD 환경 변수에 12자 이상 테스트 비밀번호를 설정해주세요.");
  const admin = await getUserByEmail(ADMIN_EMAIL);
  if (!admin || admin.role !== "admin") throw new Error(`테스트 운영 관리자 계정을 찾을 수 없습니다: ${ADMIN_EMAIL}`);
  const passwordHash = hashPassword(PASSWORD);
  if (!verifyPassword(PASSWORD, passwordHash)) throw new Error("테스트 비밀번호 해시 검증에 실패했습니다.");

  const results = [];
  for (const plan of accountPlan) {
    const teacher = await ensureTeacher(plan, passwordHash);
    const student = await ensureStudent(plan, teacher.id, passwordHash);
    const group = await ensureGroup(plan, teacher.id, admin.id);
    await addLearningGroupMember(group.id, student.id, admin.id);
    await assignStudentTeacher(student.id, teacher.id, admin.id);
    const exercise = await ensureAssignmentAndExercise(plan, teacher, student, group);
    results.push({ course: plan.courseLabel, teacher: plan.teacherEmail, teacherId: teacher.id, student: plan.studentEmail, studentId: student.id, group: plan.groupName, groupId: group.id, ...exercise });
  }

  console.log(JSON.stringify({ verified: true, accounts: results }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
