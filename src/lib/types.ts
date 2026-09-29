export type Sentiment = "POSITIVE" | "NEGATIVE";

export const CARDIFF_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest";
export const IRONY_MODEL = "cardiffnlp/twitter-roberta-base-irony";
export const IRONY_THRESHOLD = 0.5;
export const DEBERTA_BASE_MODEL = "microsoft/deberta-v3-base";
export type ExperimentalSarcasmResult =
  | { status: "available"; model: string; score: number; assessment: "possible-sarcasm" | "insufficient-evidence" }
  | { status: "unavailable"; model: string | null; reason: string }
  | { status: "not-configured"; model: null; reason: string };
export type IronyResult =
  | { status: "available"; score: number; flagged: boolean }
  | { status: "unavailable"; reason: string }
  | { status: "not-run" };

// Heuristic trust score, not a calibrated probability.
export type FinalScore = {
  literalConfidence: number;
  ironyScore: number;
  adjustedConfidence: number;
  recommendation: string;
};
export type ThreeWaySentiment = Sentiment | "NEUTRAL";
export type SentimentDashboardResult = {
  sentiment: ThreeWaySentiment;
  scores: Record<ThreeWaySentiment, number>;
  model: string;
  source: "demo" | "huggingface";
  justification: string;
  irony: IronyResult;
  experimentalSarcasm: ExperimentalSarcasmResult;
  final: FinalScore | null;
};

export type Driver = {
  phrase: string;
  topic: string;
  sentiment: Sentiment;
  start: number;
  end: number;
};

export type Analysis = {
  sentiment: Sentiment;
  confidence: number;
  source: "demo" | "huggingface";
  drivers: Driver[];
  rationale: string;
};

export type Review = Analysis & {
  id: string;
  outletId: string;
  text: string;
  createdAt: string;
  customer: string;
};

export const OUTLETS = [
  {
    id: "102",
    name: "Downtown",
    address: "124 Market Street",
    initials: "DT",
    image: "/images/downtown.jpg",
  },
  {
    id: "103",
    name: "Westside",
    address: "86 West Avenue",
    initials: "WS",
    image: "/images/westside.jpg",
  },
  {
    id: "104",
    name: "Riverside",
    address: "32 River Walk",
    initials: "RS",
    image: "/images/riverside.jpg",
  },
] as const;
