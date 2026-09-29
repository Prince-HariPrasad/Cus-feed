import { analyzeStandaloneFeedback, explain, extractDrivers } from "./rationale";
import { analyzeIrony } from "./irony";
import { analyzeWithDeberta, type DebertaOptions } from "./deberta";
import { CARDIFF_MODEL, type FinalScore, type IronyResult, type SentimentDashboardResult, type ThreeWaySentiment } from "./types";

// Discounts literal sentiment confidence by the irony score; a display heuristic, not a calibrated probability.
export function computeFinalScore(literalConfidence: number, irony: IronyResult): FinalScore | null {
  if (irony.status !== "available") return null;
  const adjustedConfidence = literalConfidence * (1 - irony.score);
  const recommendation = irony.flagged
    ? "Possible sarcasm outweighs the literal reading; verify manually before acting."
    : adjustedConfidence >= 0.7
      ? "Low sarcasm risk and strong sentiment; the literal reading looks reliable."
      : "Sentiment is not strongly held once sarcasm risk is considered; review if it matters.";
  return { literalConfidence, ironyScore: irony.score, adjustedConfidence, recommendation };
}

export function parseCardiffScores(payload: unknown): Record<ThreeWaySentiment, number> {
  const candidates = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : payload;
  if (!Array.isArray(candidates) || candidates.length !== 3) {
    throw new Error("Cardiff must return scores for positive, neutral, and negative.");
  }
  const scores: Partial<Record<ThreeWaySentiment, number>> = {};
  const aliases: Record<string, ThreeWaySentiment> = {
    positive: "POSITIVE", neutral: "NEUTRAL", negative: "NEGATIVE",
    label_0: "NEGATIVE", label_1: "NEUTRAL", label_2: "POSITIVE",
  };
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || typeof candidate.label !== "string" || typeof candidate.score !== "number" || !Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1) {
      throw new Error("Cardiff returned an invalid sentiment score.");
    }
    const label = aliases[candidate.label.toLowerCase()];
    if (!label || scores[label] !== undefined) throw new Error("Cardiff returned unexpected or duplicate labels.");
    scores[label] = candidate.score;
  }
  if (scores.POSITIVE === undefined || scores.NEUTRAL === undefined || scores.NEGATIVE === undefined || Math.abs(scores.POSITIVE + scores.NEUTRAL + scores.NEGATIVE - 1) > 0.01) {
    throw new Error("Cardiff returned an incomplete or invalid score distribution.");
  }
  return scores as Record<ThreeWaySentiment, number>;
}

export function explainCardiffScores(text: string, sentiment: ThreeWaySentiment, scores: Record<ThreeWaySentiment, number>): string {
  const drivers = extractDrivers(text);
  const ranked = (Object.entries(scores) as [ThreeWaySentiment, number][]).sort((first, second) => second[1] - first[1]);
  const split = `Positive ${(scores.POSITIVE * 100).toFixed(1)}%, neutral ${(scores.NEUTRAL * 100).toFixed(1)}%, negative ${(scores.NEGATIVE * 100).toFixed(1)}%.`;
  const decisive = scores[sentiment] >= 0.8 && ranked[0][1] - ranked[1][1] >= 0.2;
  const summary = `${split} ${decisive ? `The model strongly favors ${sentiment.toLowerCase()}; this is a model score, not a guarantee of correctness.` : `The score split is mixed or ambiguous; ${sentiment.toLowerCase()} is the leading label, but manual review is recommended.`}`;
  if (sentiment !== "NEUTRAL" && drivers.some((driver) => driver.sentiment === sentiment)) return `${summary} ${explain(sentiment, drivers)}`;
  return `${summary} ${drivers.length ? "The phrase helper found emotional cues but none that directly support the leading label." : "No driver phrases matched; this justification describes the score distribution rather than a specific cause in the text."}`;
}

export async function analyzeWithCardiff(
  text: string,
  options: { token?: string; fetcher?: typeof fetch; deberta?: DebertaOptions } = {},
): Promise<SentimentDashboardResult> {
  const token = options.token ?? process.env.HF_TOKEN;
  if (!token) {
    const demo = analyzeStandaloneFeedback(text);
    const scores = { POSITIVE: 0.15, NEUTRAL: 0.15, NEGATIVE: 0.15 };
    scores[demo.sentiment] = 0.7;
    return { ...demo, justification: `${demo.justification} Irony detection was not run in demo mode.`, scores, model: "Phrase-based demo (no model called)", source: "demo", irony: { status: "not-run" }, experimentalSarcasm: await analyzeWithDeberta(text, { ...options.deberta, token: "" }), final: null };
  }
  const fetcher = options.fetcher ?? fetch;
  const [response, irony, experimentalSarcasm] = await Promise.all([
    fetcher(
    `https://router.huggingface.co/hf-inference/models/${CARDIFF_MODEL}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text, parameters: { top_k: 3, truncation: true } }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    },
    ),
    analyzeIrony(text, token, fetcher),
    analyzeWithDeberta(text, { token, fetcher, ...options.deberta }),
  ]);
  if (!response.ok) throw new Error(`Hugging Face Cardiff inference failed (HTTP ${response.status}). Check token permissions, credits, and model availability on HF Inference. No demo result was substituted.`);
  const scores = parseCardiffScores(await response.json());
  const labels: ThreeWaySentiment[] = ["NEUTRAL", "POSITIVE", "NEGATIVE"];
  const sentiment = labels.reduce((best, label) => scores[label] > scores[best] ? label : best);
  const ironyNote = irony.status === "available"
    ? irony.flagged
      ? ` Possible sarcasm detected (irony score ${irony.score.toFixed(2)}); the literal wording may not reflect true intent. Review manually; the sentiment scores have not been adjusted.`
      : ` Irony was not flagged (irony score ${irony.score.toFixed(2)}); this does not rule out sarcasm.`
    : irony.status === "unavailable"
      ? ` Irony detection unavailable: ${irony.reason} Sarcasm could not be assessed; review manually if suspected.`
      : " Irony detection was not run.";
  const justification = explainCardiffScores(text, sentiment, scores) + ironyNote;
  return { sentiment, scores, model: CARDIFF_MODEL, source: "huggingface", justification, irony, experimentalSarcasm, final: computeFinalScore(scores[sentiment], irony) };
}