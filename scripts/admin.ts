/**
 * Studio admin tool — accounts are created here, never through the app.
 *
 *   npm run admin -- invite <email> "<name>"   create the account, print a set-password link
 *   npm run admin -- invite <email> "<name>" --email   …and let Supabase email the invite
 *   npm run admin -- reset-link <email>        print a password-reset link to send by hand
 *   npm run admin -- reset-mfa <email>         remove 2FA (lost phone)
 *   npm run admin -- disable <email>           block sign-in (e.g. contract ended)
 *   npm run admin -- enable <email>
 *   npm run admin -- list
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * NEXT_PUBLIC_SITE_URL (read from .env.local). Run it from your own machine:
 * the service-role key bypasses every access rule.
 */
import { existsSync } from "node:fs";
import { createClient, type User } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!url || !key) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const [emailArg, nameArg] = rest.filter((a) => !a.startsWith("--"));
const email = emailArg?.trim().toLowerCase();

function needEmail(): string {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("A valid email is required.");
  return email;
}

async function findUser(address: string): Promise<User> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === address);
    if (hit) return hit;
    if (data.users.length < 200) fail(`No account for ${address}`);
  }
}

/** The link the person opens — it lands on the app's /confirm screen. */
function confirmLink(hashedToken: string, type: "invite" | "recovery"): string {
  if (!site) fail("Set NEXT_PUBLIC_SITE_URL (e.g. https://app.alimea.pt) to build links.");
  return `${site}/confirm?token_hash=${hashedToken}&type=${type}`;
}

async function main() {
  switch (command) {
    case "invite": {
      const address = needEmail();
      const name = nameArg?.trim();
      if (!name) fail('A name is required: invite ana@clinic.pt "Ana Silva"');
      if (flags.has("--email")) {
        const { error } = await supabase.auth.admin.inviteUserByEmail(address, { data: { name } });
        if (error) fail(error.message);
        console.log(`✔ Invite emailed to ${address}`);
        break;
      }
      const { data, error } = await supabase.auth.admin.generateLink({ type: "invite", email: address, options: { data: { name } } });
      if (error) fail(error.message);
      console.log(`✔ Account created for ${name} <${address}>`);
      console.log(`  Send them this link to choose a password (single use):\n\n  ${confirmLink(data.properties.hashed_token, "invite")}\n`);
      break;
    }
    case "reset-link": {
      const { data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email: needEmail() });
      if (error) fail(error.message);
      console.log(`✔ Password-reset link (single use):\n\n  ${confirmLink(data.properties.hashed_token, "recovery")}\n`);
      break;
    }
    case "reset-mfa": {
      const user = await findUser(needEmail());
      const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
      if (error) fail(error.message);
      for (const factor of data.factors) {
        const { error: failed } = await supabase.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
        if (failed) fail(failed.message);
      }
      console.log(`✔ Removed ${data.factors.length} two-step factor(s) from ${user.email}`);
      break;
    }
    case "disable":
    case "enable": {
      const user = await findUser(needEmail());
      // ~100 years, or "none" to lift the ban.
      const { error } = await supabase.auth.admin.updateUserById(user.id, { ban_duration: command === "disable" ? "876000h" : "none" });
      if (error) fail(error.message);
      console.log(`✔ ${user.email} is now ${command}d`);
      break;
    }
    case "list": {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) fail(error.message);
      console.table(
        data.users.map((u) => ({
          email: u.email,
          name: u.user_metadata?.name ?? "",
          created: u.created_at.slice(0, 10),
          lastSignIn: u.last_sign_in_at?.slice(0, 10) ?? "never",
          twoStep: (u.factors ?? []).some((f) => f.status === "verified") ? "on" : "off",
          disabled: u.banned_until && new Date(u.banned_until) > new Date() ? "yes" : "",
        })),
      );
      break;
    }
    default:
      fail("Usage: npm run admin -- <invite|reset-link|reset-mfa|disable|enable|list> [email] [name] [--email]");
  }
}

void main();
