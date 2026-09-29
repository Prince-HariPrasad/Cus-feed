import { NextResponse } from "next/server";
import { analyzeFeedback } from "@/lib/huggingface";
import { OUTLETS } from "@/lib/types";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 12_000)
      return NextResponse.json(
        { error: "Request is too large." },
        { status: 413 },
      );
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Please send valid JSON." },
      { status: 400 },
    );
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("text" in payload) ||
    !("outletId" in payload) ||
    typeof payload.text !== "string" ||
    !OUTLETS.some((outlet) => outlet.id === payload.outletId)
  ) {
    return NextResponse.json(
      { error: "A valid outlet and feedback text are required." },
      { status: 400 },
    );
  }
  const text = payload.text.trim();
  if (text.length < 10 || text.length > 2000)
    return NextResponse.json(
      { error: "Feedback must contain between 10 and 2,000 characters." },
      { status: 400 },
    );
  try {
    const analysis = await analyzeFeedback(text);
    return NextResponse.json({
      ...analysis,
      id: crypto.randomUUID(),
      outletId: payload.outletId,
      text,
      createdAt: new Date().toISOString(),
      customer: "Store visitor",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Analysis timed out. Please try again."
        : error instanceof Error
          ? error.message
          : "Analysis failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
