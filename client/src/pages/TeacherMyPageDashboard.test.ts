import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "client/src/pages/TeacherMyPage.tsx"), "utf8");
const dbSource = readFileSync(join(process.cwd(), "server/db.ts"), "utf8");

describe("교사 마이페이지: 지도 학생 수와 첨삭 현황", () => {
  it("지도 학생 수는 담당 교사로 연결된 학생과 권한 부여 학생을 나눠 보여 주고, 예전 '권한이 부여된 학습자만' 문구가 없다", () => {
    expect(source).toContain('data-testid="teacher-student-count"');
    expect(source).toContain("담당 교사로 연결");
    expect(source).toContain("관리자 권한 부여");
    expect(source).not.toContain("관리자 권한이 부여된 담당 학습자");
  });

  it("서버는 권한이 없어도 담당 교사로 연결된 학생을 지도 학생으로 돌려준다(권한 필수 조건 제거)", () => {
    expect(dbSource).toContain("selectManagedStudentIds(allUsers, grants, teacherId)");
    expect(dbSource).not.toContain("hasOrganizationScope");
  });

  it("첨삭 현황 요약(대기·작업 중·기한 경과·최근 30일 완료·평균 점수)과 '내 첨삭 현황' 탭, 최근 첨삭 목록이 있다", () => {
    expect(source).toContain("trpc.teacherOperations.feedbackDashboard.useQuery");
    for (const label of ["첨삭 대기", "작업 중", "기한 경과", "최근 30일 완료", "내 첨삭 평균 점수"]) expect(source).toContain(`label: "${label}"`);
    expect(source).toContain('value="history"');
    expect(source).toContain("내 첨삭 현황");
    expect(source).toContain('data-testid="teacher-feedback-history"');
    expect(source).toContain("/teacher-feedback/${row.essayId}");
    expect(source).toContain("아직 등록한 첨삭이 없습니다.");
  });

  it("교사 첨삭 신청 대기열은 승인된 교사 세션에서만 조회한다", () => {
    expect(source).toContain("const teacherEnabled =");
    expect(source).toContain("user?.role === \"teacher\"");
    expect(source).toContain("teacherStatus === \"approved\"");
    expect(source).toContain("<TeacherFeedbackQueue enabled={teacherEnabled} />");
  });

  it("학생 표에 담당 학생/권한 부여 구분 열이 있다", () => {
    expect(source).toContain('<th className="p-3">구분</th>');
    expect(source).toContain('"담당 학생"');
    expect(source).toContain('"권한 부여"');
  });
});
