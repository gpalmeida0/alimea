import { NextResponse, type NextRequest } from "next/server";
import { sendDueReminders } from "@/lib/messaging/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily reminder job. Wire a scheduler to hit this once a day (see vercel.json /
// README). When CRON_SECRET is set, the request must send a matching bearer token.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const summary = await sendDueReminders();
  return NextResponse.json({ ok: true, ...summary, ranAt: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
