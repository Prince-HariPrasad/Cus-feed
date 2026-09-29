import { CircleCheck, CircleMinus, MapPin, Sparkles } from "lucide-react";
import { Fragment } from "react";
import { OUTLETS, type Review } from "@/lib/types";

function HighlightedText({ review }: { review: Review }) {
  const segments = review.drivers.map((driver, index) => {
    const preceding = review.text.slice(
      review.drivers[index - 1]?.end ?? 0,
      driver.start,
    );
    return (
      <Fragment key={`${driver.start}-${driver.end}`}>
        {preceding}
        <mark
          className={
            driver.sentiment === "POSITIVE"
              ? "highlight-positive"
              : "highlight-negative"
          }
        >
          {review.text.slice(driver.start, driver.end)}
        </mark>
      </Fragment>
    );
  });
  return (
    <>
      {segments}
      {review.text.slice(review.drivers.at(-1)?.end ?? 0)}
    </>
  );
}

export function FeedbackCard({ review, now }: { review: Review; now: number }) {
  const outlet = OUTLETS.find((item) => item.id === review.outletId)!;
  const positive = review.sentiment === "POSITIVE";
  const hours = Math.max(
    0,
    Math.floor((now - Date.parse(review.createdAt)) / 3_600_000),
  );
  const age =
    hours === 0
      ? "Just now"
      : hours < 24
        ? `${hours}h ago`
        : `${Math.floor(hours / 24)}d ago`;
  const topics = [
    ...new Set(review.drivers.map((driver) => driver.topic)),
  ].slice(0, 3);
  return (
    <article className="feedback-card">
      <div className="review-top">
        <div className={`review-avatar avatar-${Number(review.outletId) % 3}`}>
          {review.customer
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="review-identity">
          <h3>{review.customer}</h3>
          <div>
            <MapPin size={12} />
            <span>
              {outlet.name} <span className="outlet-id">#{outlet.id}</span>
            </span>
            <span className="dot-separator">·</span>
            <time
              dateTime={review.createdAt}
              title={new Date(review.createdAt).toUTCString()}
            >
              {age}
            </time>
          </div>
        </div>
        <span
          className={`sentiment-badge ${positive ? "positive" : "negative"}`}
        >
          {positive ? <CircleCheck size={13} /> : <CircleMinus size={13} />}
          {positive ? "POSITIVE" : "NEGATIVE"}
        </span>
      </div>
      <p className="review-text">
        <HighlightedText review={review} />
      </p>
      <div className="rationale-row">
        <Sparkles size={14} />
        <div>
          <span className="rationale-label">Service rationale</span>
          <p>{review.rationale}</p>
        </div>
      </div>
      <div className="review-bottom">
        <div className="topic-list">
          {topics.map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
        <div className="confidence">
          <span
            className={`confidence-dot ${positive ? "positive" : "negative"}`}
          />
          <strong>{Math.round(review.confidence * 100)}%</strong>
          <span>
            {review.source === "demo" ? "demo estimate" : "confidence"}
          </span>
        </div>
      </div>
      <details className="explanation-details">
        <summary>
          Analysis details{" "}
          <span>
            {review.source === "demo" ? "Demo" : "Hugging Face"} · Rules-based
            rationale
          </span>
        </summary>
        <p>
          {review.source === "demo"
            ? "This is a deterministic keyword-based demo, not a Hugging Face prediction. Its score is illustrative and is not a calibrated probability. Ties default to POSITIVE at low confidence."
            : "Sentiment and confidence come from siebert/sentiment-roberta-large-english. Confidence is the model score, not a guarantee of correctness."}{" "}
          Highlighted phrases are selected separately by simple rules, not model
          attribution. Sarcasm, context, and complex negation may be missed.
        </p>
      </details>
    </article>
  );
}
