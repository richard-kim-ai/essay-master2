import type { EvaluationRubric } from "./types";

export const essayMasterRubric: EvaluationRubric = {
  id: "essay_master_korean_v1",
  label: "논술 마스터 한국어 논술 루브릭",
  language: "ko",
  taskTypes: ["essay_master", "korean_school_essay", "admission_essay", "business_writing", "general_writing"],
  totalScale: { min: 0, max: 100, step: 1 },
  criteria: [
    {
      id: "claim",
      label: "주장 명확성",
      description: "글의 중심 주장과 주제문이 명확하고 과제 요구에 직접 답하는가.",
      weight: 0.2,
      scale: { min: 0, max: 5, step: 1 },
      anchors: [
        { score: 1, descriptor: "중심 주장이 흐릿하거나 과제와 어긋난다." },
        { score: 3, descriptor: "중심 주장은 있으나 범위나 태도가 다소 모호하다." },
        { score: 5, descriptor: "중심 주장과 태도가 분명하고 과제에 직접 답한다." },
      ],
    },
    {
      id: "evidence",
      label: "근거와 설명",
      description: "주장을 뒷받침하는 이유, 사례, 설명이 충분하고 관련성이 있는가.",
      weight: 0.22,
      scale: { min: 0, max: 5, step: 1 },
      anchors: [
        { score: 1, descriptor: "근거가 거의 없거나 주장과 연결되지 않는다." },
        { score: 3, descriptor: "근거가 있으나 구체성이나 설명이 부족하다." },
        { score: 5, descriptor: "근거가 구체적이며 주장과 자연스럽게 연결된다." },
      ],
    },
    {
      id: "organization",
      label: "구조와 일관성",
      description: "문단 구성, 전개 순서, 연결이 자연스럽고 통일성을 유지하는가.",
      weight: 0.2,
      scale: { min: 0, max: 5, step: 1 },
      anchors: [
        { score: 1, descriptor: "문단 흐름이 끊기고 중심 생각에서 벗어난다." },
        { score: 3, descriptor: "기본 구조는 있으나 연결과 전환이 약하다." },
        { score: 5, descriptor: "도입-전개-정리 흐름이 명확하고 일관된다." },
      ],
    },
    {
      id: "expression",
      label: "표현과 문장력",
      description: "문장이 정확하고 자연스러우며 불필요한 반복 없이 명료한가.",
      weight: 0.2,
      scale: { min: 0, max: 5, step: 1 },
      anchors: [
        { score: 1, descriptor: "비문, 반복, 모호한 표현이 자주 나타난다." },
        { score: 3, descriptor: "대체로 이해 가능하나 어색한 문장과 반복이 있다." },
        { score: 5, descriptor: "문장이 자연스럽고 간결하며 표현이 정확하다." },
      ],
    },
    {
      id: "task_fit",
      label: "과제 적합성",
      description: "제시문, 조건, 분량, 독자 수준을 충실히 반영했는가.",
      weight: 0.18,
      scale: { min: 0, max: 5, step: 1 },
      anchors: [
        { score: 1, descriptor: "과제 조건을 상당 부분 놓친다." },
        { score: 3, descriptor: "핵심 조건은 따르지만 일부 요구가 부족하다." },
        { score: 5, descriptor: "과제 조건과 대상 수준을 충실히 반영한다." },
      ],
    },
  ],
};

export const koreanAesEightTraitRubric: EvaluationRubric = {
  id: "korean_aes_8_trait_v1",
  label: "한국어 AES 8개 항목 루브릭",
  language: "ko",
  taskTypes: ["korean_school_essay", "general_writing", "essay_master"],
  totalScale: { min: 0, max: 100, step: 1 },
  criteria: [
    "task_understanding",
    "content",
    "organization",
    "expression",
    "grammar",
    "vocabulary",
    "coherence",
    "creativity",
  ].map((id, index) => ({
    id,
    label: ["과제 이해", "내용 충실성", "구성", "표현", "문법", "어휘", "응집성", "창의성"][index],
    description: "한국어 글 평가 데이터 및 교사 채점 기준에 맞춘 세부 평가 항목.",
    weight: 1 / 8,
    scale: { min: 0, max: 5, step: 1 },
    anchors: [
      { score: 1, descriptor: "매우 미흡" },
      { score: 3, descriptor: "보통" },
      { score: 5, descriptor: "우수" },
    ],
  })),
};

export const ieltsWritingRubric: EvaluationRubric = {
  id: "ielts_writing_v1",
  label: "IELTS Writing Band Rubric",
  language: "en",
  taskTypes: ["ielts_task_1", "ielts_task_2", "general_writing"],
  totalScale: { min: 0, max: 9, step: 0.5 },
  criteria: [
    ["task_response", "Task Achievement/Response"],
    ["coherence", "Coherence and Cohesion"],
    ["lexical", "Lexical Resource"],
    ["grammar", "Grammatical Range and Accuracy"],
  ].map(([id, label]) => ({
    id,
    label,
    description: "IELTS writing band descriptor aligned criterion.",
    weight: 0.25,
    scale: { min: 0, max: 9, step: 0.5 },
    anchors: [
      { score: 5, descriptor: "Limited or partially developed control." },
      { score: 7, descriptor: "Clear, effective, and mostly flexible control." },
      { score: 9, descriptor: "Fully operational, precise, natural command." },
    ],
  })),
};

