import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  firstQuestionText,
  patchQuestionContent,
  questionMetricLabels,
  questionText,
  readQuestionContent,
} from "@/lib/questionContent";

function Section({
  title,
  children,
  accent = false,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border p-4 sm:p-5 ${accent ? "border-indigo-100 bg-indigo-50/60 text-slate-900" : "border-slate-200 bg-white text-slate-900"}`}
    >
      <h4 className="mb-2 text-sm font-bold text-slate-700">{title}</h4>
      {children}
    </section>
  );
}
function Text({
  value,
  empty = "내용을 입력해주세요.",
}: {
  value: unknown;
  empty?: string;
}) {
  const text = questionText(value);
  return (
    <p
      className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-7 ${text ? "text-slate-900" : "text-slate-500"}`}
    >
      {text || empty}
    </p>
  );
}
function Items({ value }: { value: unknown }) {
  const items = Array.isArray(value) ? value : [];
  return items.length ? (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex min-w-0 gap-2">
          <span className="pt-1 text-xs font-semibold text-indigo-600">
            {i + 1}.
          </span>
          <Text value={item} />
        </li>
      ))}
    </ul>
  ) : (
    <Text value="" />
  );
}
export function QuestionContentView({
  contentData,
  toolType,
}: {
  contentData: string;
  toolType: string;
}) {
  const { content: c, invalid } = readQuestionContent(contentData);
  if (invalid)
    return (
      <p
        role="alert"
        className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
      >
        문항 내용을 읽을 수 없습니다. 문항 수정을 통해 내용을 다시 입력해주세요.
      </p>
    );
  const question = firstQuestionText(
    c.question,
    c.prompt,
    c.body,
    c.question_text
  );
  const passage = firstQuestionText(c.passage, c.text);
  const choices =
    Array.isArray(c.choices) && c.choices.length ? c.choices : c.options;
  const answer = firstQuestionText(c.correct_answer, c.correctAnswer, c.answer);
  const paragraphs = Array.isArray(c.paragraphs) ? c.paragraphs : [];
  const sample = c.sampleOutput ?? c.sample_output;
  return (
    <div className="min-w-0 space-y-4" data-testid="question-reading-view">
      <Section title="문항" accent>
        <Text value={question} />
      </Section>
      {passage && passage !== question && (
        <Section title="제시문">
          <Text value={passage} />
        </Section>
      )}
      {toolType === "quiz" && (
        <Section title="선택지">
          <ol className="space-y-2">
            {(Array.isArray(choices) ? choices : []).map(
              (choice: unknown, i: number) => {
                const correct = answer && questionText(choice) === answer;
                return (
                  <li
                    key={i}
                    className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 ${correct ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}
                  >
                    <span className="shrink-0 text-sm font-bold">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <Text value={choice} />
                      {correct && (
                        <span className="text-xs font-bold text-emerald-700">
                          정답
                        </span>
                      )}
                    </div>
                  </li>
                );
              }
            )}
          </ol>
        </Section>
      )}
      {toolType === "quiz" && (
        <Section title="정답">
          <Text value={answer} />
        </Section>
      )}
      {toolType === "reordering" && (
        <>
          <Section title="단락">
            <ol className="space-y-3">
              {paragraphs.map((p: any, i: number) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-1 text-xs font-bold text-indigo-600">
                    단락 {i + 1}
                  </p>
                  <Text value={p.content ?? p} />
                </li>
              ))}
            </ol>
          </Section>
          <Section title="정답 순서">
            <Text
              value={paragraphs
                .map((p: any, i: number) => ({
                  position: i + 1,
                  order: Number(p.correctOrder ?? i + 1),
                }))
                .sort((a: any, b: any) => a.order - b.order)
                .map((p: any) => `단락 ${p.position}`)
                .join(" → ")}
            />
          </Section>
        </>
      )}
      {toolType === "summary" && (
        <>
          <Section title="핵심 내용">
            <Items value={c.keyPoints ?? c.key_points} />
          </Section>
          <Section title="모범 답안">
            <Text
              value={firstQuestionText(
                c.model_answer,
                c.modelAnswer,
                c.reference_answer
              )}
            />
          </Section>
        </>
      )}
      {toolType === "topic_wizard" && (
        <>
          <Section title="주제 설정 가이드">
            <Items value={c.guidelines} />
          </Section>
          <Section title="작성 예시">
            {typeof sample === "object" && sample ? (
              <div className="space-y-2">
                {[
                  ["주제", sample.title],
                  ["입장", sample.stance],
                  ["핵심 주장", sample.mainArgument],
                ].map(([label, value]) =>
                  value ? (
                    <div key={label}>
                      <p className="text-xs font-bold text-slate-500">
                        {label}
                      </p>
                      <Text value={value} />
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <Text value={sample} />
            )}
          </Section>
        </>
      )}
      {toolType === "thesis_checklist" && (
        <>
          <Section title="주제문 점검 항목">
            <Items value={c.checklistItems ?? c.checklist_items} />
          </Section>
          <Section title="통과 기준">
            <Text value={c.passingStandard ?? c.passing_standard} />
          </Section>
        </>
      )}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Section title="해설">
          <Text
            value={firstQuestionText(
              c.explanation,
              c.answer_explanation,
              c.rationale
            )}
          />
        </Section>
        <Section title="학습 목표">
          <Text
            value={firstQuestionText(
              c.learning_objective,
              c.learningGoal,
              c.learning_goal
            )}
          />
        </Section>
      </div>
      {c.evaluation_criteria && (
        <Section title="평가 기준">
          <Text
            value={
              Array.isArray(c.evaluation_criteria)
                ? c.evaluation_criteria
                : typeof c.evaluation_criteria === "object"
                  ? Object.values(c.evaluation_criteria)
                  : c.evaluation_criteria
            }
          />
        </Section>
      )}
      {c.difficulty_metrics && (
        <details className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900">
          <summary className="cursor-pointer text-sm font-semibold">
            난이도 지표 보기
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(questionMetricLabels).map(([key, label]) => (
              <div key={key} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-600">{label}</dt>
                <dd className="mt-1 text-sm font-bold">
                  {c.difficulty_metrics[key] ?? "미설정"} / 5
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <Textarea
        aria-label={label}
        value={questionText(value)}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full min-w-0 bg-white text-sm leading-6 text-slate-900"
      />
    </label>
  );
}
export function QuestionContentEditor({
  contentData,
  toolType,
  onChange,
}: {
  contentData: string;
  toolType: string;
  onChange: (value: string) => void;
}) {
  const { content: c, invalid } = readQuestionContent(contentData);
  const set = (patch: Record<string, unknown>) =>
    onChange(patchQuestionContent(contentData, patch));
  const list = (label: string, key: string, raw: unknown, minimum = 3) => {
    const values = Array.isArray(raw) ? raw : [];
    const padded =
      values.length >= minimum
        ? values
        : [...values, ...Array(minimum - values.length).fill("")];
    return (
      <fieldset className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-bold text-slate-700">
          {label}
        </legend>
        {padded.map((value, i) => (
          <Field
            key={i}
            label={`${label} ${i + 1}`}
            value={value}
            rows={2}
            onChange={v =>
              set({
                [key]: padded.map((old, index) => (index === i ? v : old)),
              })
            }
          />
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => set({ [key]: [...padded, ""] })}
        >
          {label} 추가
        </Button>
      </fieldset>
    );
  };
  const choices =
    Array.isArray(c.choices) && c.choices.length
      ? c.choices
      : Array.isArray(c.options)
        ? c.options
        : [];
  const paddedChoices = Array.from({ length: 4 }, (_, i) =>
    questionText(choices[i])
  );
  const answer = firstQuestionText(c.correct_answer, c.correctAnswer, c.answer);
  const paragraphs = Array.isArray(c.paragraphs) ? c.paragraphs : [];
  const paddedParagraphs =
    paragraphs.length >= 3
      ? paragraphs
      : [
          ...paragraphs,
          ...Array.from({ length: 3 - paragraphs.length }, (_, i) => ({
            id: `p${paragraphs.length + i + 1}`,
            content: "",
            correctOrder: paragraphs.length + i + 1,
          })),
        ];
  const sample =
    typeof c.sampleOutput === "object" && c.sampleOutput ? c.sampleOutput : {};
  return (
    <div className="min-w-0 space-y-5" data-testid="question-form-editor">
      {invalid && (
        <p role="alert" className="text-sm text-rose-700">
          기존 본문을 읽을 수 없습니다. 필요한 내용을 입력해주세요.
        </p>
      )}
      <Field
        label="문항 본문"
        value={firstQuestionText(c.question, c.prompt, c.body)}
        rows={4}
        onChange={v => set({ question: v, prompt: v })}
      />
      <Field
        label="제시문"
        value={c.passage}
        rows={6}
        onChange={v => set({ passage: v })}
      />
      {toolType === "quiz" && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-bold">선택지와 정답</legend>
          {paddedChoices.map((value, i) => (
            <Field
              key={i}
              label={`선택지 ${i + 1}`}
              value={value}
              rows={2}
              onChange={v => {
                const next = paddedChoices.map((old, index) =>
                  index === i ? v : old
                );
                const nextAnswer = answer === value ? v : answer;
                set({
                  choices: next,
                  options: next,
                  correct_answer: nextAnswer,
                  answer: nextAnswer,
                });
              }}
            />
          ))}
          <label className="block space-y-2 text-sm font-semibold">
            정답 선택
            <select
              aria-label="정답 선택"
              value={paddedChoices.indexOf(answer)}
              onChange={e => {
                const v = paddedChoices[Number(e.target.value)] ?? "";
                set({ correct_answer: v, answer: v });
              }}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-slate-900"
            >
              <option value={-1}>정답을 선택해주세요</option>
              {paddedChoices.map((_, i) => (
                <option key={i} value={i}>
                  선택지 {i + 1}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      )}
      {toolType === "reordering" && (
        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-bold">단락과 정답 순서</legend>
          {paddedParagraphs.map((p: any, i: number) => (
            <div key={i} className="space-y-2">
              <Field
                label={`단락 ${i + 1} 본문`}
                value={p.content ?? p}
                onChange={v =>
                  set({
                    paragraphs: paddedParagraphs.map(
                      (old: any, index: number) =>
                        index === i ? { ...old, content: v } : old
                    ),
                  })
                }
              />
              <label className="block text-sm text-slate-600">
                단락 {i + 1} 정답 순서
                <Input
                  aria-label={`단락 ${i + 1} 정답 순서`}
                  type="number"
                  min={1}
                  max={paddedParagraphs.length}
                  value={p.correctOrder ?? i + 1}
                  onChange={e =>
                    set({
                      paragraphs: paddedParagraphs.map(
                        (old: any, index: number) =>
                          index === i
                            ? { ...old, correctOrder: Number(e.target.value) }
                            : old
                      ),
                    })
                  }
                  className="mt-1 w-24 bg-white"
                />
              </label>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set({
                paragraphs: [
                  ...paddedParagraphs,
                  {
                    id: `p${paddedParagraphs.length + 1}`,
                    content: "",
                    correctOrder: paddedParagraphs.length + 1,
                  },
                ],
              })
            }
          >
            단락 추가
          </Button>
        </fieldset>
      )}
      {toolType === "summary" && (
        <>
          {list("핵심 내용", "keyPoints", c.keyPoints)}
          <Field
            label="모범 답안"
            value={firstQuestionText(c.model_answer, c.modelAnswer)}
            rows={4}
            onChange={v => set({ model_answer: v, modelAnswer: v })}
          />
        </>
      )}
      {toolType === "topic_wizard" && (
        <>
          {list("주제 설정 가이드", "guidelines", c.guidelines)}
          {[
            ["주제 예시", "title"],
            ["입장 예시", "stance"],
            ["핵심 주장 예시", "mainArgument"],
          ].map(([label, key]) => (
            <Field
              key={key}
              label={label}
              value={sample[key]}
              onChange={v => set({ sampleOutput: { ...sample, [key]: v } })}
            />
          ))}
        </>
      )}
      {toolType === "thesis_checklist" && (
        <>
          {list("주제문 점검 항목", "checklistItems", c.checklistItems)}
          <Field
            label="통과 기준"
            value={c.passingStandard}
            onChange={v => set({ passingStandard: v })}
          />
        </>
      )}
      <Field
        label="해설"
        value={firstQuestionText(c.explanation, c.answer_explanation)}
        rows={4}
        onChange={v => set({ explanation: v })}
      />
      <Field
        label="학습 목표"
        value={firstQuestionText(
          c.learning_objective,
          c.learningGoal,
          c.learning_goal
        )}
        onChange={v => set({ learning_objective: v })}
      />
      {c.difficulty_metrics && (
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            난이도 지표 수정
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(questionMetricLabels).map(([key, label]) => (
              <label key={key} className="space-y-1 text-xs text-slate-700">
                {label}
                <Input
                  aria-label={label}
                  type="number"
                  min={1}
                  max={5}
                  value={c.difficulty_metrics[key] ?? ""}
                  onChange={e =>
                    set({
                      difficulty_metrics: {
                        ...c.difficulty_metrics,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                  className="bg-white text-slate-900"
                />
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
export default function QuestionContentReview(props: {
  contentData: string;
  toolType: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-800">
          {editing ? "문항 내용 수정" : "문항 미리보기"}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "미리보기로 돌아가기" : "문항 수정"}
        </Button>
      </div>
      {editing ? (
        <QuestionContentEditor {...props} />
      ) : (
        <QuestionContentView {...props} />
      )}
    </div>
  );
}
