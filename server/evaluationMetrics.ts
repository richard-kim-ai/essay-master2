export type ScorePair = { humanScore: number; modelScore: number };

function finiteScore(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export function calculatePearsonCorrelation(pairs: ScorePair[]) {
  if (pairs.length < 2) return null;
  const humanMean = pairs.reduce((sum, pair) => sum + finiteScore(pair.humanScore), 0) / pairs.length;
  const modelMean = pairs.reduce((sum, pair) => sum + finiteScore(pair.modelScore), 0) / pairs.length;
  let numerator = 0;
  let humanVariance = 0;
  let modelVariance = 0;
  for (const pair of pairs) {
    const humanDelta = finiteScore(pair.humanScore) - humanMean;
    const modelDelta = finiteScore(pair.modelScore) - modelMean;
    numerator += humanDelta * modelDelta;
    humanVariance += humanDelta ** 2;
    modelVariance += modelDelta ** 2;
  }
  const denominator = Math.sqrt(humanVariance * modelVariance);
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4));
}

// 0~100 점수를 11개 등급으로 변환한 선형 가중 Cohen's kappa.
export function calculateQuadraticWeightedKappa(pairs: ScorePair[]) {
  if (pairs.length < 2) return null;
  const categoryCount = 11;
  const observed = Array.from({ length: categoryCount }, () => Array(categoryCount).fill(0));
  const humanDistribution = Array(categoryCount).fill(0);
  const modelDistribution = Array(categoryCount).fill(0);
  const toCategory = (score: number) => Math.min(10, Math.max(0, Math.round(finiteScore(score) / 10)));
  for (const pair of pairs) {
    const human = toCategory(pair.humanScore);
    const model = toCategory(pair.modelScore);
    observed[human][model] += 1;
    humanDistribution[human] += 1;
    modelDistribution[model] += 1;
  }
  let weightedObserved = 0;
  let weightedExpected = 0;
  for (let human = 0; human < categoryCount; human += 1) {
    for (let model = 0; model < categoryCount; model += 1) {
      const weight = ((human - model) ** 2) / ((categoryCount - 1) ** 2);
      weightedObserved += weight * observed[human][model] / pairs.length;
      weightedExpected += weight * (humanDistribution[human] * modelDistribution[model]) / (pairs.length ** 2);
    }
  }
  if (weightedExpected === 0) return null;
  return Number((1 - weightedObserved / weightedExpected).toFixed(4));
}

export function calculateThresholdRecall(pairs: ScorePair[], threshold = 70) {
  const positive = pairs.filter((pair) => finiteScore(pair.humanScore) >= threshold);
  if (positive.length === 0) return null;
  return Number((positive.filter((pair) => finiteScore(pair.modelScore) >= threshold).length / positive.length).toFixed(4));
}

export function getHumanEvaluationQualityMetrics(pairs: ScorePair[], minimumOfficialSample = 30) {
  const sampleCount = pairs.length;
  const isOfficial = sampleCount >= minimumOfficialSample;
  return {
    sampleCount,
    minimumOfficialSample,
    isOfficial,
    sampleWarning: isOfficial ? null : `인간 채점 표본이 ${minimumOfficialSample}건 미만이므로 공식 품질 기준으로 사용하지 않습니다.`,
    quadraticWeightedKappa: calculateQuadraticWeightedKappa(pairs),
    pearsonCorrelation: calculatePearsonCorrelation(pairs),
    thresholdRecall: calculateThresholdRecall(pairs),
  };
}
