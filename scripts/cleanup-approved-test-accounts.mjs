// 이번에 사용자가 승인한 14개 계정만 정리한다. 추가 계정은 자동 포함하지 않는다.
// 기본은 읽기 전용 계획. 실행: node scripts/cleanup-approved-test-accounts.mjs --apply --plan-sha=<계획 해시>
// .env를 읽거나 접속 정보·비밀번호·학습 원문을 출력하지 않는다.
import mysql from "mysql2/promise";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const APPROVED_ACCOUNTS = new Map([
  [870001, "ssongcampark@gmail.com"],
  [15330007, "student@sample.com"],
  [15330010, "qa.teacher.elementary.a@essaymaster.test"],
  [15330011, "qa.student.elementary.a@essaymaster.test"],
  [15390001, "qa.teacher.elementary.b@essaymaster.test"],
  [15390002, "qa.student.elementary.b@essaymaster.test"],
  [15390007, "qa.teacher.middlehigh@essaymaster.test"],
  [15390008, "qa.student.middlehigh@essaymaster.test"],
  [15390009, "qa.teacher.highuniv@essaymaster.test"],
  [15390010, "qa.student.highuniv@essaymaster.test"],
  [15390011, "qa.teacher.generaladult@essaymaster.test"],
  [15390012, "qa.student.generaladult@essaymaster.test"],
  [23730004, "teacher@sample.com"],
  [26790001, "doll25@naver.com"],
]);
export const PROTECTED_IDS = [1, 14670001];
export const PRESERVED_TABLES = [
  "curriculum", "dynamic_curriculum", "question_bank", "question_bank_trash",
  "curriculum_workbook_questions", "lesson_theory_content", "lesson_theory_drafts",
  "workbook_lesson_connections", "approved_writing_examples", "policy_documents",
  "site_settings", "social_provider_config", "app_secret_config", "evaluation_model_configs",
  "admin_audit_logs", "admin_memo_history", "question_bank_operation_logs",
  "question_bank_maintenance_settings", "evaluation_model_operations", "sample_ai_usage_log",
  "payment_orders", "subscriptions", "teacher_settlements", "teacher_settlement_rates",
  "institution_contracts", "institution_members", "institution_usage",
  "teacher_activity_accounting", "institution_audit_logs", "certificate_approval_policies",
];
const OWNER_TABLES = [
  "progress", "quiz_answer", "sentence_feedback_cache", "learning_tool_attempts",
  "learning_tool_mistakes", "workbook_mistakes", "curriculum_workbook_answers",
  "ai_lesson_guide_histories", "lesson_theory_progress", "user_badges",
  "ai_auto_feedback", "writing_evaluation_records", "evaluation_appeals",
  "evaluation_review_queue", "ai_usage_logs", "app_notifications", "push_subscription",
  "user_policy_consents", "guardian_consents", "data_processing_requests",
  "question_bookmarks", "question_feedbacks", "certificate", "essay_submission",
];
export function validateAccounts(users) {
  const byId = new Map(users.map(u => [Number(u.id), u]));
  if (byId.get(1)?.role !== "admin") throw new Error("보호 관리자 계정이 일치하지 않습니다.");
  if (byId.get(14670001)?.openId !== "ai_tutor_bot_system" || byId.get(14670001)?.email !== "ai-tutor@essaymaster.internal") {
    throw new Error("보호 AI 기본 담당 봇이 일치하지 않습니다.");
  }
  const selected = [];
  for (const [id, email] of APPROVED_ACCOUNTS) {
    const u = byId.get(id);
    if (!u) continue; // 재실행 시 이미 삭제된 계정은 제외한다.
    if (u.email !== email || u.role === "admin" || u.openId === "ai_tutor_bot_system") {
      throw new Error(`승인한 계정과 현재 계정이 일치하지 않습니다: ${id}`);
    }
    selected.push(id);
  }
  return selected;
}
function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function identifiers(values) { return [...new Set(values.map(Number))].sort((a, b) => a - b); }
function inIds(column, ids) {
  return ids.length ? { sql: `\`${column}\` IN (${ids.map(() => "?").join(",")})`, args: ids } : { sql: "FALSE", args: [] };
}
function either(...parts) { return { sql: parts.map(p => `(${p.sql})`).join(" OR "), args: parts.flatMap(p => p.args) }; }

export async function cleanup(connection, { apply = false, expectedSha } = {}) {
  await connection.beginTransaction();
  try {
    // 삭제 계정과 보호 계정을 잠가 계정 변경/승격과 삭제가 동시에 발생하지 않게 한다.
    const [users] = await connection.query(`SELECT * FROM users ORDER BY id${apply ? " FOR UPDATE" : ""}`);
    const targetIds = validateAccounts(users);
    const protectedBefore = users.filter(u => !targetIds.includes(Number(u.id)));
    const [tableRows] = await connection.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
    const tables = new Set(tableRows.map(r => r.TABLE_NAME));
    const preserved = {};
    for (const table of PRESERVED_TABLES.filter(t => tables.has(t))) {
      const [rows] = await connection.query(`SELECT * FROM \`${table}\` ORDER BY id`);
      preserved[table] = { count: rows.length, sha256: digest(rows) };
    }
    const plan = new Map();
    async function select(table, where) {
      if (!tables.has(table)) return [];
      const [rows] = await connection.query(`SELECT id FROM \`${table}\` WHERE ${where.sql} ORDER BY id${apply ? " FOR UPDATE" : ""}`, where.args);
      const ids = identifiers(rows.map(r => r.id));
      if (ids.length) plan.set(table, ids);
      return ids;
    }
    const groups = await select("learning_groups", {
      sql: `name LIKE 'QA 테스트%' AND (${either(inIds("teacherId", targetIds), inIds("createdBy", targetIds)).sql})`,
      args: [...targetIds, ...targetIds],
    });
    // 보호 계정이나 승인하지 않은 새 회원이 있는 반은 삭제하지 않는다.
    if (groups.length) {
      const groupFilter = inIds("groupId", groups);
      const [members] = await connection.query(`SELECT studentId FROM learning_group_members WHERE ${groupFilter.sql}`, groupFilter.args);
      if (members.some(m => !targetIds.includes(Number(m.studentId)))) throw new Error("테스트 반에 삭제 승인하지 않은 회원이 있어 중단합니다.");
    }
    const assignments = await select("class_assignments", either(inIds("groupId", groups), inIds("createdBy", targetIds)));
    const submissions = await select("class_assignment_submissions", either(inIds("studentId", targetIds), inIds("assignmentId", assignments)));
    for (const table of OWNER_TABLES) await select(table, inIds("userId", targetIds));
    const essays = plan.get("essay_submission") ?? [];
    const answers = plan.get("curriculum_workbook_answers") ?? [];
    const certificates = plan.get("certificate") ?? [];
    const feedbacks = await select("teacher_feedback", either(inIds("teacherId", targetIds), inIds("essayId", essays)));
    const drafts = await select("teacher_ai_drafts", either(inIds("teacherId", targetIds), inIds("essayId", essays)));
    await select("feedback_comment", inIds("feedbackId", feedbacks));
    await select("teacher_ai_draft_revisions", either(inIds("draftId", drafts), inIds("editorId", targetIds)));
    await select("teacher_ai_style_examples", either(inIds("teacherId", targetIds), inIds("sourceFeedbackId", feedbacks)));
    await select("teacher_ai_profiles", inIds("teacherId", targetIds));
    await select("teacher_feedback_templates", inIds("teacherId", targetIds));
    await select("teacher_permission_grants", either(inIds("teacherId", targetIds), inIds("studentId", targetIds)));
    await select("workbook_teacher_feedback", either(inIds("teacherId", targetIds), inIds("answerId", answers)));
    await select("certificate_archives", either(inIds("certificateId", certificates), inIds("createdBy", targetIds)));
    await select("certificate_approval_requests", either(inIds("studentId", targetIds), inIds("certificateId", certificates)));
    await select("parent_student_links", either(inIds("parentId", targetIds), inIds("studentId", targetIds)));
    await select("learning_group_members", either(inIds("studentId", targetIds), inIds("groupId", groups)));
    await select("class_attendance", either(inIds("studentId", targetIds), inIds("groupId", groups)));
    await select("class_announcements", either(inIds("groupId", groups), inIds("createdBy", targetIds)));
    await select("class_assignment_ai_feedbacks", either(inIds("submissionId", submissions), inIds("generatedBy", targetIds)));
    plan.set("users", targetIds);
    const counts = Object.fromEntries([...plan].map(([table, ids]) => [table, ids.length]));
    const planSha = digest([...plan].sort(([a], [b]) => a.localeCompare(b)));
    const report = { mode: apply ? "apply" : "dry-run", targetIds, planSha, counts, preservedCounts: Object.fromEntries(Object.entries(preserved).map(([t, v]) => [t, v.count])) };
    if (!apply) { await connection.rollback(); return report; }
    if (expectedSha !== planSha) throw new Error("삭제 계획이 변경되었습니다. 읽기 전용 계획을 확인한 뒤 다시 실행하세요.");
    // FK가 추가된 환경에서는 자동 CASCADE에 의존하지 않고 중단한다.
    const [fks] = await connection.query("SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
    if (fks.some(fk => plan.has(fk.TABLE_NAME))) throw new Error("외래키가 추가된 DB는 삭제 순서 수동 검토가 필요합니다.");
    const usersToDelete = plan.get("users");
    plan.delete("users");
    for (const [table, ids] of plan) {
      if (PRESERVED_TABLES.includes(table)) throw new Error(`보호 테이블 삭제 차단: ${table}`);
      const where = inIds("id", ids);
      const [result] = await connection.query(`DELETE FROM \`${table}\` WHERE ${where.sql}`, where.args);
      if (result.affectedRows !== ids.length) throw new Error(`삭제 수 불일치: ${table}`);
    }
    // 승인되지 않은 회원의 담당자를 임의로 바꾸지 않는다. 참조가 있으면 전체 롤백한다.
    const [remaining] = await connection.query("SELECT * FROM users ORDER BY id");
    if (remaining.some(u => !targetIds.includes(Number(u.id)) && (targetIds.includes(Number(u.teacherId)) || targetIds.includes(Number(u.preferredTeacherId))))) {
      throw new Error("보존 계정이 삭제 대상 교사를 참조하여 자동 변경 없이 중단합니다.");
    }
    if (usersToDelete.length) {
      const where = inIds("id", usersToDelete);
      const [result] = await connection.query(`DELETE FROM users WHERE ${where.sql} AND role <> 'admin' AND openId <> 'ai_tutor_bot_system'`, where.args);
      if (result.affectedRows !== usersToDelete.length) throw new Error("보호 검증으로 계정 삭제가 중단되었습니다.");
    }
    for (const [table, before] of Object.entries(preserved)) {
      const [rows] = await connection.query(`SELECT * FROM \`${table}\` ORDER BY id`);
      if (digest(rows) !== before.sha256) throw new Error(`보호 테이블 변경 감지: ${table}`);
    }
    const [afterUsers] = await connection.query("SELECT * FROM users ORDER BY id");
    if (digest(afterUsers) !== digest(protectedBefore)) throw new Error("보존 계정 변경 감지");
    for (const [table, ids] of plan) {
      const where = inIds("id", ids);
      const [rows] = await connection.query(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE ${where.sql}`, where.args);
      if (Number(rows[0].n)) throw new Error(`삭제 후 잔존 행: ${table}`);
    }
    await connection.commit();
    return { ...report, verified: true, remainingUsers: afterUsers.map(({ id, name, role }) => ({ id, name, role })), protectedDataUnchanged: true };
  } catch (error) { await connection.rollback(); throw error; }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 필요합니다.");
  const args = process.argv.slice(2);
  if (args.some(a => a !== "--apply" && !a.startsWith("--plan-sha="))) throw new Error("알 수 없는 옵션입니다.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try { console.log(JSON.stringify(await cleanup(connection, { apply: args.includes("--apply"), expectedSha: args.find(a => a.startsWith("--plan-sha="))?.slice(11) }), null, 2)); }
  finally { await connection.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
