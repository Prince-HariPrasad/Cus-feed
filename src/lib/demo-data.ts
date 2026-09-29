import { mockAnalysis } from "./rationale";
import type { Review } from "./types";

const EXAMPLES = [
  [
    "102",
    "Sarah M.",
    "Such a lovely visit! The staff were incredibly friendly and helped me find exactly what I needed. Everything was well stocked and checkout was quick.",
  ],
  [
    "103",
    "James R.",
    "The products are great, but there was a long wait at checkout. Only one counter was open and the staff seemed overwhelmed. A disappointing end to the visit.",
  ],
  [
    "104",
    "Priya K.",
    "Really impressed with how clean and welcoming the store is. The team was so helpful with my questions. Will definitely be back!",
  ],
  [
    "102",
    "Alex T.",
    "Excellent service as always. A good selection of products, great value, and a friendly face at the checkout.",
  ],
  [
    "103",
    "Emma W.",
    "The item I came for was out of stock again. The assistant was unhelpful and the shelves were messy. Pretty disappointed with this visit.",
  ],
  [
    "104",
    "Daniel L.",
    "Found everything on my list. Fresh products, affordable prices, and quick service. A great little neighborhood store.",
  ],
  [
    "102",
    "Olivia H.",
    "The staff were attentive without being pushy. Loved the good selection and the store was spotless.",
  ],
  [
    "104",
    "Noah C.",
    "A wonderful visit with really kind staff. The quality of the products makes it worth the trip.",
  ],
  [
    "103",
    "Isabella B.",
    "The store was clean but the service was slow and several items were overpriced. Not very happy with the experience.",
  ],
  [
    "102",
    "Lucas A.",
    "Helpful team, efficient checkout, and great value. Exactly what I was looking for.",
  ],
  [
    "104",
    "Mia S.",
    "The team was so welcoming. Everything was fresh and the service was excellent.",
  ],
  [
    "102",
    "Ethan J.",
    "Friendly staff and a tidy store. My order was ready and the entire visit was quick and easy.",
  ],
] as const;

export function createDemoReviews(now: number): Review[] {
  return EXAMPLES.map(([outletId, customer, text], index) => ({
    ...mockAnalysis(text),
    id: `sample-${index + 1}`,
    outletId,
    customer,
    text,
    createdAt: new Date(now - (index * 5 + 0.3) * 3_600_000).toISOString(),
  }));
}
