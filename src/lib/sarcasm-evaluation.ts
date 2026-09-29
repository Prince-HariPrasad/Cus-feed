export type LabeledFeedback = { text: string; sarcastic: boolean };

export function parseEvaluationData(jsonl: string): LabeledFeedback[] {
  const seen = new Set<string>();
  const records = jsonl.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const record = JSON.parse(line);
    if (!record || typeof record.text !== "string" || !record.text.trim() || record.text.trim().length > 2000 || typeof record.sarcastic !== "boolean") throw new Error("Each record must have text (1-2000 characters) and a boolean sarcastic label.");
    const text = record.text.trim();
    const key = text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) throw new Error("Duplicate feedback in evaluation data.");
    seen.add(key);
    return { text, sarcastic: record.sarcastic };
  });
  if (!records.some((record) => record.sarcastic) || !records.some((record) => !record.sarcastic)) throw new Error("Include both sarcastic and literal examples.");
  return records;
}

export function evaluateSarcasm(predictions: { sarcastic: boolean; score: number }[]) {
  if (!predictions.length) throw new Error("No paired predictions available.");
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  let squaredError = 0;
  const bins = Array.from({ length: 10 }, () => ({ count: 0, scoreSum: 0, positiveCount: 0 }));
  for (const { sarcastic, score } of predictions) {
    if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("Invalid model score.");
    if (score > 0.5) {
      if (sarcastic) truePositive++; else falsePositive++;
    } else {
      if (sarcastic) falseNegative++; else trueNegative++;
    }
    squaredError += (score - Number(sarcastic)) ** 2;
    const bin = bins[Math.min(9, Math.floor(score * 10))];
    bin.count++;
    bin.scoreSum += score;
    bin.positiveCount += Number(sarcastic);
  }
  const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
  return {
    count: predictions.length, threshold: 0.5,
    confusion: { truePositive, falsePositive, trueNegative, falseNegative },
    precision: ratio(truePositive, truePositive + falsePositive),
    recall: ratio(truePositive, truePositive + falseNegative),
    falsePositiveRate: ratio(falsePositive, falsePositive + trueNegative),
    f1: ratio(2 * truePositive, 2 * truePositive + falsePositive + falseNegative),
    brierScore: squaredError / predictions.length,
    expectedCalibrationError: bins.reduce((sum, bin) => sum + Math.abs(bin.scoreSum - bin.positiveCount), 0) / predictions.length,
    calibrationBins: bins.map((bin, index) => ({ lower: index / 10, upper: (index + 1) / 10, count: bin.count, meanScore: ratio(bin.scoreSum, bin.count), observedSarcasmRate: ratio(bin.positiveCount, bin.count) })),
  };
}