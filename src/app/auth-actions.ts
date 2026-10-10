"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { redirect } from "@/i18n/routing";
import {
  authenticate,
  changeLoginEmail,
  changePassword,
  disableMfa,
  getAuthNid,
  getLoginEmail,
  redeemEmailLink,
  requestPasswordReset,
  setPassword,
  signOut,
  startMfaEnrollment,
  verifyMfa,
} from "@/lib/data/repo";
import { EMAIL_LINK_TYPES, type EmailChangeResult, type MfaEnrollment, type PasswordResult } from "@/lib/data/repo-types";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { clearAttempts, isLimited, LOGIN_LIMIT, MFA_LIMIT, recordAttempt, RESET_LIMIT } from "@/lib/auth/rate-limit";

// Accounts are created by the studio (scripts/admin.ts) — there is no signup.

export type AuthError = "invalid" | "locked" | "link" | "weak" | "same" | "mismatch" | "code" | "failed";
export type AuthResult = { error: AuthError } | void;

const email = z.string().trim().toLowerCase().email().max(254);
const credentials = z.object({ email, password: z.string().min(1).max(200) });
const newPassword = z.string().min(MIN_PASSWORD_LENGTH).max(200);
const totpCode = z.string().trim().regex(/^\d{6}$/);

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function loginAction(locale: string, formData: FormData): Promise<AuthResult> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "invalid" };
  const keys = [`login:ip:${await clientIp()}`, `login:email:${parsed.data.email}`];
  if (keys.some((k) => isLimited(k, LOGIN_LIMIT))) return { error: "locked" };

  const status = await authenticate(parsed.data.email, parsed.data.password);
  if (status === "invalid") {
    keys.forEach((k) => recordAttempt(k, LOGIN_LIMIT));
    return { error: "invalid" };
  }
  clearAttempts(keys[1]);
  redirect({ href: status === "mfa" ? "/mfa" : "/", locale });
}

export async function logoutAction(locale: string): Promise<void> {
  await signOut();
  redirect({ href: "/login", locale });
}

/** Always resolves the same way, so it cannot be used to probe for accounts. */
export async function forgotPasswordAction(_locale: string, formData: FormData): Promise<void> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return;
  const keys = [`reset:ip:${await clientIp()}`, `reset:email:${parsed.data}`];
  if (keys.some((k) => isLimited(k, RESET_LIMIT))) return;
  keys.forEach((k) => recordAttempt(k, RESET_LIMIT));
  await requestPasswordReset(parsed.data);
}

/** Redeems an emailed link. Runs from a button so mail scanners cannot use it up. */
export async function redeemLinkAction(locale: string, tokenHash: string, type: string): Promise<AuthResult> {
  const parsed = z.object({ tokenHash: z.string().min(10).max(500), type: z.enum(EMAIL_LINK_TYPES) }).safeParse({ tokenHash, type });
  if (!parsed.success || !(await redeemEmailLink(parsed.data.tokenHash, parsed.data.type))) return { error: "link" };
  const choosesPassword = parsed.data.type === "invite" || parsed.data.type === "recovery";
  redirect({ href: choosesPassword ? "/update-password" : "/settings", locale });
}

function passwordFailure(result: PasswordResult): AuthResult {
  return result === "ok" ? undefined : { error: result };
}

/** Choose a password after an invite or recovery link. */
export async function setPasswordAction(locale: string, formData: FormData): Promise<AuthResult> {
  const password = newPassword.safeParse(formData.get("password"));
  if (!password.success) return { error: "weak" };
  if (formData.get("confirm") !== password.data) return { error: "mismatch" };
  if (!(await getLoginEmail())) return { error: "link" };
  const failure = passwordFailure(await setPassword(password.data));
  if (failure) return failure;
  redirect({ href: "/", locale });
}

export async function verifyMfaAction(locale: string, formData: FormData, next?: string): Promise<AuthResult> {
  const code = totpCode.safeParse(formData.get("code"));
  if (!code.success) return { error: "code" };
  const key = `mfa:${(await getLoginEmail()) ?? (await clientIp())}`;
  if (isLimited(key, MFA_LIMIT)) return { error: "locked" };
  if (!(await verifyMfa(code.data))) {
    recordAttempt(key, MFA_LIMIT);
    return { error: "code" };
  }
  clearAttempts(key);
  redirect({ href: next === "/update-password" ? next : "/", locale });
}

// --- Account & security (signed in) ----------------------------------------

export async function changePasswordAction(_locale: string, formData: FormData): Promise<AuthResult> {
  if (!(await getAuthNid())) return { error: "failed" };
  const current = String(formData.get("current") ?? "");
  const password = newPassword.safeParse(formData.get("password"));
  if (!password.success) return { error: "weak" };
  if (formData.get("confirm") !== password.data) return { error: "mismatch" };
  const key = `password:${await getAuthNid()}`;
  if (isLimited(key, LOGIN_LIMIT)) return { error: "locked" };
  const result = await changePassword(current, password.data);
  if (result === "invalid") recordAttempt(key, LOGIN_LIMIT);
  return passwordFailure(result);
}

export async function changeLoginEmailAction(_locale: string, formData: FormData): Promise<EmailChangeResult | "invalid"> {
  if (!(await getAuthNid())) return "failed";
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return "invalid";
  return changeLoginEmail(parsed.data);
}

export async function startMfaAction(_locale: string): Promise<MfaEnrollment | null> {
  if (!(await getAuthNid())) return null;
  return startMfaEnrollment();
}

export async function confirmMfaAction(_locale: string, factorId: string, code: string): Promise<boolean> {
  if (!(await getAuthNid())) return false;
  const parsed = totpCode.safeParse(code);
  return parsed.success && verifyMfa(parsed.data, String(factorId).slice(0, 100));
}

export async function disableMfaAction(_locale: string): Promise<boolean> {
  if (!(await getAuthNid())) return false;
  return disableMfa();
}
