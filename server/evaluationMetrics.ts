export function pearsonCorrelation(actual: number[], predicted: number[]) {
  if (actual.length !== predicted.length || actual.length < 2) return null;
  const actualMean = actual.reduce((sum, value) => sum + value, 0) / actual.length;
  const predictedMean = predicted.reduce((sum, value) => sum + value, 0) / predicted.length;
  const numerator = actual.reduce((sum, value, index) => sum + (value - actualMean) * (predicted[index] - predictedMean), 0);
  const actualVariance = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  const predictedVariance = predicted.reduce((sum, value) => sum + (value - predictedMean) ** 2, 0);
  const denominator = Math.sqrt(actualVariance * predictedVariance);
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4));
}

export function quadraticWeightedKappa(actual: number[], predicted: number[], min = 0, max = 100) {
  if (actual.length !== predicted.length || actual.length === 0 || max <= min) return null;
  const size = max - min + 1;
  const observed = Array.from({ length: size }, () => Array<number>(size).fill(0));
  actual.forEach((value, index) => observed[clamp(value, min, max) - min][clamp(predicted[index], min, max) - min] += 1);
  const actualHistogram = Array<number>(size).fill(0);
  const predictedHistogram = Array<number>(size).fill(0);
  actual.forEach((value, index) => { actualHistogram[clamp(value, min, max) - min] += 1; predictedHistogram[clamp(predicted[index], min, max) - min] += 1; });
  let observedLoss = 0;
  let expectedLoss = 0;
  const total = actual.length;
  for (let row = 0; row < size; row += 1) for (let column = 0; column < size; column += 1) {
    const weight = ((row - column) ** 2) / ((size - 1) ** 2 || 1);
    observedLoss += weight * observed[row][column] / total;
    expectedLoss += weight * actualHistogram[row] * predictedHistogram[column] / (total ** 2);
  }
  return expectedLoss === 0 ? 1 : Number((1 - observedLoss / expectedLoss).toFixed(4));
}

export function recallAtThreshold(actual: number[], predicted: number[], threshold = 60) {
  if (actual.length !== predicted.length || actual.length === 0) return null;
  const positives = actual.map((value) => value >= threshold);
  const positiveCount = positives.filter(Boolean).length;
  if (positiveCount === 0) return null;
  const truePositives = positives.reduce((sum, expected, index) => sum + (expected && predicted[index] >= threshold ? 1 : 0), 0);
  return Number((truePositives / positiveCount).toFixed(4));
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, Math.round(value))); }
