// 원문과 AI 첨삭 답안의 차이를 단어 단위로 계산한다(AI 첨삭 비교 화면의 색 표시·변경 목록용).
// 단어 = 공백으로 구분한 덩어리(조사·어미가 붙은 채). "기술은"→"기술이"처럼 한국어 표현 변경도 잡힌다.

export type DiffOpType = "equal" | "insert" | "delete";

export interface DiffOp {
  type: DiffOpType;
  /** 원문 쪽 텍스트(equal·delete) — 뒤 공백·줄바꿈 포함 */
  before?: string;
  /** 첨삭 답안 쪽 텍스트(equal·insert) — 뒤 공백·줄바꿈 포함 */
  after?: string;
  /** 같은 수정 묶음의 번호(1부터). equal에는 없다. */
  changeId?: number;
}

export interface DiffChange {
  id: number;
  kind: "replace" | "insert" | "delete";
  before: string;
  after: string;
}

export interface DiffResult {
  ops: DiffOp[];
  changes: DiffChange[];
  addedWords: number;
  removedWords: number;
  /** 원문 단어 중 바뀐(삭제되거나 대체된) 비율, 0~100 */
  changedPercent: number;
  identical: boolean;
}

// 이보다 크면(단어 수 곱) 정밀 비교를 포기하고 앞뒤 공통 부분만 빼고 통째로 바뀐 것으로 본다.
const MAX_DP_CELLS = 16_000_000;

interface Token {
  key: string; // 비교용(공백 제거)
  text: string; // 표시용(뒤 공백 포함)
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\S+\s*/g;
  const leading = text.match(/^\s+/)?.[0] ?? "";
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const chunk = match[0];
    tokens.push({ key: chunk.trim(), text: tokens.length === 0 ? leading + chunk : chunk });
  }
  return tokens;
}

function lcsOps(a: Token[], b: Token[]): DiffOp[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start].key === b[start].key) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1].key === b[endB - 1].key) {
    endA -= 1;
    endB -= 1;
  }

  const ops: DiffOp[] = [];
  for (let i = 0; i < start; i += 1) ops.push({ type: "equal", before: a[i].text, after: b[i].text });

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;

  if (n === 0 || m === 0 || (n + 1) * (m + 1) > MAX_DP_CELLS) {
    for (const token of midA) ops.push({ type: "delete", before: token.text });
    for (const token of midB) ops.push({ type: "insert", after: token.text });
  } else {
    const width = m + 1;
    const table = new Uint16Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        table[i * width + j] = midA[i].key === midB[j].key ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i].key === midB[j].key) {
        ops.push({ type: "equal", before: midA[i].text, after: midB[j].text });
        i += 1;
        j += 1;
      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
        ops.push({ type: "delete", before: midA[i].text });
        i += 1;
      } else {
        ops.push({ type: "insert", after: midB[j].text });
        j += 1;
      }
    }
    for (; i < n; i += 1) ops.push({ type: "delete", before: midA[i].text });
    for (; j < m; j += 1) ops.push({ type: "insert", after: midB[j].text });
  }

  for (let k = 0; k < a.length - endA; k += 1) ops.push({ type: "equal", before: a[endA + k].text, after: b[endB + k].text });
  return ops;
}

export function diffTexts(original: string, revised: string): DiffResult {
  const a = tokenize(original);
  const b = tokenize(revised);
  const rawOps = lcsOps(a, b);

  // 연속한 삭제·추가를 하나의 수정 묶음으로 묶고 번호를 붙인다.
  const ops: DiffOp[] = [];
  const changes: DiffChange[] = [];
  let index = 0;
  while (index < rawOps.length) {
    if (rawOps[index].type === "equal") {
      ops.push(rawOps[index]);
      index += 1;
      continue;
    }
    const group: DiffOp[] = [];
    while (index < rawOps.length && rawOps[index].type !== "equal") {
      group.push(rawOps[index]);
      index += 1;
    }
    const id = changes.length + 1;
    const before = group.filter((op) => op.type === "delete").map((op) => op.before).join("").trim();
    const after = group.filter((op) => op.type === "insert").map((op) => op.after).join("").trim();
    changes.push({ id, kind: before && after ? "replace" : after ? "insert" : "delete", before, after });
    // 화면에서는 삭제를 먼저, 추가를 나중에 보여 준다.
    for (const op of group.filter((candidate) => candidate.type === "delete")) ops.push({ ...op, changeId: id });
    for (const op of group.filter((candidate) => candidate.type === "insert")) ops.push({ ...op, changeId: id });
  }

  const removedWords = ops.filter((op) => op.type === "delete").length;
  const addedWords = ops.filter((op) => op.type === "insert").length;
  return {
    ops,
    changes,
    addedWords,
    removedWords,
    changedPercent: a.length === 0 ? 0 : Math.min(100, Math.round((removedWords / a.length) * 100)),
    identical: changes.length === 0,
  };
}
