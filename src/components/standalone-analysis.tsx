"use client";

import { useState } from "react";
import { CircleMinus, Cpu, Drama, Gauge, LoaderCircle, Smile, Sparkles, ThumbsDown } from "lucide-react";
import { CARDIFF_MODEL, DEBERTA_BASE_MODEL, IRONY_MODEL, IRONY_THRESHOLD, type SentimentDashboardResult } from "@/lib/types";

const CLASSES = [
  { label: "POSITIVE", title: "Positive", icon: Smile },
  { label: "NEUTRAL", title: "Neutral", icon: CircleMinus },
  { label: "NEGATIVE", title: "Negative", icon: ThumbsDown },
] as const;

export function StandaloneAnalysis({ demo }: { demo: boolean }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SentimentDashboardResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || pending) return;
    setPending(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/analyze/cardiff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analysis failed. Please try again.");
      setResult(data);
    } catch (issue) {
      setError(issue instanceof Error && issue.name === "TimeoutError" ? "Analysis timed out. Please try again." : issue instanceof Error ? issue.message : "Could not connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="standalone-analysis" aria-label="Analyze feedback">
      <header className="analysis-heading">
        <div><h1>Feedback analysis</h1><p>Sentiment breakdown for your feedback.</p></div>
        <span className="analysis-mode"><Cpu size={15} />{demo ? "Demo mode" : "Hugging Face"}</span>
      </header>
      <div className="analysis-workspace">
      <form onSubmit={submit}>
        <label htmlFor="standalone-feedback">Customer feedback</label>
        <textarea
          id="standalone-feedback"
          placeholder="Enter your feedback"
          value={text}
          onChange={(event) => { setText(event.target.value); setResult(null); setError(""); }}
          disabled={pending}
          required
          maxLength={2000}
          rows={7}
        />
        <div className="analysis-input-meta"><span>English feedback</span><span>{text.length} / 2,000</span></div>
        <button className="button button-primary" type="submit" disabled={pending || !text.trim()}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{pending ? "Analyzing..." : "Analyze feedback"}
        </button>
        <p className="analysis-privacy">{demo ? "No token configured. Demo scores are illustrative, not model probabilities." : "Feedback is sent to Hugging Face, including the experimental model when configured. Avoid personal or sensitive information."}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      <aside className="analysis-model">
        <h2><Cpu size={17} />Model details</h2>
        <dl>
          <dt>Selected model</dt><dd><a href={`https://huggingface.co/${CARDIFF_MODEL}`} target="_blank" rel="noreferrer">{CARDIFF_MODEL}</a></dd>
          <dt>Model used</dt><dd>{result?.model ?? (demo ? "Phrase-based demo (no model called)" : "Awaiting analysis")}</dd>
          <dt>Classes</dt><dd>Positive / Neutral / Negative</dd>
          <dt>Irony model</dt><dd><a href={`https://huggingface.co/${IRONY_MODEL}`} target="_blank" rel="noreferrer">{IRONY_MODEL}</a></dd>
          <dt>Irony check</dt><dd>{result?.irony.status === "available"
            ? `${result.irony.flagged ? "Possible sarcasm" : "Not flagged"} - irony score ${(result.irony.score * 100).toFixed(1)}% (flag threshold > ${IRONY_THRESHOLD * 100}%)`
            : result?.irony.status === "unavailable"
              ? `Unavailable: ${result.irony.reason}`
              : demo || result?.irony.status === "not-run" ? "Not run in demo mode" : "Awaiting analysis"}</dd>
          <dt>Justification method</dt><dd>Sentiment score split, phrase cues, and a separate irony check. Not model attribution.</dd>
          <dt>Experimental foundation</dt><dd><a href={`https://huggingface.co/${DEBERTA_BASE_MODEL}`} target="_blank" rel="noreferrer">{DEBERTA_BASE_MODEL}</a></dd>
          <dt>Experimental model used</dt><dd>{result?.experimentalSarcasm.model ?? "No fine-tuned model configured"}</dd>
        </dl>
      </aside>
      </div>
      <section className="analysis-results" aria-label="Sentiment results" aria-busy={pending}>
        <div className="analysis-results-heading"><h2>Sentiment breakdown</h2><span>{result?.source === "demo" ? "Illustrative demo scores" : "Scores for this feedback"}</span></div>
        <div className="analysis-score-grid">
          {CLASSES.map(({ label, title, icon: Icon }) => <article key={label} className={`analysis-score ${label.toLowerCase()}`}>
            <h3><Icon size={18} />{title}</h3>
            <strong>{result ? `${(result.scores[label] * 100).toFixed(1)}%` : "--"}</strong>
            <progress aria-label={`${title} score`} value={result?.scores[label] ?? 0} max={1} />
          </article>)}
        </div>
        {result && <>
          <div className="analysis-distribution" role="img" aria-label={CLASSES.map(({ label, title }) => `${title}: ${(result.scores[label] * 100).toFixed(1)}%`).join(", ")}>
            {CLASSES.map(({ label }) => <span key={label} className={label.toLowerCase()} style={{ width: `${result.scores[label] * 100}%` }} />)}
          </div>
          <p className="analysis-score-note">{result.source === "demo" ? "Demo distribution: 70% for the rule-selected label, 15% for each other class. Not a live model prediction." : "Model scores across three classes, not percentages of words or customers. Rounding may affect the displayed total."}</p>
        </>}
        <div className="analysis-results-heading sarcasm-heading"><h2>Cardiff sarcasm baseline</h2><span>{IRONY_MODEL.split("/")[1]}</span></div>
        {result?.irony.status === "available" ? <>
          <div className="analysis-score-grid sarcasm-grid">
            <article className="analysis-score ironic"><h3><Drama size={18} />Ironic</h3><strong>{(result.irony.score * 100).toFixed(1)}%</strong><progress aria-label="Ironic score" value={result.irony.score} max={1} /></article>
            <article className="analysis-score not-ironic"><h3><CircleMinus size={18} />Not ironic</h3><strong>{((1 - result.irony.score) * 100).toFixed(1)}%</strong><progress aria-label="Not ironic score" value={1 - result.irony.score} max={1} /></article>
          </div>
          <div className="analysis-distribution" role="img" aria-label={`Ironic: ${(result.irony.score * 100).toFixed(1)}%, Not ironic: ${((1 - result.irony.score) * 100).toFixed(1)}%`}>
            <span className="ironic" style={{ width: `${result.irony.score * 100}%` }} /><span className="not-ironic" style={{ width: `${(1 - result.irony.score) * 100}%` }} />
          </div>
          <p className="analysis-score-note">{result.irony.flagged ? "Possible sarcasm, unverified: the raw model score exceeds 50%." : "Insufficient evidence of sarcasm at the 50% threshold; this does not rule it out."} These uncalibrated scores can be high for literal praise and are not probabilities of customer intent.</p>
        </> : <p className="analysis-score-note sarcasm-empty">{result ? result.irony.status === "unavailable" ? `Sarcasm could not be assessed: ${result.irony.reason}` : "Sarcasm detection is not run in demo mode. Configure a Hugging Face token for live irony scores." : "Submit feedback to see the sarcasm breakdown."}</p>}
        <section className="experimental-sarcasm" aria-labelledby="experimental-sarcasm-heading">
          <div className="analysis-results-heading sarcasm-heading"><h2 id="experimental-sarcasm-heading">DeBERTa comparison</h2><span>Experimental · Uncalibrated</span></div>
          {result?.experimentalSarcasm.status === "available" ? <>
            <p className="experimental-assessment">{result.experimentalSarcasm.assessment === "possible-sarcasm" ? "Possible sarcasm (unverified)" : "Insufficient evidence of sarcasm"}</p>
            <div className="analysis-score-grid sarcasm-grid">
              <article className="analysis-score ironic"><h3><Drama size={18} />Sarcastic score</h3><strong>{result.experimentalSarcasm.score.toFixed(3)}</strong><progress aria-label="Experimental sarcastic score" value={result.experimentalSarcasm.score} max={1} /></article>
              <article className="analysis-score not-ironic"><h3><CircleMinus size={18} />Non-sarcastic score</h3><strong>{(1 - result.experimentalSarcasm.score).toFixed(3)}</strong><progress aria-label="Experimental non-sarcastic score" value={1 - result.experimentalSarcasm.score} max={1} /></article>
            </div>
            <p className="analysis-score-note">Raw scores on a 0–1 scale, not calibrated probabilities. The leading class is a review signal, not proof of intent.</p>
            {result.irony.status === "available" && <p className="analysis-score-note">{result.irony.flagged !== (result.experimentalSarcasm.assessment === "possible-sarcasm") ? "Models disagree. Manual review is required; neither result overrides sentiment." : "Models agree at their decision thresholds. Agreement alone does not establish correctness."}</p>}
          </> : <p className="analysis-score-note sarcasm-empty" role="status">{result ? result.experimentalSarcasm.reason : "Awaiting analysis. A fine-tuned checkpoint is required; no experimental prediction has been made."}</p>}
          <p className="analysis-score-note">Sentiment remains unchanged. Customer-feedback validation is required before trusting this experimental model.</p>
        </section>
        {result?.final && <details className="legacy-score">
          <summary>Legacy cumulative score (unvalidated)</summary>
          <div className="final-score">
          <div className="final-score-head"><Gauge size={18} /><div><h3>Legacy cumulative score</h3><span>Not used for the overall sentiment</span></div><strong>{(result.final.adjustedConfidence * 100).toFixed(1)}%</strong></div>
          <p className="final-score-formula">{(result.final.literalConfidence * 100).toFixed(1)}% sentiment confidence × (100% − {(result.final.ironyScore * 100).toFixed(1)}% irony) = {(result.final.adjustedConfidence * 100).toFixed(1)}%</p>
          <p className="analysis-score-note">Retained for comparison only. Multiplying these scores is not a validated confidence estimate and can penalize genuine praise. No DeBERTa adjustment is applied.</p>
          </div>
        </details>}
      <div role="status" aria-live="polite" aria-atomic="true">
        {result && <div className="standalone-result">
          <div className="analysis-verdict"><h2>Overall sentiment</h2><span className={`standalone-sentiment ${result.sentiment.toLowerCase()}`}>
            {result.sentiment === "POSITIVE" ? "Positive" : result.sentiment === "NEGATIVE" ? "Negative" : "Neutral"}
          </span></div>
          <p><strong>Justification: </strong>{result.justification}</p>
          <p className="analysis-score-note">Score-based interpretation and phrase cues, not model attribution. Irony is a separate prediction, not proof of intent.</p>
        </div>}
      </div>
      </section>
    </section>
  );
}