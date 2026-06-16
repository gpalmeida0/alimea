// ---------------------------------------------------------------------------
// SMS provider abstraction.
//
// By default Alimea uses a "log/preview" provider that records the message to
// the in-memory outbox and console — so the whole reminder flow works with zero
// setup. Set the TWILIO_* env vars to send real SMS through Twilio; no extra
// dependency is needed (the REST API is called with fetch).
// ---------------------------------------------------------------------------

export interface SmsResult {
  status: "sent" | "simulated" | "failed";
  provider: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  send(to: string, body: string): Promise<SmsResult>;
}

const logProvider: SmsProvider = {
  name: "preview",
  async send(to, body) {
    console.info(`[SMS preview] → ${to}: ${body}`);
    return { status: "simulated", provider: "preview" };
  },
};

function twilioProvider(): SmsProvider {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM!;
  return {
    name: "twilio",
    async send(to, body) {
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: to, From: from, Body: body }),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          return { status: "failed", provider: "twilio", error: text.slice(0, 200) };
        }
        return { status: "sent", provider: "twilio" };
      } catch (e) {
        return { status: "failed", provider: "twilio", error: String(e) };
      }
    },
  };
}

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM,
  );
}

export function getSmsProvider(): SmsProvider {
  return isSmsConfigured() ? twilioProvider() : logProvider;
}
