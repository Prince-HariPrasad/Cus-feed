import { explain, extractDrivers, mockAnalysis } from "./rationale";
import type { Analysis, Sentiment } from "./types";

export const MODEL = "siebert/sentiment-roberta-large-english";

export function parsePrediction(payload: unknown): {
  sentiment: Sentiment;
  confidence: number;
} {
  const candidates =
    Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : payload;
  if (!Array.isArray(candidates) || candidates.length === 0)
    throw new Error("The model returned an unexpected response.");
  const predictions = candidates.map(
    (candidate: unknown): { sentiment: Sentiment; confidence: number } => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        !("label" in candidate) ||
        !("score" in candidate) ||
        (candidate.label !== "POSITIVE" && candidate.label !== "NEGATIVE") ||
        typeof candidate.score !== "number" ||
        !Number.isFinite(candidate.score) ||
        candidate.score < 0 ||
        candidate.score > 1
      ) {
        throw new Error(
          "The model returned an invalid sentiment or confidence score.",
        );
      }
      return { sentiment: candidate.label, confidence: candidate.score };
    },
  );
  return predictions.sort(
    (first, second) => second.confidence - first.confidence,
  )[0];
}

/** Call only from server code: the token must never reach the browser. */
export async function analyzeFeedback(
  text: string,
  options: { token?: string; fetcher?: typeof fetch } = {},
): Promise<Analysis> {
  const token = options.token ?? process.env.HF_TOKEN;
  if (!token) return mockAnalysis(text);
  const response = await (options.fetcher ?? fetch)(
    `https://router.huggingface.co/hf-inference/models/${MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, parameters: { truncation: true } }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(
      `Hugging Face is unavailable (HTTP ${response.status}). Check token permissions and model availability, then retry.`,
    );
  const prediction = parsePrediction(await response.json());
  const drivers = extractDrivers(text);
  return {
    ...prediction,
    source: "huggingface",
    drivers,
    rationale: explain(prediction.sentiment, drivers),
  };
}
