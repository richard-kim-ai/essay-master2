// 페이지 상단 이동 바(PageNavigator)가 보여 줄 '현재 위치' 정보.
// 경로 패턴 → 화면 이름과 상위 화면. 상위 화면을 따라 올라가며 홈까지의 경로(breadcrumb)를 만든다.

export interface PageTrailItem {
  label: string;
  // href가 없으면 링크 없는 구분 이름(예: '학습 도구')
  href?: string;
}

interface PageRoute {
  pattern: string;
  label: string;
  // 상위 화면의 경로 패턴(이 표 안의 pattern)
  parent?: string;
  // 링크 없는 그룹 이름
  group?: string;
}

const ROUTES: PageRoute[] = [
  { pattern: "/curriculum", label: "커리큘럼" },
  { pattern: "/curriculum/:courseType/:level", label: "레슨 목록", parent: "/curriculum" },
  { pattern: "/workbook/:courseType/:level", label: "워크북", parent: "/curriculum" },
  { pattern: "/essay-archive", label: "아카이브" },
  { pattern: "/pricing", label: "요금정책" },
  { pattern: "/checkout", label: "이용권 결제", parent: "/pricing" },
  { pattern: "/sample", label: "샘플 체험" },
  { pattern: "/quiz", label: "AI 문장 교정", group: "학습 도구" },
  { pattern: "/paragraph-reordering", label: "단락 재구성", group: "학습 도구" },
  { pattern: "/summary-practice", label: "요약 연습", group: "학습 도구" },
  { pattern: "/mistake-notebook", label: "오답 노트", group: "학습 도구" },
  { pattern: "/topic-wizard", label: "주제 설정", group: "학습 도구" },
  { pattern: "/thesis-checklist", label: "주제문 점검", group: "학습 도구" },
  { pattern: "/ai-guide-history", label: "AI 가이드 기록", group: "학습 도구" },
  { pattern: "/writing-examples", label: "글쓰기 예시", group: "학습 도구" },
  { pattern: "/mypage", label: "마이페이지" },
  { pattern: "/dashboard", label: "마이페이지" },
  { pattern: "/dashboard-detail", label: "학습 대시보드", parent: "/mypage" },
  { pattern: "/my-assignments", label: "내 과제", parent: "/mypage" },
  { pattern: "/my-writings", label: "내 글·첨삭 기록", parent: "/mypage" },
  { pattern: "/ai-auto-feedback", label: "AI 자동 첨삭", parent: "/mypage" },
  { pattern: "/ai-feedback-compare/:id", label: "AI 첨삭 비교", parent: "/ai-auto-feedback" },
  { pattern: "/essay-submission", label: "글 제출", parent: "/mypage" },
  { pattern: "/offline-essays", label: "오프라인 글", parent: "/mypage" },
  { pattern: "/teacher-feedback/:essayId", label: "교사 첨삭", parent: "/mypage" },
  { pattern: "/certificate", label: "수료증", parent: "/mypage" },
  { pattern: "/notifications", label: "알림", parent: "/mypage" },
  { pattern: "/teacher-mypage", label: "교사 마이페이지" },
  { pattern: "/teacher/writing-examples", label: "글쓰기 예시 관리", parent: "/teacher-mypage" },
  { pattern: "/teacher/settlement", label: "정산", parent: "/teacher-mypage" },
  { pattern: "/parent-portal", label: "학부모 포털" },
  { pattern: "/admin", label: "관리자" },
  { pattern: "/admin/certificates", label: "수료증 관리", parent: "/admin" },
  { pattern: "/admin/curriculum", label: "커리큘럼 관리", parent: "/admin" },
  { pattern: "/admin/question-bank", label: "문제은행", parent: "/admin" },
  { pattern: "/admin/evaluation-models", label: "평가 모델", parent: "/admin" },
  { pattern: "/admin/theory-content", label: "이론 콘텐츠", parent: "/admin" },
  { pattern: "/admin/lesson-connections", label: "레슨 연결", parent: "/admin" },
  { pattern: "/admin/student/:id", label: "학생 상세", parent: "/admin" },
  { pattern: "/admin/social-providers", label: "소셜 로그인 설정", parent: "/admin" },
  { pattern: "/admin/terms", label: "약관·정책", parent: "/admin" },
  { pattern: "/admin/guardian-consents", label: "보호자 동의", parent: "/admin" },
  { pattern: "/admin/billing", label: "결제 관리", parent: "/admin" },
  { pattern: "/admin/ai-governance", label: "AI 운영", parent: "/admin" },
  { pattern: "/admin/academic-permissions", label: "학사 권한", parent: "/admin" },
  { pattern: "/master-admin", label: "마스터 관리" },
];

function matches(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

export function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0] || "/";
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
}

function findRoute(pattern: string | undefined): PageRoute | undefined {
  return pattern ? ROUTES.find((candidate) => candidate.pattern === pattern) : undefined;
}

export interface PageTrail {
  items: PageTrailItem[]; // 홈 다음부터 현재 화면까지
  // 이전 화면 기록이 없을 때 돌아갈 곳
  fallbackHref: string;
  fallbackLabel: string;
}

// 홈('/')이나 표에 없는 경로는 null — 이동 바를 보여 주지 않는다.
export function getPageTrail(rawPath: string): PageTrail | null {
  const path = normalizePath(rawPath);
  if (path === "/") return null;
  const route = ROUTES.find((candidate) => matches(candidate.pattern, path));
  if (!route) return null;

  const items: PageTrailItem[] = [];
  // 상위 화면의 상위까지 거슬러 올라간다(예: AI 첨삭 비교 → AI 자동 첨삭 → 마이페이지).
  const ancestors: PageRoute[] = [];
  for (let cursor = findRoute(route.parent); cursor; cursor = findRoute(cursor.parent)) ancestors.unshift(cursor);
  for (const ancestor of ancestors) items.push({ label: ancestor.label, href: ancestor.pattern.includes(":") ? undefined : ancestor.pattern });
  if (route.group) items.push({ label: route.group });
  items.push({ label: route.label });

  const lastLinked = [...items].reverse().find((item) => item.href);
  return {
    items,
    fallbackHref: lastLinked?.href ?? "/",
    fallbackLabel: lastLinked?.label ?? "홈",
  };
}
