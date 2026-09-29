import assert from "node:assert/strict";
import test from "node:test";
import { analyzeStandaloneFeedback, mockAnalysis } from "./rationale";
import { analyzeWithCardiff, computeFinalScore, explainCardiffScores, parseCardiffScores } from "./cardiff";
import { analyzeIrony, parseIronyScore } from "./irony";
import { analyzeWithDeberta, parseSarcasmScore } from "./deberta";
import { evaluateSarcasm, parseEvaluationData } from "./sarcasm-evaluation";

test("evaluation validates labels and reports false positives and calibration on paired predictions", () => {
  assert.equal(parseEvaluationData('{"text":"Good service","sarcastic":false}\n{"text":"Wonderful, another delay","sarcastic":true}').length, 2);
  for (const input of ['{"text":"Good service","sarcastic":false}', '{"text":"Good","sarcastic":"false"}', '{"text":"Good","sarcastic":false}\n{"text":" good ","sarcastic":true}']) assert.throws(() => parseEvaluationData(input));
  const result = evaluateSarcasm([{ sarcastic: false, score: 0.9 }, { sarcastic: false, score: 0.1 }, { sarcastic: true, score: 0.8 }, { sarcastic: true, score: 0.2 }]);
  assert.deepEqual(result.confusion, { truePositive: 1, falsePositive: 1, trueNegative: 1, falseNegative: 1 });
  assert.equal(result.falsePositiveRate, 0.5);
  assert.equal(result.precision, 0.5);
  assert.equal(result.recall, 0.5);
  assert.equal(result.f1, 0.5);
  assert.ok(Math.abs(result.brierScore - 0.375) < 1e-12);
  assert.ok(Math.abs(result.expectedCalibrationError - 0.5) < 1e-12);
  assert.equal(evaluateSarcasm([{ sarcastic: false, score: 0.5 }]).precision, null);
  assert.throws(() => evaluateSarcasm([]));
  assert.throws(() => evaluateSarcasm([{ sarcastic: true, score: NaN }]));
});

test("experimental sarcasm requires a trained model and explicit validated labels", async () => {
  const noRequest = async () => { throw new Error("Must not make an inference request"); };
  assert.equal((await analyzeWithDeberta("The service is good", { model: "", fetcher: noRequest })).status, "not-configured");
  assert.equal((await analyzeWithDeberta("Feedback", { model: "microsoft/deberta-v3-base", token: "test", fetcher: noRequest })).status, "unavailable");
  assert.equal((await analyzeWithDeberta("Feedback", { model: "outlet/trained-deberta", token: "", fetcher: noRequest })).status, "unavailable");
  assert.equal(parseSarcasmScore([[{ label: "non_sarcastic", score: 0.9 }, { label: "sarcastic", score: 0.1 }]]), 0.1);
  for (const payload of [[], [{ label: "LABEL_0", score: 0.9 }, { label: "LABEL_1", score: 0.1 }], [{ label: "sarcastic", score: 0.9 }, { label: "non_sarcastic", score: 0.9 }]]) assert.throws(() => parseSarcasmScore(payload));
});

test("experimental comparison preserves raw input, Cardiff scores, and legacy output", async () => {
  const text = "The service is good";
  const calls: string[] = [];
  const result = await analyzeWithCardiff(text, { token: "test", deberta: { model: "outlet/trained-deberta", endpoint: "" }, fetcher: async (url, init) => {
    calls.push(String(url));
    assert.equal(JSON.parse(String(init?.body)).inputs, text);
    if (String(url).endsWith("trained-deberta")) return Response.json([{ label: "sarcastic", score: 0.1 }, { label: "non_sarcastic", score: 0.9 }]);
    if (String(url).endsWith("base-irony")) return Response.json([{ label: "irony", score: 0.8946763277053833 }, { label: "non_irony", score: 0.1053236722946167 }]);
    return Response.json([{ label: "positive", score: 0.95 }, { label: "neutral", score: 0.04 }, { label: "negative", score: 0.01 }]);
  } });
  assert.equal(calls.length, 3);
  assert.equal(result.sentiment, "POSITIVE");
  assert.equal(result.scores.POSITIVE, 0.95);
  assert.equal(result.irony.status, "available");
  assert.ok(result.final);
  assert.deepEqual(result.experimentalSarcasm, { status: "available", model: "outlet/trained-deberta", score: 0.1, assessment: "insufficient-evidence" });
});

test("experimental failures stay isolated and never invent a score", async () => {
  for (const experimentalResponse of [() => new Response(null, { status: 503 }), () => Response.json({ error: "invalid" }), () => { throw new DOMException("Timeout", "TimeoutError"); }]) {
    const result = await analyzeWithCardiff("Feedback", { token: "test", deberta: { model: "outlet/trained-deberta", endpoint: "" }, fetcher: async (url) => {
      if (String(url).endsWith("trained-deberta")) return experimentalResponse();
      if (String(url).endsWith("base-irony")) return Response.json([{ label: "irony", score: 0.1 }, { label: "non_irony", score: 0.9 }]);
      return Response.json([{ label: "positive", score: 0.95 }, { label: "neutral", score: 0.04 }, { label: "negative", score: 0.01 }]);
    } });
    assert.equal(result.scores.POSITIVE, 0.95);
    assert.equal(result.experimentalSarcasm.status, "unavailable");
    assert.ok(!("score" in result.experimentalSarcasm));
  }
  let calls = 0;
  const result = await analyzeWithDeberta("Feedback", { model: "outlet/trained-deberta", token: "test", endpoint: "https://example.com", fetcher: async () => { calls++; return Response.json([]); } });
  assert.equal(result.status, "unavailable");
  assert.equal(calls, 0);
});

test("Cardiff parses three classes, label aliases, and validates the full distribution", () => {
  assert.deepEqual(parseCardiffScores([[{ label: "negative", score: 0.1 }, { label: "neutral", score: 0.6 }, { label: "positive", score: 0.3 }]]), { NEGATIVE: 0.1, NEUTRAL: 0.6, POSITIVE: 0.3 });
  assert.equal(parseCardiffScores([{ label: "LABEL_0", score: 0.1 }, { label: "LABEL_1", score: 0.6 }, { label: "LABEL_2", score: 0.3 }]).NEUTRAL, 0.6);
  for (const payload of [[], [{ label: "positive", score: 0.9 }], [{ label: "positive", score: 0.5 }, { label: "positive", score: 0.2 }, { label: "neutral", score: 0.3 }], [{ label: "positive", score: 0.8 }, { label: "negative", score: 0.8 }, { label: "neutral", score: 0.8 }]]) assert.throws(() => parseCardiffScores(payload));
});

test("Cardiff requests all classes, exposes model identity, and does not mask API failures", async () => {
  for (const winner of ["positive", "neutral", "negative"]) {
    const result = await analyzeWithCardiff("@shop The service was helpful https://example.com", {
      token: "test-token",
      fetcher: async (url, init) => {
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
        const request = JSON.parse(String(init?.body));
        assert.equal(request.inputs, "@shop The service was helpful https://example.com");
        if (String(url).endsWith("twitter-roberta-base-irony")) {
          assert.equal(request.parameters.top_k, 2);
          return Response.json([{ label: "irony", score: 0.1 }, { label: "non_irony", score: 0.9 }]);
        }
        assert.match(String(url), /cardiffnlp\/twitter-roberta-base-sentiment-latest$/);
        assert.equal(request.parameters.top_k, 3);
        return Response.json(["positive", "neutral", "negative"].map((label) => ({ label, score: label === winner ? 0.8 : 0.1 })));
      },
    });
    assert.equal(result.sentiment, winner.toUpperCase());
    assert.equal(result.source, "huggingface");
    assert.equal(result.model, "cardiffnlp/twitter-roberta-base-sentiment-latest");
    assert.ok(result.justification);
    assert.deepEqual(result.irony, { status: "available", score: 0.1, flagged: false });
  }
  await assert.rejects(analyzeWithCardiff("Helpful staff", { token: "test-token", fetcher: async () => new Response(null, { status: 503 }) }), /No demo result was substituted/);
  const demo = await analyzeWithCardiff("I visited yesterday", { token: "" });
  assert.equal(demo.source, "demo");
  assert.equal(demo.sentiment, "NEUTRAL");
  assert.match(demo.model, /no model called/);
  assert.equal(demo.irony.status, "not-run");
  assert.equal(demo.final, null);
  assert.equal(Object.values(demo.scores).reduce((sum, score) => sum + score, 0), 1);
});

test("irony parser validates class names, aliases, ordering, and distributions", () => {
  assert.equal(parseIronyScore([[{ label: "non_irony", score: 0.18 }, { label: "irony", score: 0.82 }]]), 0.82);
  assert.equal(parseIronyScore([{ label: "LABEL_1", score: 0.82 }, { label: "LABEL_0", score: 0.18 }]), 0.82);
  for (const payload of [[], [{ label: "irony", score: 0.82 }], [{ label: "irony", score: 0.5 }, { label: "irony", score: 0.5 }], [{ label: "unknown", score: 0.5 }, { label: "non_irony", score: 0.5 }], [{ label: "irony", score: NaN }, { label: "non_irony", score: 0.5 }], [{ label: "irony", score: 1.1 }, { label: "non_irony", score: -0.1 }], [{ label: "irony", score: 0.9 }, { label: "non_irony", score: 0.9 }]]) assert.throws(() => parseIronyScore(payload));
});

test("both raw-text requests start concurrently and irony is added without flipping sentiment", async () => {
  const text = "Oh great, @shop!\nAnother hour in line. https://example.com";
  let resolveSentiment!: (response: Response) => void;
  const sentimentResponse = new Promise<Response>((resolve) => { resolveSentiment = resolve; });
  const calls: string[] = [];
  const pending = analyzeWithCardiff(text, { token: "test-token", fetcher: async (url, init) => {
    calls.push(String(url));
    assert.equal(JSON.parse(String(init?.body)).inputs, text);
    if (String(url).endsWith("twitter-roberta-base-irony")) return Response.json([{ label: "irony", score: 0.82 }, { label: "non_irony", score: 0.18 }]);
    return sentimentResponse;
  } });
  assert.equal(calls.length, 2);
  resolveSentiment(Response.json([{ label: "positive", score: 0.9 }, { label: "neutral", score: 0.08 }, { label: "negative", score: 0.02 }]));
  const result = await pending;
  assert.equal(result.sentiment, "POSITIVE");
  assert.equal(result.scores.POSITIVE, 0.9);
  assert.match(result.justification, /Possible sarcasm detected \(irony score 0.82\)/);
  assert.match(result.justification, /Review manually/);
  assert.ok(result.final);
  assert.equal(result.final.ironyScore, 0.82);
  assert.equal(Number(result.final.adjustedConfidence.toFixed(3)), Number((0.9 * (1 - 0.82)).toFixed(3)));
  assert.match(result.final.recommendation, /verify manually/i);
});

test("cumulative final score discounts confidence by irony and is null when irony is missing", () => {
  const reliable = computeFinalScore(0.95, { status: "available", score: 0.1, flagged: false });
  assert.ok(reliable);
  assert.equal(Number(reliable.adjustedConfidence.toFixed(3)), 0.855);
  assert.match(reliable.recommendation, /reliable/i);
  const weak = computeFinalScore(0.6, { status: "available", score: 0.45, flagged: false });
  assert.ok(weak);
  assert.match(weak.recommendation, /review if it matters/i);
  const flagged = computeFinalScore(0.9, { status: "available", score: 0.8, flagged: true });
  assert.ok(flagged);
  assert.match(flagged.recommendation, /verify manually/i);
  assert.equal(computeFinalScore(0.9, { status: "unavailable", reason: "x" }), null);
  assert.equal(computeFinalScore(0.9, { status: "not-run" }), null);
});

test("irony outages preserve sentiment but report missing assessment", async () => {
  const result = await analyzeWithCardiff("The lights strained my eyes.", { token: "test-token", fetcher: async (url) => String(url).endsWith("twitter-roberta-base-irony") ? new Response(null, { status: 503 }) : Response.json([{ label: "positive", score: 0.01 }, { label: "neutral", score: 0.04 }, { label: "negative", score: 0.95 }]) });
  assert.equal(result.sentiment, "NEGATIVE");
  assert.equal(result.irony.status, "unavailable");
  assert.equal(result.final, null);
  assert.match(result.justification, /Irony detection unavailable/);
  for (const fetcher of [async () => { throw new DOMException("Timeout", "TimeoutError"); }, async () => Response.json({ error: "bad response" })]) {
    assert.equal((await analyzeIrony("Feedback", "test-token", fetcher)).status, "unavailable");
  }
  const tie = await analyzeIrony("Feedback", "test-token", async () => Response.json([{ label: "irony", score: 0.5 }, { label: "non_irony", score: 0.5 }]));
  assert.deepEqual(tie, { status: "available", score: 0.5, flagged: false });
});

test("unmatched wording receives confident or ambiguous score-based justifications", () => {
  const text = "The lights were dim and made my eyes strain.";
  const strong = explainCardiffScores(text, "NEGATIVE", { POSITIVE: 0.02, NEUTRAL: 0.03, NEGATIVE: 0.95 });
  assert.match(strong, /negative 95.0%/);
  assert.match(strong, /strongly favors negative/);
  assert.doesNotMatch(strong, /cannot explain/);
  const mixed = explainCardiffScores(text, "NEGATIVE", { POSITIVE: 0.35, NEUTRAL: 0.25, NEGATIVE: 0.4 });
  assert.match(mixed, /mixed or ambiguous/);
  assert.match(mixed, /manual review/);
  assert.match(explainCardiffScores(text, "NEUTRAL", { POSITIVE: 0.05, NEUTRAL: 0.9, NEGATIVE: 0.05 }), /strongly favors neutral/);
});

test("standalone analysis returns only sentiment and justification for all three classes", () => {
  for (const [text, expected] of [
    ["Friendly, helpful staff and quick service.", "POSITIVE"],
    ["Rude staff and a long wait.", "NEGATIVE"],
    ["I visited the store yesterday.", "NEUTRAL"],
    ["The staff were friendly but service was slow.", "NEUTRAL"],
    ["The staff were not helpful.", "NEGATIVE"],
  ]) {
    const result = analyzeStandaloneFeedback(text);
    assert.equal(result.sentiment, expected);
    assert.deepEqual(Object.keys(result).sort(), ["justification", "sentiment"]);
    assert.match(result.justification, /phrase-based rules/);
  }
  assert.match(analyzeStandaloneFeedback("Staff were not helpful.").justification, /"not helpful"/);
  assert.equal(mockAnalysis("I visited the store yesterday.").sentiment, "POSITIVE");
});