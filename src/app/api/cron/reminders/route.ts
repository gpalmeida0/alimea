import { NextResponse, type NextRequest } from "next/server";
import { cronReminderStore } from "@/lib/data/repo";
import { sendDueReminders } from "@/lib/messaging/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily reminder job (see vercel.json). Vercel Cron sends
// "Authorization: Bearer $CRON_SECRET" automatically when CRON_SECRET is set.
// In production the endpoint refuses to run without a secret.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = cronReminderStore();
  if (!store) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 503 });
  }
  const summary = await sendDueReminders(store);
  return NextResponse.json({
    ok: true,
    processed: summary.processed,
    failed: summary.results.filter((r) => r.status === "failed").length,
    ranAt: new Date().toISOString(),
  });
}

export const GET = handle;
export const POST = handle;
