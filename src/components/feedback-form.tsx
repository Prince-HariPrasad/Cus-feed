"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  MessageSquarePlus,
  Sparkles,
  X,
} from "lucide-react";
import { OUTLETS, type Review } from "@/lib/types";

export function FeedbackForm({
  demo,
  onComplete,
}: {
  demo: boolean;
  onComplete: (review: Review) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [outletId, setOutletId] = useState<string>("102");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Review | null>(null);

  function open() {
    setResult(null);
    setError("");
    dialog.current?.showModal();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, outletId }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Analysis failed. Please try again.");
      setResult(data);
      onComplete(data);
      setText("");
    } catch (issue) {
      setError(
        issue instanceof Error && issue.name === "TimeoutError"
          ? "The request timed out. Please try again."
          : issue instanceof Error
            ? issue.message
            : "Could not connect. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="button button-primary" onClick={open}>
        <MessageSquarePlus size={17} />
        Add feedback
      </button>
      <dialog
        ref={dialog}
        className="feedback-dialog"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        aria-labelledby="feedback-title"
      >
        <div className="dialog-header">
          <div className="eyebrow">CUSTOMER EXPERIENCE</div>
          <button
            className="icon-button"
            aria-label="Close feedback form"
            title="Close"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="feedback-title">Every visit has a story.</h2>
        <p className="dialog-subtitle">Share your outlet experience.</p>
        {result ? (
          <div className="submission-result" role="status">
            <div className="success-icon">
              <Check size={24} />
            </div>
            <h3>Feedback received</h3>
            <p>Your visit is now part of the conversation.</p>
            <div className="result-summary">
              <span
                className={`sentiment-badge ${result.sentiment === "POSITIVE" ? "positive" : "negative"}`}
              >
                {result.sentiment}
              </span>
              <strong>
                {Math.round(result.confidence * 100)}%{" "}
                <span>
                  {result.source === "demo" ? "demo estimate" : "confidence"}
                </span>
              </strong>
            </div>
            <h4>Service rationale</h4>
            <p>{result.rationale}</p>
            <small>Rules-based interpretation, not model attribution.</small>
            <button
              className="button button-primary"
              onClick={() => dialog.current?.close()}
            >
              View feedback
              <ArrowRight size={16} />
            </button>
            <button
              className="button button-secondary"
              onClick={() => setResult(null)}
            >
              Add another review
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="feedback-form">
            <label htmlFor="outlet">Store outlet</label>
            <select
              id="outlet"
              value={outletId}
              onChange={(event) => setOutletId(event.target.value)}
              disabled={pending}
            >
              {OUTLETS.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  Outlet #{outlet.id} - {outlet.name}
                </option>
              ))}
            </select>
            <div className="field-heading">
              <label htmlFor="feedback">Your feedback</label>
              <span>Required</span>
            </div>
            <textarea
              id="feedback"
              placeholder="How was your visit?"
              value={text}
              onChange={(event) => setText(event.target.value)}
              minLength={10}
              maxLength={2000}
              required
              rows={7}
              disabled={pending}
              aria-describedby="feedback-limit"
            />
            <div id="feedback-limit" className="character-count">
              <span>10 characters minimum · English</span>
              <span>{text.length.toLocaleString()} / 2,000</span>
            </div>
            <div className="analysis-notice">
              <Sparkles size={18} />
              <div>
                <strong>
                  {demo ? "Demo analysis is active" : "Hugging Face analysis"}
                </strong>
                <p>
                  {demo
                    ? "No live model is connected. Results use a rules-based demo."
                    : "Feedback is sent to Hugging Face for sentiment analysis."}{" "}
                  Please do not include personal or sensitive information.
                </p>
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending || text.trim().length < 10}
              className="button button-primary submit-button"
            >
              {pending ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              {pending ? "Analyzing feedback..." : "Submit & analyze"}
              {!pending && <ArrowRight size={17} />}
            </button>
            <p className="form-footnote">
              Saved in this browser. No customer account required.
            </p>
          </form>
        )}
      </dialog>
    </>
  );
}
