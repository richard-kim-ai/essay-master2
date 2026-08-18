import type { CourseType } from "@shared/course";

type CourseWritingProfile = {
  label: string;
  audience: string;
  action: string;
  summaryFocus: string;
};

const COURSE_PROFILES: Record<CourseType, CourseWritingProfile> = {
  elementary: {
    label: "초등",
    audience: "우리 반 친구들과 학교생활을 하는 학생",
    action: "구체적인 약속을 정해 함께 실천해야 한다",
    summaryFocus: "문제의 원인, 친구들의 서로 다른 생각, 실천 방법",
  },
  middle_high: {
    label: "중고등",
    audience: "청소년과 학교 공동체",
    action: "근거를 비교한 뒤 실행 가능한 기준을 마련해야 한다",
    summaryFocus: "핵심 쟁점, 상반된 입장, 판단 기준과 대안",
  },
  high_univ: {
    label: "고등/대입",
    audience: "시민과 제도 설계자",
    action: "가치의 충돌과 제도적 효과를 검토해 정책 대안을 설계해야 한다",
    summaryFocus: "논제의 구조, 핵심 논거, 반론의 한계와 조건부 결론",
  },
  general_adult: {
    label: "일반/직장인",
    audience: "조직 구성원과 의사결정자",
    action: "이해관계와 실행 비용을 검토해 책임 있는 운영 기준을 합의해야 한다",
    summaryFocus: "업무·사회적 쟁점, 이해관계자별 영향, 실행 조건과 결론",
  },
};

function normalizedTopic(title: string) {
  return title
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/AI 문장 교정\s*-\s*/g, "")
    .replace(/요약 연습\s*-\s*/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

export function isLegacyRepeatedLearningContent(contentData: string) {
  return contentData.includes("그래서 이 문제는 매우 중요하고 중요하기 때문에")
    || contentData.includes("구체적인 기준과 보완 장치를 함께 마련해야 한다고 주장한다")
    || contentData.includes("사례의 세부 명칭보다 쟁점, 핵심 주장, 조건을 남기는 것이 중요하다");
}

export function buildCourseQuizContent(courseType: CourseType, title: string) {
  const profile = COURSE_PROFILES[courseType];
  const topic = normalizedTopic(title);
  const correct = `${topic}에 대해 ${profile.audience}의 상황을 살피고, ${profile.action}.`;
  return {
    prompt: `${profile.label} 과정의 표현·논증 교정 문제입니다. 다음 문장 중 중복을 줄이고 논지를 분명하게 다듬은 문장을 고르세요.`,
    sentence: `${topic}은 매우 중요하고 중요하므로 우리 모두가 꼭 반드시 관심을 가져야 한다.`,
    options: [
      correct,
      `${topic}은 정말로 아주 중요해서 중요한 일이다.`,
      `${topic}은 여러 가지가 있어서 생각해 볼 수 있다.`,
      `${topic}과 관계없이 다른 문제를 먼저 해결하면 된다.`,
    ],
    answer: correct,
    explanation: `‘중요하고 중요하다’, ‘꼭 반드시’처럼 같은 뜻을 겹쳐 쓰면 문장이 약해집니다. ${profile.label} 과정에서는 대상·판단 기준·실천 방향을 한 문장에 분명히 제시하는 연습이 필요합니다.`,
  };
}

export function buildCourseSummaryContent(courseType: CourseType, title: string) {
  const profile = COURSE_PROFILES[courseType];
  const topic = normalizedTopic(title);
  const prompt = `[${profile.label} 요약 연습 - ${topic}]

${topic}을 둘러싼 논의는 한 가지 답으로 끝나지 않는다. 한쪽에서는 현재 방식이 편리하거나 필요한 이유를 제시하고, 다른 쪽에서는 그 과정에서 생길 수 있는 부담과 부작용을 지적한다. 글쓴이는 두 주장을 단순히 나열하지 않고, ${profile.audience}이(가) 무엇을 기준으로 판단해야 하는지 검토한다. 결론에서는 ${profile.action}고 제안한다.

이 글을 3문장 이내로 요약하되, ${profile.summaryFocus}을 남기세요.`;
  return {
    prompt,
    keyPoints: [
      `${topic}의 핵심 쟁점`,
      "찬성·우려 입장의 근거 비교",
      "판단 기준과 실행 가능한 결론",
    ],
    modelAnswer: `${topic}은 편익과 부담이 함께 나타나는 쟁점이다. 글쓴이는 서로 다른 입장을 비교한 뒤, ${profile.audience}이(가) 판단 기준을 세워야 한다고 본다. 따라서 ${profile.action}는 결론을 제시한다.`,
    explanation: "좋은 요약은 원문의 사례를 길게 옮기지 않고 쟁점, 입장 비교, 결론의 조건을 압축합니다.",
  };
}
