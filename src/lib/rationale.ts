import type { Analysis, Driver, Sentiment } from "./types";

const RULES: { pattern: string; topic: string; sentiment: Sentiment }[] = [
  {
    pattern:
      "friendly|helpful|welcoming|attentive|kind|rude|unhelpful|dismissive",
    topic: "Staff service",
    sentiment: "POSITIVE",
  },
  {
    pattern: "quick|fast|efficient|slow|long wait|waiting|queue",
    topic: "Wait time",
    sentiment: "POSITIVE",
  },
  {
    pattern: "clean|spotless|tidy|dirty|messy",
    topic: "Store environment",
    sentiment: "POSITIVE",
  },
  {
    pattern: "fresh|delicious|quality|stale|damaged|broken",
    topic: "Product quality",
    sentiment: "POSITIVE",
  },
  {
    pattern: "affordable|great value|expensive|overpriced",
    topic: "Value for money",
    sentiment: "POSITIVE",
  },
  {
    pattern: "well stocked|good selection|out of stock|sold out",
    topic: "Availability",
    sentiment: "POSITIVE",
  },
  {
    pattern:
      "excellent|amazing|great|love|loved|wonderful|happy|disappointed|disappointing|terrible|awful|poor|bad|hate",
    topic: "Overall experience",
    sentiment: "POSITIVE",
  },
];
const NEGATIVE =
  /^(rude|unhelpful|dismissive|slow|long wait|waiting|queue|dirty|messy|stale|damaged|broken|expensive|overpriced|out of stock|sold out|disappointed|disappointing|terrible|awful|poor|bad|hate)$/i;

/** Phrase matches are explanatory cues, not model attributions. */
export function extractDrivers(text: string): Driver[] {
  const matches: Driver[] = [];
  for (const rule of RULES) {
    const expression = new RegExp(`\\b(?:${rule.pattern})\\b`, "gi");
    for (const match of text.matchAll(expression)) {
      const prefix = text.slice(Math.max(0, match.index - 28), match.index);
      const negation = prefix.match(
        /\b(?:not|never|no|wasn't|weren't|isn't|aren't|didn't|don't|wasn’t|isn’t)\s+(?:(?:very|at all|really|particularly)\s+)?$/i,
      );
      const start = negation ? match.index - negation[0].length : match.index;
      const negative = NEGATIVE.test(match[0]) !== Boolean(negation);
      matches.push({
        phrase: text.slice(start, match.index + match[0].length),
        topic: rule.topic,
        sentiment: negative ? "NEGATIVE" : "POSITIVE",
        start,
        end: match.index + match[0].length,
      });
    }
  }
  return matches
    .sort((first, second) => first.start - second.start)
    .filter(
      (driver, index, all) => index === 0 || driver.start >= all[index - 1].end,
    );
}

export function explain(sentiment: Sentiment, drivers: Driver[]): string {
  const supporting = drivers.filter((driver) => driver.sentiment === sentiment);
  const topics = [
    ...new Set(supporting.map((driver) => driver.topic.toLowerCase())),
  ];
  if (!topics.length)
    return "No clear matching phrases were found by the rules-based helper. Read the full feedback for context; this helper cannot explain the model's internal reasoning.";
  const mixed = drivers.some((driver) => driver.sentiment !== sentiment);
  return `${sentiment === "POSITIVE" ? "Positive language" : "Concerns"} about ${topics.join(", ")} ${sentiment === "POSITIVE" ? "supports" : "support"} the ${sentiment.toLowerCase()} label.${mixed ? " The feedback also contains contrasting signals worth reviewing." : ""}`;
}

export function analyzeStandaloneFeedback(text: string): {
  sentiment: Sentiment | "NEUTRAL";
  justification: string;
} {
  const drivers = extractDrivers(text);
  const positive = drivers.filter((driver) => driver.sentiment === "POSITIVE");
  const negative = drivers.filter((driver) => driver.sentiment === "NEGATIVE");
  if (positive.length === negative.length) {
    return {
      sentiment: "NEUTRAL",
      justification: drivers.length
        ? `The phrase-based rules found balanced positive (${positive.map((driver) => `"${driver.phrase}"`).join(", ")}) and negative (${negative.map((driver) => `"${driver.phrase}"`).join(", ")}) signals, so neither sentiment dominates.`
        : "The phrase-based rules found no clear positive or negative expressions, so this feedback is treated as neutral; unrecognized emotional language may be missed.",
    };
  }
  const sentiment = positive.length > negative.length ? "POSITIVE" : "NEGATIVE";
  const supporting = sentiment === "POSITIVE" ? positive : negative;
  return {
    sentiment,
    justification: `The phrase-based rules found more ${sentiment.toLowerCase()} signals, including ${supporting.slice(0, 3).map((driver) => `"${driver.phrase}"`).join(", ")}.${positive.length && negative.length ? " Contrasting signals are present, but do not dominate." : ""}`,
  };
}

export function mockAnalysis(text: string): Analysis {
  const drivers = extractDrivers(text);
  const balance = drivers.reduce(
    (total, driver) => total + (driver.sentiment === "POSITIVE" ? 1 : -1),
    0,
  );
  const sentiment = balance >= 0 ? "POSITIVE" : "NEGATIVE";
  return {
    sentiment,
    confidence: drivers.length
      ? Math.min(
          0.96,
          0.5 +
            (Math.abs(balance) / drivers.length) * 0.38 +
            Math.min(drivers.length, 4) * 0.02,
        )
      : 0.5,
    source: "demo",
    drivers,
    rationale: explain(sentiment, drivers),
  };
}
