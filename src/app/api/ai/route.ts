import { NextResponse, type NextRequest } from "next/server";
import { isAiConfigured, runAssistant, type AiTask } from "@/lib/ai/assistant";
import type { PlanLanguage } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    task: AiTask;
    text: string;
    targetLanguage?: PlanLanguage;
  };
  if (!body?.task || typeof body.text !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = await runAssistant(body.task, body.text, body.targetLanguage);
  return NextResponse.json({ result, configured: isAiConfigured() });
}
