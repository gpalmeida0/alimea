import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAiConfigured, runAssistant } from "@/lib/ai/assistant";
import { getAuthNid } from "@/lib/data/repo";

export const runtime = "nodejs";

const body = z.object({
  task: z.enum(["translate", "improve", "summarize"]),
  text: z.string().max(8000),
  targetLanguage: z.enum(["pt-PT", "en"]).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await getAuthNid())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!isAiConfigured()) {
    return NextResponse.json({ result: parsed.data.text, configured: false });
  }
  try {
    const { task, text, targetLanguage } = parsed.data;
    const result = await runAssistant(task, text, targetLanguage);
    return NextResponse.json({ result, configured: true });
  } catch (e) {
    console.error("[alimea] AI assistant failed", e);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}
