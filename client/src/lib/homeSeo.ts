export const HOME_SEO = {
  title: "논술 마스터 | 초등부터 성인까지 단계별 글쓰기 학습과 AI 맞춤 첨삭, 전문 첨삭 교사 피드백",
  description: "논술 마스터에서 초등·중고등·대입·성인 과정별 커리큘럼으로 글쓰기의 기초부터 논리적 표현까지 익혀보세요. AI 맞춤 첨삭과 전문 교사 피드백, 문장 교정·단락 재구성·요약 연습으로 부족한 부분을 보완하고, 학습 진도와 오답 기록을 확인하며 나에게 맞는 다음 단계로 이어가세요.",
  keywords: ["논술 교육", "AI 논술 첨삭", "단계별 글쓰기", "초등 논술", "대입 논술", "문장 교정", "요약 연습"],
} as const;

/** 홈 진입 시 적용하고 다른 경로로 이동할 때 기존 메타 정보를 복원한다. */
export function applyHomeSeo(): () => void {
  const previousTitle = document.title;
  document.title = HOME_SEO.title;
  const changes: Array<{ element: HTMLMetaElement; previous: string | null; created: boolean }> = [];
  const setMeta = (attribute: "name" | "property", key: string, value: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    const created = !element;
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    changes.push({ element, previous: element.getAttribute("content"), created });
    element.setAttribute("content", value);
  };
  setMeta("name", "description", HOME_SEO.description);
  setMeta("name", "keywords", HOME_SEO.keywords.join(", "));
  setMeta("property", "og:title", HOME_SEO.title);
  setMeta("property", "og:description", HOME_SEO.description);
  setMeta("name", "twitter:title", HOME_SEO.title);
  setMeta("name", "twitter:description", HOME_SEO.description);
  return () => {
    document.title = previousTitle;
    for (const { element, previous, created } of changes) {
      if (created) element.remove();
      else if (previous === null) element.removeAttribute("content");
      else element.setAttribute("content", previous);
    }
  };
}
