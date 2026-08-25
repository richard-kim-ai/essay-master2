export type CurriculumTheoryExample = {
  concept: string | null;
  exampleLabel: string;
  exampleText: string;
  wrongExample: string | null;
  improvedExample: string | null;
};

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseCurriculumTheoryExample(contentData?: string | null): CurriculumTheoryExample | null {
  if (!contentData?.trim()) return null;

  try {
    const content = JSON.parse(contentData) as Record<string, unknown>;
    const similarExample = content.textbook_similar_example as Record<string, unknown> | undefined;
    const exampleText = optionalText(similarExample?.text) ?? optionalText(content.improved_example);
    if (!exampleText) return null;

    return {
      concept: optionalText(content.core_concept),
      exampleLabel: optionalText(similarExample?.label) ?? "생성된 적용 예문",
      exampleText,
      wrongExample: optionalText(content.wrong_example),
      improvedExample: optionalText(content.improved_example),
    };
  } catch {
    return null;
  }
}
