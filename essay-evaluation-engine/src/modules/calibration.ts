export type CalibrationPoint = {
  rawScore: number;
  humanScore: number;
};

export type LinearCalibration = {
  slope: number;
  intercept: number;
  sampleSize: number;
};

export function fitLinearCalibration(points: CalibrationPoint[]): LinearCalibration {
  if (points.length < 2) {
    return { slope: 1, intercept: 0, sampleSize: points.length };
  }

  const xMean = points.reduce((sum, point) => sum + point.rawScore, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.humanScore, 0) / points.length;
  const variance = points.reduce((sum, point) => sum + (point.rawScore - xMean) ** 2, 0);

  if (variance === 0) {
    return { slope: 1, intercept: yMean - xMean, sampleSize: points.length };
  }

  const covariance = points.reduce(
    (sum, point) => sum + (point.rawScore - xMean) * (point.humanScore - yMean),
    0,
  );
  const slope = covariance / variance;

  return {
    slope,
    intercept: yMean - slope * xMean,
    sampleSize: points.length,
  };
}

export function applyLinearCalibration(rawScore: number, calibration: LinearCalibration, min: number, max: number): number {
  const calibrated = rawScore * calibration.slope + calibration.intercept;
  return Math.min(max, Math.max(min, Math.round(calibrated * 100) / 100));
}
