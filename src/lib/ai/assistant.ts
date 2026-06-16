import OpenAI from "openai";
import type { PlanLanguage } from "@/lib/types";

// ---------------------------------------------------------------------------
// AI assistant — strictly NON-autonomous.
//
// It only performs administrative language tasks on text the nutritionist has
// already written: translate, summarise, improve wording. It never invents meal
// plans, dosages or clinical recommendations. When no OPENAI_API_KEY is set the
// functions degrade gracefully and return the input unchanged.
// ---------------------------------------------------------------------------

export type AiTask = "translate" | "improve" | "summarize";

const SYSTEM: Record<AiTask, string> = {
  translate:
    "You are a clinical translator for a nutritionist. Translate the given text faithfully, preserving meaning, food terms, quantities and formatting. Do not add or remove clinical content. Output only the translated text.",
  improve:
    "You improve the clarity and tone of a nutritionist's clinical text without changing its meaning, quantities or recommendations. Keep the same language. Output only the improved text.",
  summarize:
    "You summarise a nutrition consultation into a short, factual clinical note. Do not infer clinical decisions. Output only the summary.",
};

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function runAssistant(
  task: AiTask,
  text: string,
  targetLanguage?: PlanLanguage,
): Promise<string> {
  if (!text.trim() || !isAiConfigured()) return text;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const langName = targetLanguage === "en" ? "English" : "European Portuguese (pt-PT)";
  const userPrompt =
    task === "translate" ? `Translate to ${langName}:\n\n${text}` : text;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM[task] },
      { role: "user", content: userPrompt },
    ],
  });
  return res.choices[0]?.message?.content?.trim() || text;
}
