import { parseIronyScore } from "./irony";
import { DEBERTA_BASE_MODEL, type ExperimentalSarcasmResult } from "./types";

export type DebertaOptions = {
  token?: string;
  model?: string;
  endpoint?: string;
  fetcher?: typeof fetch;
};

export function parseSarcasmScore(payload: unknown): number {
  const candidates = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : payload;
  if (!Array.isArray(candidates)) throw new Error("Expected two labeled scores.");
  return parseIronyScore(candidates.map((candidate) => {
    if (!candidate || typeof candidate.label !== "string") throw new Error("Missing sarcasm label.");
    const label = candidate.label.toLowerCase();
    if (label !== "sarcastic" && label !== "non_sarcastic") throw new Error("Use explicit sarcastic and non_sarcastic labels in the trained model config.");
    return { label: label === "sarcastic" ? "irony" : "non_irony", score: candidate.score };
  }));
}

export async function analyzeWithDeberta(text: string, options: DebertaOptions = {}): Promise<ExperimentalSarcasmResult> {
  const model = (options.model ?? process.env.DEBERTA_SARCASM_MODEL ?? "").trim();
  if (!model) return { status: "not-configured", model: null, reason: "A fine-tuned DeBERTa sarcasm model is not configured. The base checkpoint is not a sarcasm detector." };
  const unavailable = (reason: string): ExperimentalSarcasmResult => ({ status: "unavailable", model, reason });
  if (!/^[\w.-]+\/[\w.-]+$/.test(model) || model === DEBERTA_BASE_MODEL || /^microsoft\/deberta/i.test(model)) {
    return unavailable("Configure a fine-tuned model repository, not a pretrained DeBERTa base checkpoint.");
  }
  const token = options.token ?? process.env.HF_TOKEN;
  if (!token) return unavailable("A server-side Hugging Face token is required. No demo score was substituted.");
  const endpoint = options.endpoint ?? process.env.DEBERTA_ENDPOINT_URL;
  try {
    const url = endpoint ? new URL(endpoint) : new URL(`https://router.huggingface.co/hf-inference/models/${model}`);
    if (endpoint && (url.protocol !== "https:" || !url.hostname.endsWith(".endpoints.huggingface.cloud") || url.username || url.password)) {
      return unavailable("Use an HTTPS Hugging Face dedicated inference endpoint.");
    }
    const response = await (options.fetcher ?? fetch)(url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text, parameters: { top_k: 2, truncation: true } }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) return unavailable(`Experimental inference returned HTTP ${response.status}. Check deployment and token access.`);
    const score = parseSarcasmScore(await response.json());
    return { status: "available", model, score, assessment: score > 0.5 ? "possible-sarcasm" : "insufficient-evidence" };
  } catch (error) {
    return unavailable(error instanceof Error && error.name === "TimeoutError" ? "The experimental request timed out." : "Experimental inference failed or returned invalid scores. The model must return sarcastic and non_sarcastic labels.");
  }
}