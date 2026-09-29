import { readFile } from "node:fs/promises";
import { analyzeWithDeberta } from "../src/lib/deberta";
import { analyzeIrony } from "../src/lib/irony";
import { evaluateSarcasm, parseEvaluationData } from "../src/lib/sarcasm-evaluation";
import { IRONY_MODEL } from "../src/lib/types";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || !args.length) {
    console.log('Usage: npm run evaluate:sarcasm -- held-out.jsonl --send-to-hf\nJSONL records: {"text":"...","sarcastic":false}\nRequires HF_TOKEN and DEBERTA_SARCASM_MODEL. Sends each record to both configured HF models. Prints aggregate metrics only. Use a held-out test set, not training or validation data.');
    return;
  }
  if (args.length !== 2 || args[1] !== "--send-to-hf") throw new Error("Explicit --send-to-hf consent is required to send the evaluation data to Hugging Face.");
  const token = process.env.HF_TOKEN;
  if (!token || !process.env.DEBERTA_SARCASM_MODEL) throw new Error("Set HF_TOKEN and a trained DEBERTA_SARCASM_MODEL before evaluation.");
  const records = parseEvaluationData(await readFile(args[0], "utf8"));
  const baseline: { sarcastic: boolean; score: number }[] = [];
  const experimental: { sarcastic: boolean; score: number }[] = [];
  let skipped = 0;
  for (const record of records) {
    const [irony, candidate] = await Promise.all([analyzeIrony(record.text, token, fetch), analyzeWithDeberta(record.text)]);
    if (irony.status !== "available" || candidate.status !== "available") {
      skipped++;
      continue;
    }
    baseline.push({ sarcastic: record.sarcastic, score: irony.score });
    experimental.push({ sarcastic: record.sarcastic, score: candidate.score });
  }
  console.log(JSON.stringify({
    requested: records.length, paired: baseline.length, skipped,
    evaluationComplete: skipped === 0,
    baseline: { model: IRONY_MODEL, metrics: baseline.length ? evaluateSarcasm(baseline) : null },
    experimental: { model: process.env.DEBERTA_SARCASM_MODEL, metrics: experimental.length ? evaluateSarcasm(experimental) : null },
    caution: "Descriptive metrics only; no automatic winner or calibrated probability claim. Class balance and sample size affect conclusions. Skipped records may bias results.",
  }, null, 2));
  if (skipped) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Evaluation failed."); process.exitCode = 1; });