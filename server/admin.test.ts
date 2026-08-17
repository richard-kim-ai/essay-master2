import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const adminPagePath = new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url);
const navPath = new URL("../client/src/components/Navigation.tsx", import.meta.url);
const certificatesPagePath = new URL("../client/src/pages/AdminCertificates.tsx", import.meta.url);
const curriculumManagerPath = new URL("../client/src/pages/AdminCurriculumManager.tsx", import.meta.url);
const curriculumDetailPath = new URL("../client/src/pages/CurriculumDetail.tsx", import.meta.url);
const curriculumPagePath = new URL("../client/src/pages/Curriculum.tsx", import.meta.url);
const routersPath = new URL("./routers.ts", import.meta.url);

describe("관리자 대시보드 및 모바일 네비게이션 검증", () => {
  it("관리자 대시보드 페이지가 권한 확인 및 학습자 전체 분석을 포함한다", () => {
    const source = readFileSync(adminPagePath, "utf8");
    expect(source).toContain("관리자 전용 페이지");
    expect(source).toContain("학습자 전체 분석 & 관리자 대시보드");
    expect(source).toContain("/admin/social-providers");
  });

  it("모바일 헤더에서 사이트명이 숨겨지지 않고 항상 표시된다", () => {
    const source = readFileSync(navPath, "utf8");
    expect(source).not.toContain("hidden sm:inline");
    expect(source).toContain("논술 마스터");
  });

  it("수료증 관리 화면에 발행·발행취소·삭제 흐름이 포함된다", () => {
    const source = readFileSync(certificatesPagePath, "utf8");
    expect(source).toContain("관리자 수료증 발행");
    expect(source).toContain("발행취소 확정");
    expect(source).toContain("삭제 확정");
    expect(source).toContain("동일 조건의 활성 수료증은 중복 발행할 수 없습니다.");
  });

  it("동적 커리큘럼 관리자 화면에 추가·수정·삭제 흐름이 포함된다", () => {
    const source = readFileSync(curriculumManagerPath, "utf8");
    expect(source).toContain("새 커리큘럼 카테고리 추가");
    expect(source).toContain("커리큘럼 수정 확인");
    expect(source).toContain("카테고리 삭제 실수 방지 경고");
    expect(source).toContain("getCurriculumCategoriesAdmin");
  });

  it("관리자 라우터가 수료증과 카테고리 CRUD를 노출한다", () => {
    const source = readFileSync(routersPath, "utf8");
    expect(source).toContain("issueCertificateAdmin");
    expect(source).toContain("revokeCertificateAdmin");
    expect(source).toContain("deleteCurriculumCategoryAdmin");
    expect(source).toContain("ctx.user.role !== \"admin\"");
  });

  it("학생용 신규 과정 상세 페이지가 AI 태그와 샘플 PDF 다운로드를 제공한다", () => {
    const source = readFileSync(curriculumDetailPath, "utf8");
    expect(source).toContain("getDynamicByType.useQuery");
    expect(source).toContain("item.samplePdfUrl");
    expect(source).toContain("PDF 다운로드");
    expect(source).toContain("item.aiTags");
  });

  it("학생용 커리큘럼 카드가 신규 과정의 상세 페이지와 자동 태그를 연결한다", () => {
    const source = readFileSync(curriculumPagePath, "utf8");
    expect(source).toContain("강의 상세 보기 · PDF 자료");
    expect(source).toContain("aiTags");
    expect(source).toContain("isDynamicCourse");
  });

  it("수료증 검색 UI가 학생 이름·이메일 검색과 검색어 초기화를 제공한다", () => {
    const source = readFileSync(certificatesPagePath, "utf8");
    expect(source).toContain("학생 이름 또는 이메일 검색");
    expect(source).toContain("검색어 지우기");
    expect(source).toContain("검색 결과");
  });

  it("AI 자동 첨삭 페이지가 문서 파일 업로드 및 텍스트 추출을 지원한다", () => {
    const aiFeedbackPath = new URL("../client/src/pages/AIAutoFeedback.tsx", import.meta.url);
    const source = readFileSync(aiFeedbackPath, "utf8");
    expect(source).toContain("답안 파일 업로드");
    expect(source).toContain("FileReader");
  });

  it("대시보드가 과정별 진도 프로그레스 바를 제공한다", () => {
    const dashboardPath = new URL("../client/src/pages/Dashboard.tsx", import.meta.url);
    const source = readFileSync(dashboardPath, "utf8");
    expect(source).toContain("초등 과정 진도");
    expect(source).toContain("중고등 과정 진도");
    expect(source).toContain("고등/대입 과정 진도");
    expect(source).toContain("일반/직장인 과정 진도");
  });

  it("문제은행 관리자 콘솔이 정답률 통계와 AI 난이도 최적화 기능을 제공한다", () => {
    const adminQBankPath = new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url);
    const source = readFileSync(adminQBankPath, "utf8");
    expect(source).toContain("정답률 & AI 통계 분석");
    expect(source).toContain("기간별 정답률 변화 추이");
    expect(source).toContain("낮은 정답률순");
  });

  it("백엔드가 기간별 정답률 추이 및 AI 오답 인사이트 프로시저를 포함한다", () => {
    const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(routersSource).toContain("trendStats:");
    expect(routersSource).toContain("aiInsight:");
    expect(routersSource).toContain("submitFeedback:");
  });

  it("추천 논술 아카이브 페이지와 문제 피드백 컴포넌트가 존재한다", () => {
    const archivePath = new URL("../client/src/pages/EssayArchive.tsx", import.meta.url);
    const feedbackBoxPath = new URL("../client/src/components/QuestionFeedbackBox.tsx", import.meta.url);
    const arcSource = readFileSync(archivePath, "utf8");
    const fbSource = readFileSync(feedbackBoxPath, "utf8");
    expect(arcSource).toContain("추천 논술 아카이브");
    expect(arcSource).toContain("주간 학습 플래너");
    expect(arcSource).toContain("기출/유사 추천");
    expect(fbSource).toContain("이 문제가 도움이 되었나요?");
    expect(fbSource).toContain("문제 오류 신고");
  });

  it("관리자 문제은행 콘솔에 품질 모니터링과 AI 실전 문제 출제 기능이 포함된다", () => {
    const adminQBankPath = new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url);
    const source = readFileSync(adminQBankPath, "utf8");
    expect(source).toContain("문항 품질 모니터링");
    expect(source).toContain("AI 문제 사전 검토 출제");
    expect(source).toContain("previewAiQuestions");
  });

  it("백엔드가 문제은행 통계 및 AI 난이도 적용 프로시저를 포함한다", () => {
    const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(routersSource).toContain("questionBank: router({");
    expect(routersSource).toContain("stats:");
    expect(routersSource).toContain("applyAiDifficulty:");
  });

  it("프로그레스 바 클릭 시 과정별 세부 모듈 상태를 확인할 수 있다", () => {
    const dashboardPath = new URL("../client/src/pages/Dashboard.tsx", import.meta.url);
    const source = readFileSync(dashboardPath, "utf8");
    expect(source).toContain("세부 모듈 확인");
    expect(source).toContain("세부 학습 모듈");
    expect(source).toContain("완료");
    expect(source).toContain("미시작");
  });

  it("진도 상세 모듈이 불리언·백분율 완료 저장 형식을 모두 해석한다", () => {
    const dashboardPath = new URL("../client/src/pages/Dashboard.tsx", import.meta.url);
    const source = readFileSync(dashboardPath, "utf8");
    expect(source).toContain("completed >= 100");
    expect(source).toContain("진행 중");
    expect(source).toContain("미시작");
  });

  it("AI 피드백 비교 페이지가 원본과 개선 답안을 나란히 보여준다", () => {
    const comparePath = new URL("../client/src/pages/AIFeedbackCompare.tsx", import.meta.url);
    const aiPath = new URL("../server/aiFeedback.ts", import.meta.url);
    const compareSource = readFileSync(comparePath, "utf8");
    const aiSource = readFileSync(aiPath, "utf8");
    expect(compareSource).toContain("학생 원본 답안");
    expect(compareSource).toContain("AI 첨삭 답안");
    expect(compareSource).toContain("feedback.revisedEssay");
    expect(aiSource).toContain("revisedEssay");
  });

  it("교사회원 가입 및 교사 마이페이지 기능이 존재한다", () => {
    const signupPath = new URL("../client/src/pages/TeacherSignup.tsx", import.meta.url);
    const mypagePath = new URL("../client/src/pages/TeacherMyPage.tsx", import.meta.url);
    const signupSource = readFileSync(signupPath, "utf8");
    const mypageSource = readFileSync(mypagePath, "utf8");
    expect(signupSource).toContain("교사 회원가입");
    expect(signupSource).toContain("teacherLevel");
    expect(mypageSource).toContain("교사 마이페이지");
    expect(mypageSource).toContain("지도 학생 관리 목록");
    expect(mypageSource).toContain("승인 대기");
    expect(mypageSource).toContain("최근 접속일순");
  });

  it("AI 답안 비교 뷰에 변경점 하이라이트 기능이 포함되어 있다", () => {
    const comparePath = new URL("../client/src/pages/AIFeedbackCompare.tsx", import.meta.url);
    const compareSource = readFileSync(comparePath, "utf8");
    expect(compareSource).toContain("renderHighlightedDiff");
    expect(compareSource).toContain("하이라이트 켜짐");
  });

  it("관리자 커리큘럼 운영 안내 문구가 정제되어 있다", () => {
    const managerPath = new URL("../client/src/pages/AdminCurriculumManager.tsx", import.meta.url);
    const managerSource = readFileSync(managerPath, "utf8");
    expect(managerSource).toContain("노출 순서를 변경할 수 있습니다");
  });

  it("ManusDialog에 DialogTitle이 항상 렌더링되어 접근성 오류를 방지한다", () => {
    const dialogPath = new URL("../client/src/components/ManusDialog.tsx", import.meta.url);
    const dialogSource = readFileSync(dialogPath, "utf8");
    expect(dialogSource).toContain("DialogTitle");
  });

  it("관리자 커리큘럼 화면에 필터 탭, 검색, 노출 토글, 미리보기 기능이 포함되어 있다", () => {
    const managerPath = new URL("../client/src/pages/AdminCurriculumManager.tsx", import.meta.url);
    const managerSource = readFileSync(managerPath, "utf8");
    expect(managerSource).toContain("activeTab");
    expect(managerSource).toContain("searchQuery");
    expect(managerSource).toContain("toggleCurriculumActiveAdmin");
    expect(managerSource).toContain("학생 화면 상세 미리보기");
  });

  it("문제은행 휴지통이 보관 기간 설정과 복구·영구 삭제 흐름을 제공한다", () => {
    const adminQBankPath = new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url);
    const source = readFileSync(adminQBankPath, "utf8");
    expect(source).toContain("자동 보관 기간");
    expect(source).toContain("handleSaveRetentionDays");
    expect(source).toContain("restoreFromTrash");
    expect(source).toContain("permanentlyDeleteTrashItem");
  });

  it("문제은행 업로드 실패 CSV와 작업 이력 로그를 제공한다", () => {
    const adminQBankPath = new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url);
    const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const source = readFileSync(adminQBankPath, "utf8");
    expect(source).toContain("실패 문항 CSV 다운로드");
    expect(source).toContain("문항 작업 이력 로그");
    expect(routersSource).toContain("maintenanceSettings:");
    expect(routersSource).toContain("operationLogs:");
  });

  it("AI 문항 사전 검토가 구조화 JSON 응답 계약과 오류 전달을 사용한다", () => {
    const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    const adminQBankPath = new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url);
    const pageSource = readFileSync(adminQBankPath, "utf8");
    expect(dbSource).toContain("question_bank_preview");
    expect(dbSource).toContain("responseFormat: {");
    expect(dbSource).toContain("AI 문항 생성에 실패했습니다:");
    expect(pageSource).toContain("AI 문항 생성에 실패했습니다.");
  });

  it("휴지통에서 다중 선택 복구·영구 삭제와 만료 임박 경고를 제공한다", () => {
    const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url), "utf8");
    expect(dbSource).toContain("restoreQuestionBankTrashItems");
    expect(dbSource).toContain("permanentlyDeleteQuestionBankTrashItems");
    expect(routersSource).toContain("restoreManyFromTrash:");
    expect(routersSource).toContain("permanentlyDeleteTrashItems:");
    expect(pageSource).toContain("현재 휴지통 전체 선택");
    expect(pageSource).toContain("자동 영구 삭제 대상");
  });

  it("작업 이력에 기간·처리자·작업 유형 필터와 현재 필터 CSV 내보내기가 있다", () => {
    const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url), "utf8");
    expect(dbSource).toContain("filters.actionType");
    expect(dbSource).toContain("filters.actorName");
    expect(dbSource).toContain("filters.startDate");
    expect(pageSource).toContain("현재 필터 CSV 내보내기");
    expect(pageSource).toContain("setLogQuickDateRange");
  });

  it("문제은행에서 현재 목록과 독립적으로 과정별 CSV 백업을 제공한다", () => {
    const pageSource = readFileSync(new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url), "utf8");
    expect(pageSource).toContain("backupCourse");
    expect(pageSource).toContain("backupQuestions");
    expect(pageSource).toContain("handleDownloadCourseBackup");
    expect(pageSource).toContain("과정별 백업");
    expect(pageSource).toContain("현재 필터 CSV");
  });

  it("오답 노트 퀴즈 완료 결과를 링크와 카카오톡·모바일 공유로 제공한다", () => {
    const pageSource = readFileSync(new URL("../client/src/pages/MistakeNotebook.tsx", import.meta.url), "utf8");
    expect(pageSource).toContain("getQuizResultShareUrl");
    expect(pageSource).toContain("handleCopyQuizResultLink");
    expect(pageSource).toContain("Kakao?.Share?.sendDefault");
    expect(pageSource).toContain("navigator.share");
    expect(pageSource).toContain("카카오톡 공유");
  });
});
