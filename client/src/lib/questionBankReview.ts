const QA_LABELS: Record<string, string> = {
  malformed_json: "본문 데이터의 JSON 형식을 확인해주세요.",
  missing_question_or_passage: "문항 본문 또는 제시문을 입력해주세요.",
  missing_explanation: "문항 해설을 입력해주세요.",
  missing_learning_objective: "문항 학습 목표를 입력해주세요.",
  missing_answer_or_rubric: "정답·모범 답안 또는 평가 기준을 입력해주세요.",
  difficulty_metrics_failed: "난이도 지표 7개를 1~5의 정수로 입력해주세요.",
  human_review_required: "사람 검수 체크리스트를 완료해주세요.",
  quiz_structure_failed:
    "퀴즈 보기 4개와 보기 중 하나에 정확히 대응하는 정답이 필요합니다.",
  reordering_structure_failed:
    "단락별 본문과 중복 없는 정답 순서를 확인해주세요.",
  summary_structure_failed: "요약 제시문과 모범 답안을 확인해주세요.",
  topic_wizard_structure_failed: "주제 설정 가이드 3개 이상을 입력해주세요.",
  checklist_structure_failed: "주제문 점검 항목 3개 이상을 입력해주세요.",
  duplicate_blocked:
    "기존 문항과 유사도가 높습니다. 본문과 내용을 수정해주세요.",
  placeholder_blocked: "예시용 임시 문구를 실제 문항 내용으로 변경해주세요.",
  answer_position_pattern: "같은 묶음의 퀴즈 정답 위치가 반복됩니다.",
  choice_length_bias: "정답이 선택지 길이로 드러나지 않도록 수정해주세요.",
  choice_length_variance_high: "선택지 문장 길이 차이를 줄여주세요.",
  korean_content_required:
    "문항 제목·본문·해설·학습 목표를 한국어로 작성해주세요.",
  writing_objective_required:
    "직무·설비 점검이 아닌 주장·근거·요약·문장 표현 등 논술 학습 목표에 맞게 수정해주세요.",
};

export function questionBankIssueLabel(issue: string): string {
  return QA_LABELS[issue] ?? "문항 품질 기준을 확인하고 내용을 수정해주세요.";
}

export function validateQuestionBankRequiredFields(
  contentData: string
): string[] {
  let content: Record<string, unknown>;
  try {
    content = JSON.parse(contentData);
    if (!content || typeof content !== "object" || Array.isArray(content))
      return ["malformed_json"];
  } catch {
    return ["malformed_json"];
  }
  const hasText = (...values: unknown[]) =>
    values.some(value => typeof value === "string" && value.trim().length > 0);
  const issues: string[] = [];
  if (!hasText(content.question, content.prompt, content.passage))
    issues.push("missing_question_or_passage");
  if (!hasText(content.explanation)) issues.push("missing_explanation");
  if (
    content.generation_origin === "ai_generated" &&
    !hasText(content.learning_objective)
  )
    issues.push("missing_learning_objective");
  return issues;
}
