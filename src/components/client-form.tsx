"use client";

import { useTranslations } from "next-intl";
import type { Client } from "@/lib/types";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

/** The client fields, shared by the create page and the edit dialog. */
export function ClientFields({ client }: { client?: Partial<Client> }) {
  const t = useTranslations("clients");
  const tn = useTranslations("nutrition");
  return (
    <div className="space-y-4">
      <Field label={`${t("name")} *`} htmlFor="name">
        <Input id="name" name="name" required maxLength={200} defaultValue={client?.name ?? ""} autoComplete="off" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("email")} htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} autoComplete="off" />
        </Field>
        <Field label={t("phone")} htmlFor="phone" hint={t("phoneHint")}>
          <Input id="phone" name="phone" type="tel" defaultValue={client?.phone ?? ""} placeholder="912 345 678" autoComplete="off" />
        </Field>
        <Field label={t("birthDate")} htmlFor="birthDate">
          <Input id="birthDate" name="birthDate" type="date" defaultValue={client?.birthDate ?? ""} max={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label={tn("sex")} htmlFor="sex">
          <Select id="sex" name="sex" defaultValue={client?.sex ?? ""}>
            <option value="">—</option>
            <option value="female">{tn("female")}</option>
            <option value="male">{tn("male")}</option>
          </Select>
        </Field>
      </div>
      <Field label={tn("profession")} htmlFor="profession">
        <Input id="profession" name="profession" defaultValue={client?.profession ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("nif")} htmlFor="nif">
          <Input id="nif" name="nif" inputMode="numeric" maxLength={20} defaultValue={client?.nif ?? ""} autoComplete="off" />
        </Field>
        <Field label={t("healthInsurer")} htmlFor="healthInsurer" hint={t("healthInsurerHint")}>
          <Input id="healthInsurer" name="healthInsurer" maxLength={120} defaultValue={client?.healthInsurer ?? ""} placeholder="Médis, Multicare…" autoComplete="off" />
        </Field>
        <Field label={t("insuranceNumber")} htmlFor="insuranceNumber">
          <Input id="insuranceNumber" name="insuranceNumber" maxLength={60} defaultValue={client?.insuranceNumber ?? ""} autoComplete="off" />
        </Field>
      </div>
      <input type="hidden" name="clientForm" value="1" />
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="nutritionVoucher" defaultChecked={!!client?.nutritionVoucher} className="mt-0.5 size-4 accent-brand" />
        <span>
          {t("voucher")}
          <span className="block text-xs text-muted-foreground">{t("voucherHint")}</span>
        </span>
      </label>
      <Field label={t("dataConsent")} htmlFor="dataConsentAt" hint={t("dataConsentHint")} className="sm:w-64">
        <Input id="dataConsentAt" name="dataConsentAt" type="date" defaultValue={client?.dataConsentAt ?? ""} max={new Date().toISOString().slice(0, 10)} />
      </Field>
      <Field label={t("goals")} htmlFor="goals">
        <Textarea id="goals" name="goals" rows={2} defaultValue={client?.goals ?? ""} />
      </Field>
      <Field label={t("notes")} htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} />
      </Field>
    </div>
  );
}
