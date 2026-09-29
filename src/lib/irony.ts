import { IRONY_MODEL, IRONY_THRESHOLD, type IronyResult } from "./types";

export function parseIronyScore(payload: unknown): number {
  const candidates = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : payload;
  if (!Array.isArray(candidates) || candidates.length !== 2) throw new Error("Irony model must return both classes.");
  const scores = new Map<string, number>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || typeof candidate.label !== "string" || typeof candidate.score !== "number" || !Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1) {
      throw new Error("Irony model returned an invalid score.");
    }
    const label = candidate.label.toLowerCase();
    const normalized = label === "label_0" ? "non_irony" : label === "label_1" ? "irony" : label;
    if (!["irony", "non_irony"].includes(normalized) || scores.has(normalized)) throw new Error("Irony model returned unexpected or duplicate labels.");
    scores.set(normalized, candidate.score);
  }
  const irony = scores.get("irony");
  const nonIrony = scores.get("non_irony");
  if (irony === undefined || nonIrony === undefined || Math.abs(irony + nonIrony - 1) > 0.01) throw new Error("Irony model returned an invalid score distribution.");
  return irony;
}

export async function analyzeIrony(text: string, token: string, fetcher: typeof fetch): Promise<IronyResult> {
  try {
    const response = await fetcher(`https://router.huggingface.co/hf-inference/models/${IRONY_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text, parameters: { top_k: 2, truncation: true } }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) return { status: "unavailable", reason: `Hugging Face returned HTTP ${response.status}.` };
    const score = parseIronyScore(await response.json());
    return { status: "available", score, flagged: score > IRONY_THRESHOLD };
  } catch (error) {
    return { status: "unavailable", reason: error instanceof Error && error.name === "TimeoutError" ? "The irony request timed out." : "The irony request failed or returned an invalid response." };
  }
}