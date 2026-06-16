"use server";

import { redirect } from "@/i18n/routing";
import { authenticate, createAccount, emailExists, signOut } from "@/lib/data/repo";

export async function loginAction(
  locale: string,
  formData: FormData,
): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nid = await authenticate(email, password);
  if (!nid) return { error: "invalid" };
  redirect({ href: "/", locale });
}

export async function signupAction(
  locale: string,
  formData: FormData,
): Promise<{ error: string } | void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || password.length < 4) return { error: "invalid" };
  if (await emailExists(email)) return { error: "exists" };
  try {
    await createAccount({ name, email, password });
  } catch (e) {
    if (e instanceof Error && e.message === "exists") return { error: "exists" };
    return { error: "invalid" };
  }
  redirect({ href: "/", locale });
}

export async function logoutAction(locale: string): Promise<void> {
  await signOut();
  redirect({ href: "/login", locale });
}
