// AI 호출 비용 추정(관리자 대시보드용).
// DB에는 입력·출력 구분 없이 합계 토큰만 저장되고 실제로 응답한 모델명도 기록되지 않으므로,
// 우선 사용하는 모델(gpt-5-mini)의 공개 API 정가와 출력 비중 가정으로 범위를 계산한 "추정"이다.
// 실제 청구액과 다를 수 있다(Manus 플랫폼 크레딧·에이전트 작업 비용과는 별개).
export const AI_COST_ASSUMPTIONS = {
  model: "gpt-5-mini",
  inputUsdPerMillion: 0.25,
  outputUsdPerMillion: 2.0,
  // 추론 모델은 숨은 추론 토큰도 출력으로 계산되므로 출력 비중을 범위로 가정한다.
  outputShareLow: 0.3,
  outputShareMid: 0.5,
  outputShareHigh: 0.7,
  krwPerUsd: 1400,
} as const;

export type AiCostEstimate = { low: number; mid: number; high: number };

const krwAt = (tokens: number, outputShare: number) => {
  const { inputUsdPerMillion, outputUsdPerMillion, krwPerUsd } = AI_COST_ASSUMPTIONS;
  const blendedUsdPerMillion = inputUsdPerMillion * (1 - outputShare) + outputUsdPerMillion * outputShare;
  return (tokens / 1_000_000) * blendedUsdPerMillion * krwPerUsd;
};

/** 토큰 수에 대한 추정 비용(원, 소수 포함). 토큰이 0 이하이거나 숫자가 아니면 모두 0이다. */
export function estimateAiCostKrw(tokens: number): AiCostEstimate {
  const safe = Number.isFinite(tokens) && tokens > 0 ? tokens : 0;
  const { outputShareLow, outputShareMid, outputShareHigh } = AI_COST_ASSUMPTIONS;
  return { low: krwAt(safe, outputShareLow), mid: krwAt(safe, outputShareMid), high: krwAt(safe, outputShareHigh) };
}

const krwNumber = (value: number) => (!Number.isFinite(value) || value <= 0 ? "0" : value < 1 ? value.toFixed(1) : Math.round(value).toLocaleString("ko-KR"));

/** 화면 표시용: 1원 미만은 소수 한 자리, 그 이상은 정수로 반올림해 "12원"처럼 만든다. */
export function formatKrw(value: number): string {
  return `${krwNumber(value)}원`;
}

/** "약 26원 (18~34원)" 형태의 문구. */
export function describeAiCost(estimate: AiCostEstimate): string {
  return `약 ${formatKrw(estimate.mid)} (${krwNumber(estimate.low)}~${formatKrw(estimate.high)})`;
}
