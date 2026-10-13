// 이메일·비밀번호로 로그인할 수 있게 계정을 설정한다(Manus 로그인 없이 쓰기 위한 용도).
//
// 사용법:
//   npx tsx scripts/set-login-password.mts <이메일>                       (계획만 출력, DB 변경 없음)
//   npx tsx scripts/set-login-password.mts <이메일> --apply               (실제 적용)
//   npx tsx scripts/set-login-password.mts <이메일> --apply --make-admin  (관리자가 아니면 관리자로 승격)
//   npx tsx scripts/set-login-password.mts <새이메일> --apply --name "홍길동"  (계정이 없으면 관리자 새로 생성)
//
// - 계정이 이미 있으면: 비밀번호를 설정하고, 비어 있는 이메일 인증·로그인 방식 값을 채운다(그래야 이메일 로그인이 된다).
// - 계정이 없으면: 관리자 계정을 새로 만든다(이름 필요).
// - 비밀번호는 화면에 표시되지 않는 입력으로 받는다(환경변수 SET_LOGIN_PASSWORD가 있으면 그 값을 쓴다).
// - 대상 DB는 .env의 DATABASE_URL이다. 호스트·DB 이름만 보여 주고 접속 정보와 비밀번호·해시는 출력하지 않는다.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import readline from "node:readline";
import { users } from "../drizzle/schema";
import { createManagedAdminAccount, getDb, getUserByEmail } from "../server/db";
import { hashPassword } from "../server/email";
import { normalizeLoginEmail, planLoginSetup, validateLoginPassword } from "../server/loginSetup";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const makeAdmin = args.includes("--make-admin");
const nameIndex = args.indexOf("--name");
const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
const emailArg = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--name");
if (!emailArg) {
  console.error('사용법: npx tsx scripts/set-login-password.mts <이메일> [--apply] [--make-admin] [--name "이름"]');
  process.exit(1);
}
const email = normalizeLoginEmail(emailArg);

function describeDatabase() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "(DATABASE_URL을 해석할 수 없음)";
  }
}

function askHidden(question: string) {
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as any)._writeToOutput;
    (rl as any)._writeToOutput = (text: string) => {
      if (text.startsWith(question)) write.call(rl, text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

console.log(`대상 DB: ${describeDatabase()}`);
let existing: Awaited<ReturnType<typeof getUserByEmail>>;
try {
  existing = await getUserByEmail(email);
} catch {
  console.error("데이터베이스에 연결하지 못했습니다. .env의 DATABASE_URL(주소·계정·DB 이름)과 DB 실행 여부를 확인해 주세요.");
  process.exit(1);
}
const plan = planLoginSetup(existing, { makeAdmin, name });
console.log(`이메일: ${email}`);
if (plan.action === "create_admin") {
  console.log("계정 없음 → 관리자 계정을 새로 만듭니다.");
  if (plan.needsName) {
    console.error('새 계정에는 이름이 필요합니다. --name "이름" 을 붙여 주세요.');
    process.exit(1);
  }
} else {
  console.log(`계정 있음(id ${existing!.id}, 역할 ${existing!.role}) → 비밀번호를 ${plan.hadPassword ? "새로 바꿉니다" : "처음 설정합니다"}.`);
  if (plan.verifyEmail) console.log(" - 이메일 인증 완료로 표시합니다(비어 있어 로그인이 막혀 있었습니다).");
  if (plan.setLoginMethod) console.log(' - 로그인 방식을 "email"로 표시합니다.');
  if (plan.promoteToAdmin) console.log(" - 관리자로 승격합니다.");
}

if (!apply) {
  console.log("\n계획만 출력했습니다. 실제 적용은 --apply 를 붙여 다시 실행하세요.");
  process.exit(0);
}

let password = process.env.SET_LOGIN_PASSWORD ?? "";
if (!password) {
  password = await askHidden("새 비밀번호(10자 이상): ");
  const confirm = await askHidden("새 비밀번호 확인: ");
  if (password !== confirm) {
    console.error("비밀번호가 서로 다릅니다. 변경하지 않았습니다.");
    process.exit(1);
  }
}
const problem = validateLoginPassword(password);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const passwordHash = hashPassword(password);
if (plan.action === "create_admin") {
  const created = await createManagedAdminAccount({ openId: `admin_${nanoid(40)}`, name: name!.trim(), email, passwordHash });
  console.log(`관리자 계정을 만들었습니다(id ${created?.id}). 이제 ${email} 로 이메일 로그인할 수 있습니다.`);
} else {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스에 연결할 수 없습니다.");
  await db
    .update(users)
    .set({
      passwordHash,
      emailVerifiedAt: existing!.emailVerifiedAt ?? new Date(),
      loginMethod: existing!.loginMethod ?? "email",
      ...(plan.promoteToAdmin ? { role: "admin" as const, teacherStatus: "approved" as const } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, existing!.id));
  console.log(`비밀번호를 설정했습니다. 이제 ${email} 로 이메일 로그인할 수 있습니다.`);
}
process.exit(0);
