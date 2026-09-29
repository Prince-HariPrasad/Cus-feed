# Outlet Pulse

A Next.js App Router, React, TypeScript, and Tailwind CSS prototype for outlet feedback and sentiment analysis. Includes search, sentiment/outlet/date filters, summary metrics, CSV export, outlet views, and an accessible feedback drawer.

## Getting Started

Requires Node.js 20.9+ and npm. From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API token is needed for demo mode.

## Hugging Face Configuration

Create `.env.local` using `.env.example` and set `HF_TOKEN` to a Hugging Face token with Inference Providers permissions, then restart the server. Never prefix it with `NEXT_PUBLIC_` or enter it into the UI.

The server calls `https://router.huggingface.co/hf-inference/models/siebert/sentiment-roberta-large-english`. This model returns POSITIVE or NEGATIVE only. Provider availability, account permissions, and billing can affect access; a token alone does not guarantee the model is served. Live inference has not been verified without a token. Configured API failures are surfaced rather than silently replaced by mock results.

Without a token, a deterministic keyword mock is used and labeled in every result. Mock confidence is illustrative, not a calibrated probability. Unmatched text or tied signals default to POSITIVE with low confidence; neither means neutral sentiment was detected.

## Structure

### Three-Class Analysis Tab

The **Analyze feedback** dashboard calls `POST /api/analyze/cardiff` using `cardiffnlp/twitter-roberta-base-sentiment-latest` through the Hugging Face router. It uses the same server-only `HF_TOKEN` and requests all three classes. Positive, neutral, and negative percentages are model scores for one feedback item, not shares of words or reviews. The original outlet workflow continues using SieBERT.

Model identity and result source are displayed beside the feedback form. Justifications use separate phrase rules and are not model attributions. No token means an explicitly illustrative demo distribution (70% for the rule-selected label, 15% for each remaining class). Configured live failures do not fall back silently. The new tab accepts 1-2,000 characters and does not save its results as outlet reviews.

Live analysis sends the original feedback wording to sentiment and `cardiffnlp/twitter-roberta-base-irony` in parallel, using the same server-only token. Irony scores above 0.5 add a possible-sarcasm warning and recommend manual review; they never flip the sentiment label or modify its scores. An irony-service failure preserves a successful sentiment result with an explicit unavailable warning. Demo mode does not run or simulate irony detection.

Justifications include the actual three-way sentiment split. A top score of at least 0.8 with a margin of at least 0.2 is described as strongly favoring the label; otherwise the split is described as mixed or ambiguous. These are display heuristics, not calibrated guarantees. When no phrase matches, the justification summarizes the scores without inventing a textual cause. Irony prediction and phrase cues are not explanations of the sentiment model's internal reasoning. Two live calls may cost more than sentiment alone.

Live Cardiff inference was verified with the configured token for positive, negative, and neutral examples. Desktop and mobile score displays were checked in the browser. Provider availability can change.

- `src/lib/cardiff.ts`: three-class inference and strict score-distribution validation.
- `src/lib/irony.ts`: binary irony inference, validated labels, and explicit unavailable states.
- `src/app/api/analyze/cardiff/route.ts`: server-only Cardiff endpoint.
- `src/components/standalone-analysis.tsx`: individual-feedback sentiment dashboard.

- `src/app/api/analyze/route.ts`: request validation, server-only inference, error responses.
- `src/lib/huggingface.ts`: API adapter and strict response parsing.
- `src/lib/rationale.ts`: phrase matching, simple negation, driver spans, rationale, mock scoring.
- `src/lib/types.ts`: shared types and outlet configuration.
- `src/lib/demo-data.ts`: fictional sample reviews.
- `src/lib/review-store.ts`: browser-local persistence, capped at 300 submissions.
- `src/components/`: dashboard, review cards, and submission form.
- `src/app/globals.css`: responsive design system on Tailwind CSS.

Rationales are independent rules-based interpretations, not explanations of the model's internal reasoning. Sarcasm and complex context can be missed. Driver counts represent distinct reviews mentioning a topic, not raw keyword frequency. Metrics and exports respect the current filters.

## Verification

```sh
npm test
npm run lint
npm run build
```

Tests cover mock scoring, negation, highlight offsets, malformed API responses, and mocked live success/failure. Browser checks cover submission, persistence, filtering, mobile navigation, layout, and API validation.

## Prototype Limits

Reviews are stored only in the submitting browser, not a shared database. Browser storage can be cleared; export important feedback. Storage failure falls back to memory and displays a warning. Sample reviews are regenerated relative to page load and can be hidden with the footer checkbox.

There is no authentication, authorization, rate limiting, or cross-device synchronization. Before public deployment, add these controls, a persistent database, retention policy, and appropriate customer consent. Live feedback is sent to Hugging Face; avoid personal or sensitive information. Current length limit is 10-2,000 characters and the selected model is English-only.

Fonts (Manrope and DM Sans) are self-hosted via Fontsource. Local outlet images are representative Unsplash photos, not actual stores: photo IDs `1441986300917-64674bd600d8`, `1442512595331-e89e73853f31`, and `1555529669-e69e7aa0ba9a`.
