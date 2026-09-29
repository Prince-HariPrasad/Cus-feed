import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFeedback, parsePrediction } from "./huggingface";
import { extractDrivers, mockAnalysis } from "./rationale";

test("demo distinguishes positive, negative, negated and mixed feedback", () => {
  assert.equal(
    mockAnalysis("The friendly staff were helpful and the store was clean.")
      .sentiment,
    "POSITIVE",
  );
  assert.equal(
    mockAnalysis("Rude staff and a long wait. Terrible.").sentiment,
    "NEGATIVE",
  );
  assert.equal(
    mockAnalysis("Great products but a long wait. A disappointing visit.")
      .sentiment,
    "NEGATIVE",
  );
  assert.equal(
    mockAnalysis("The staff were not very helpful.").sentiment,
    "NEGATIVE",
  );
  assert.equal(mockAnalysis("The store wasn't dirty.").sentiment, "POSITIVE");
  assert.equal(
    mockAnalysis("The staff were friendly but the store was dirty.").confidence,
    0.54,
  );
  assert.equal(mockAnalysis("I visited this store yesterday.").confidence, 0.5);
  assert.match(
    mockAnalysis("I visited this store yesterday.").rationale,
    /No clear matching phrases/,
  );
});

test("driver spans match original text and avoid substring matches", () => {
  const text = "The staff were NOT helpful, but the checkout was quick.";
  const drivers = extractDrivers(text);
  for (const driver of drivers)
    assert.equal(text.slice(driver.start, driver.end), driver.phrase);
  assert.equal(drivers[0].phrase, "NOT helpful");
  assert.deepEqual(extractDrivers("The badge was on the cleaner."), []);
});

test("HF parser handles both shapes, picks highest score and rejects invalid data", () => {
  assert.deepEqual(
    parsePrediction([
      [
        { label: "NEGATIVE", score: 0.02 },
        { label: "POSITIVE", score: 0.98 },
      ],
    ]),
    { sentiment: "POSITIVE", confidence: 0.98 },
  );
  assert.equal(
    parsePrediction([{ label: "NEGATIVE", score: 0.9 }]).sentiment,
    "NEGATIVE",
  );
  for (const payload of [
    [],
    { error: "loading" },
    [{ label: "NEUTRAL", score: 0.5 }],
    [{ label: "POSITIVE", score: 2 }],
  ])
    assert.throws(() => parsePrediction(payload));
});

test("no token uses demo, configured token calls exact model and never silently falls back", async () => {
  assert.equal(
    (await analyzeFeedback("Lovely helpful staff", { token: "" })).source,
    "demo",
  );
  const fetcher: typeof fetch = async (url, options) => {
    assert.match(String(url), /siebert\/sentiment-roberta-large-english$/);
    assert.equal(
      new Headers(options?.headers).get("Authorization"),
      "Bearer test-token",
    );
    return Response.json([[{ label: "POSITIVE", score: 0.99 }]]);
  };
  assert.equal(
    (
      await analyzeFeedback("Lovely helpful staff", {
        token: "test-token",
        fetcher,
      })
    ).source,
    "huggingface",
  );
  await assert.rejects(
    analyzeFeedback("Lovely helpful staff", {
      token: "test-token",
      fetcher: async () => new Response("Unavailable", { status: 503 }),
    }),
    /HTTP 503/,
  );
});
