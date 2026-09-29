import { NextResponse } from "next/server";
import { analyzeWithCardiff } from "@/lib/cardiff";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 12_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Please send valid JSON." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("text" in payload) || typeof payload.text !== "string" || !payload.text.trim() || payload.text.trim().length > 2000) {
    return NextResponse.json({ error: "Enter between 1 and 2,000 characters of feedback." }, { status: 400 });
  }
  try {
    return NextResponse.json(await analyzeWithCardiff(payload.text.trim()));
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "Analysis timed out. Please try again." : error instanceof Error ? error.message : "Analysis failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}