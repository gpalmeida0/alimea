import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  computeBmi,
  heightCmOf,
  sumPerimeters,
  sumSkinfolds,
  type FoodItem,
  type MealOption,
  type Measurements,
  type PlanDocumentData,
  type PlanLanguage,
} from "@/lib/types";
import { formatItem } from "@/lib/nutrition/items";
import { formatDate } from "@/lib/utils";
import { embedFonts, type AlimeaFonts } from "./fonts";
import { pdfLabels } from "./labels";

// --- A4 geometry (template is 828x1170px → 595.28x841.89pt) ----------------
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const BOTTOM = MARGIN + 20;
const CONTENT_TOP = PAGE_H - 110;

// --- Palette sampled from the template --------------------------------------
const c = (r: number, g: number, b: number) => rgb(r / 255, g / 255, b / 255);
const CREAM = c(244, 241, 238);
const INK = c(74, 74, 74);
const TAUPE = c(180, 157, 138);
const BAND = c(236, 231, 224);
const GREEN = c(46, 125, 50);
const LIGHT = c(210, 202, 193);

interface Ctx {
  doc: PDFDocument;
  f: AlimeaFonts;
  L: ReturnType<typeof pdfLabels>;
  lang: PlanLanguage;
  data: PlanDocumentData;
}

// --- text helpers -----------------------------------------------------------
function fill(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
}

/** Replace characters the embedded fonts cannot render (tabs, emoji…). */
function clean(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return [...text.replace(/\t/g, "  ").replace(/\r/g, "")]
    .map((ch) => (ch === "\n" || supported.has(ch.codePointAt(0)!) ? ch : ch.trim() ? "" : " "))
    .join("");
}

const width = (font: PDFFont, text: string, size: number) => font.widthOfTextAtSize(text, size);

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const t = clean(text, font);
  page.drawText(t, { x: (PAGE_W - width(font, t, size)) / 2, y, font, size, color });
}

/** Word-wrap into lines that fit maxWidth (breaking over-long words). Respects "\n". */
function wrapLines(font: PDFFont, raw: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of clean(raw, font).split("\n")) {
    if (para.trim() === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (let word of para.split(/\s+/).filter(Boolean)) {
      // Hard-break words wider than the column (URLs, long compound words).
      while (width(font, word, size) > maxWidth) {
        let cut = word.length - 1;
        while (cut > 1 && width(font, word.slice(0, cut), size) > maxWidth) cut--;
        if (line) out.push(line);
        out.push(word.slice(0, cut));
        line = "";
        word = word.slice(cut);
      }
      const trial = line ? `${line} ${word}` : word;
      if (line && width(font, trial, size) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Page flow: content pages share the contact header and paginate on demand.
// ---------------------------------------------------------------------------
class Flow {
  page!: PDFPage;
  y = 0;
  constructor(private ctx: Ctx) {
    this.newPage();
  }
  newPage() {
    this.page = this.ctx.doc.addPage([PAGE_W, PAGE_H]);
    fill(this.page);
    contactHeader(this.ctx, this.page);
    this.y = CONTENT_TOP;
  }
  /** Start a new page unless `needed` points still fit. */
  ensure(needed: number) {
    if (this.y - needed < BOTTOM) this.newPage();
  }
  /** Draw wrapped lines, breaking across pages line by line. */
  lines(lines: string[], x: number, font: PDFFont, size: number, leading: number, color = INK) {
    for (const line of lines) {
      this.ensure(leading);
      if (line) this.page.drawText(line, { x, y: this.y, font, size, color });
      this.y -= leading;
    }
  }
}

function contactHeader(ctx: Ctx, page: PDFPage) {
  const { f } = ctx;
  const p = ctx.data.profile;
  const lines = [
    p.email,
    p.instagram ? `IG: ${p.instagram.replace(/^@/, "")}` : "",
    p.credential ? `CP: ${p.credential}` : "",
  ].filter(Boolean);
  let y = PAGE_H - 40;
  for (const raw of lines) {
    const line = clean(raw, f.scRegular);
    page.drawText(line, { x: PAGE_W - MARGIN - width(f.scRegular, line, 8), y, font: f.scRegular, size: 8, color: INK });
    y -= 13;
  }
}

// ---------------------------------------------------------------------------
// Page 1 — Cover
// ---------------------------------------------------------------------------
function drawCover(ctx: Ctx) {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  fill(page);
  const { f, L, data } = ctx;
  centered(page, L.planTitle, PAGE_H - 360, f.scBold, 46, INK);
  const nameSize = width(f.scSemibold, data.client.name, 24) > PAGE_W - 120 ? 18 : 24;
  centered(page, data.client.name, PAGE_H - 405, f.scSemibold, nameSize, TAUPE);

  // Minimalist apple mark (brand green).
  const cx = PAGE_W / 2;
  const cy = 235;
  page.drawCircle({ x: cx - 7, y: cy, size: 15, color: c(150, 200, 145) });
  page.drawCircle({ x: cx + 7, y: cy, size: 15, color: c(124, 184, 120) });
  page.drawCircle({ x: cx, y: cy + 2, size: 12, color: c(168, 210, 162) });
  page.drawEllipse({ x: cx + 4, y: cy + 18, xScale: 7, yScale: 3, rotate: { type: "degrees", angle: 35 } as never, color: GREEN });
  page.drawLine({ start: { x: cx, y: cy + 14 }, end: { x: cx + 2, y: cy + 22 }, thickness: 1.2, color: GREEN });

  const d = new Date(data.consultation?.date ?? data.plan.createdAt);
  if (!Number.isNaN(d.getTime())) {
    const s = formatDate(data.consultation?.date ?? data.plan.createdAt, ctx.lang === "en" ? "en-GB" : "pt-PT", {
      month: "long",
      year: "numeric",
    });
    centered(page, s.charAt(0).toUpperCase() + s.slice(1), 175, f.scSemibold, 17, INK);
  }
}

// ---------------------------------------------------------------------------
// Page 2 — Measurements sheet (current vs previous consultation)
// ---------------------------------------------------------------------------
type MeasureRow =
  | { kind: "row"; label: string; v1?: number; v2?: number; band?: boolean; optional?: boolean }
  | { kind: "gap" }
  | { kind: "heading"; label: string };

function measurementRows(ctx: Ctx, cur: Measurements, prev?: Measurements): MeasureRow[] {
  const { L } = ctx;
  const P = (k: keyof Measurements["perimeters"]) => [cur.perimeters[k], prev?.perimeters[k]] as const;
  const S = (k: keyof Measurements["skinfolds"]) => [cur.skinfolds[k], prev?.skinfolds[k]] as const;
  const row = (label: string, [v1, v2]: readonly [number | undefined, number | undefined], optional = true): MeasureRow => ({
    kind: "row",
    label,
    v1,
    v2,
    optional,
  });
  const rows: MeasureRow[] = [
    row(L.weight, [cur.weightKg, prev?.weightKg], false),
    row(L.height, [heightCmOf(cur), heightCmOf(prev)], false),
    { kind: "row", label: L.bmi, v1: computeBmi(cur), v2: prev && computeBmi(prev), band: true },
    { kind: "gap" },
    row(L.waist, P("waist"), false),
    row(L.abdominalPerimeter, P("abdominal")),
    row(L.chest, P("chest")),
    row(L.arm, P("arm"), false),
    row(L.hip, P("hip"), false),
    row(L.thigh, P("thigh"), false),
    row(L.calf, P("calf"), false),
    { kind: "row", label: L.sumPerimeters, v1: sumPerimeters(cur), v2: prev && sumPerimeters(prev), band: true },
    { kind: "gap" },
    row(L.tricipital, S("tricipital")),
    row(L.subscapular, S("subscapular")),
    row(L.bicipital, S("bicipital")),
    row(L.iliocristal, S("iliocristal")),
    row(L.supraspinal, S("supraspinal")),
    row(L.abdominal, S("abdominal")),
    row(L.geminal, S("geminal")),
    row(L.crural, S("crural")),
    row(L.peitoral, S("peitoral")),
    { kind: "row", label: L.sumSkinfolds, v1: sumSkinfolds(cur), v2: prev && sumSkinfolds(prev), band: true, optional: true },
    { kind: "heading", label: L.anthropometry },
    // The values chosen on the Results tab — never the bioimpedance readouts.
    row(L.bodyFat, [cur.results?.bodyFatPct, prev?.results?.bodyFatPct], false),
    row(L.muscleMass, [cur.results?.muscleMassKg, prev?.results?.muscleMassKg], false),
  ];
  // Optional rows are only printed when there is a value to show.
  return rows.filter((r) => r.kind !== "row" || !r.optional || r.v1 != null || r.v2 != null);
}

function drawMeasurements(ctx: Ctx) {
  const { f, L, data } = ctx;
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  fill(page);
  centered(page, L.measurementsSheet, PAGE_H - 70, f.scBold, 30, TAUPE);
  const cur = data.consultation?.measurements;
  if (!cur) return;
  const prev = data.previousConsultation?.measurements;

  const labelRight = 300;
  const col1 = 340;
  const col2 = 470;
  let y = PAGE_H - 130;

  const date = (d?: string) => (d ? formatDate(d, "pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
  page.drawText(date(data.consultation?.date), { x: col1, y, font: f.scRegular, size: 11, color: INK });
  if (data.previousConsultation) {
    page.drawText(date(data.previousConsultation.date), { x: col2, y, font: f.scRegular, size: 11, color: INK });
  }
  y -= 28;

  const rows = measurementRows(ctx, cur, prev);
  // Fit everything on one page: shrink the row pitch when there are many rows.
  const units = rows.reduce((n, r) => n + (r.kind === "row" ? 1 : r.kind === "heading" ? 1.6 : 0.3), 0);
  const pitch = Math.min(32, (y - BOTTOM) / units);
  const size = pitch < 26 ? 11 : 12;

  const dec = ctx.lang === "en" ? "." : ",";
  const fmt = (n?: number) => (n == null ? "" : String(Math.round(n * 10) / 10).replace(".", dec));

  for (const r of rows) {
    if (r.kind === "gap") {
      y -= pitch * 0.3;
      continue;
    }
    if (r.kind === "heading") {
      y -= pitch * 0.2;
      page.drawRectangle({ x: 200, y: y - 7, width: PAGE_W - 400 + 200, height: 24, color: BAND });
      centered(page, r.label, y, f.scRegular, 13, INK);
      y -= pitch * 1.4;
      continue;
    }
    if (r.band) page.drawRectangle({ x: 30, y: y - 7, width: PAGE_W - 60, height: pitch * 0.75, color: BAND });
    const label = clean(r.label, f.scRegular);
    page.drawText(label, { x: labelRight - width(f.scRegular, label, size), y, font: f.scRegular, size, color: INK });
    if (r.v1 != null) page.drawText(fmt(r.v1), { x: col1, y, font: f.body, size: size - 1, color: INK });
    if (r.v2 != null) page.drawText(fmt(r.v2), { x: col2, y, font: f.body, size: size - 1, color: INK });
    y -= pitch;
  }
}

// ---------------------------------------------------------------------------
// Meal pages — meals flow across as many pages as needed
// ---------------------------------------------------------------------------
function drawMeals(ctx: Ctx) {
  const { f, L, data } = ctx;
  // Some plans print only what the nutritionist wrote, without the food list.
  const itemsOf = (o: MealOption) => (data.plan.hideFoodItems ? [] : (o.items ?? []));
  const meals = data.plan.meals.filter((m) => m.name.trim() || m.options.some((o) => o.content.trim() || itemsOf(o).length));
  if (!meals.length) return;
  const flow = new Flow(ctx);
  const SIZE = 11.5;
  const LEAD = 16;
  const contentX = 175;

  for (const meal of meals) {
    flow.ensure(80);
    const title = clean(meal.name + (meal.time ? `  ·  ${meal.time}` : ""), f.scBold);
    flow.page.drawText(title, { x: MARGIN + 20, y: flow.y, font: f.scBold, size: 22, color: INK });
    flow.y -= 36;

    const options = meal.options.filter((o) => o.content.trim() || itemsOf(o).length);
    const multi = options.length > 1;
    options.forEach((opt, i) => {
      const x = multi ? contentX : MARGIN + 8;
      const maxW = PAGE_W - MARGIN - x;
      const itemLines = itemsOf(opt).map((it: FoodItem) => `• ${formatItem(it, L.portion)}`);
      const text = [opt.content.trim(), ...itemLines].filter(Boolean).join("\n");
      const lines = wrapLines(f.body, text, SIZE, maxW);

      // Keep short blocks together; long ones flow across pages.
      flow.ensure(Math.min(lines.length * LEAD + 10, CONTENT_TOP - BOTTOM));
      if (multi) {
        flow.page.drawText(L.option(i + 1), { x: MARGIN + 8, y: flow.y - 2, font: f.scMedium, size: 11, color: TAUPE });
        const top = flow.y + 10;
        const startPage = flow.page;
        flow.lines(lines, x, f.body, SIZE, LEAD);
        if (flow.page === startPage) {
          flow.page.drawLine({
            start: { x: contentX - 18, y: top },
            end: { x: contentX - 18, y: flow.y + LEAD - 4 },
            thickness: 1,
            color: LIGHT,
          });
        }
        flow.y -= 14;
      } else {
        // Single block: highlight "Label - rest" prefixes like the template.
        for (const line of lines) {
          flow.ensure(LEAD);
          const sep = line.indexOf(" - ");
          if (sep > 0 && sep < 14 && !line.startsWith("•")) {
            const label = line.slice(0, sep);
            flow.page.drawText(label, { x, y: flow.y, font: f.scMedium, size: SIZE, color: TAUPE });
            flow.page.drawText(line.slice(sep), {
              x: x + width(f.scMedium, label, SIZE),
              y: flow.y,
              font: f.body,
              size: SIZE,
              color: INK,
            });
          } else if (line) {
            flow.page.drawText(line, { x, y: flow.y, font: f.body, size: SIZE, color: INK });
          }
          flow.y -= LEAD;
        }
        flow.y -= 8;
      }
    });
    flow.y -= 18;
  }
}

// ---------------------------------------------------------------------------
// Supplementation + notes
// ---------------------------------------------------------------------------
function drawSupplementsNotes(ctx: Ctx) {
  const { plan } = ctx.data;
  const supp = plan.supplementation?.trim();
  const notes = plan.notes?.trim();
  if (!supp && !notes) return;
  const { f, L } = ctx;
  const flow = new Flow(ctx);
  const maxW = PAGE_W - MARGIN * 2 - 8;

  const section = (title: string, body: string, color: typeof INK) => {
    flow.ensure(60);
    flow.page.drawText(title, { x: MARGIN, y: flow.y, font: f.scBold, size: 20, color });
    flow.y -= 30;
    flow.lines(wrapLines(f.body, body, 11.5, maxW), MARGIN + 8, f.body, 11.5, 16);
    flow.y -= 24;
  };
  if (supp) section(L.supplementation, supp, INK);
  if (notes) section(L.notes, notes, TAUPE);
}

// ---------------------------------------------------------------------------
// Back cover — quote, next appointment, contacts, logo
// ---------------------------------------------------------------------------
async function embedImage(doc: PDFDocument, bytes?: Uint8Array): Promise<PDFImage | undefined> {
  if (!bytes || bytes.length < 4) return undefined;
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
  } catch {
    /* unreadable image → no logo */
  }
  return undefined;
}

async function drawBackCover(ctx: Ctx, logoBytes?: Uint8Array) {
  const { f, L, doc, data } = ctx;
  const { plan, profile } = data;
  const page = doc.addPage([PAGE_W, PAGE_H]);
  fill(page);

  if (plan.motivationalQuote?.trim()) {
    const lines = wrapLines(f.scBold, `“${plan.motivationalQuote.trim()}”`, 30, PAGE_W - 160).slice(0, 5);
    let y = PAGE_H - 200;
    for (const line of lines) {
      centered(page, line, y, f.scBold, 30, TAUPE);
      y -= 42;
    }
  }

  if (plan.nextAppointment?.trim()) {
    centered(page, L.nextConsultation, PAGE_H - 410, f.scSemibold, 15, INK);
    centered(page, plan.nextAppointment.trim(), PAGE_H - 435, f.scSemibold, 15, TAUPE);
  }

  const contacts = [profile.address, profile.phone, profile.instagram].filter((s): s is string => Boolean(s?.trim()));
  if (contacts.length) {
    const bandY = PAGE_H - 560;
    page.drawRectangle({ x: 0, y: bandY - 6, width: PAGE_W, height: 40, color: BAND });
    const segW = PAGE_W / contacts.length;
    contacts.forEach((raw, i) => {
      let size = 11;
      const txt = clean(raw, f.body);
      while (size > 7 && width(f.body, txt, size) > segW - 16) size -= 0.5;
      page.drawText(txt, { x: i * segW + (segW - width(f.body, txt, size)) / 2, y: bandY + 8, font: f.body, size, color: INK });
    });
  }

  const logo = await embedImage(doc, logoBytes);
  const name = clean(profile.name, f.scSemibold);
  if (logo) {
    const lw = 90;
    const lh = Math.min((logo.height / logo.width) * lw, 120);
    page.drawImage(logo, { x: MARGIN, y: 80, width: (logo.width / logo.height) * lh, height: lh });
    const tx = MARGIN + lw + 16;
    page.drawText(name, { x: tx, y: 130, font: f.scSemibold, size: 22, color: GREEN });
    page.drawText(L.nutritionist, { x: tx, y: 112, font: f.scSemibold, size: 13, color: INK });
    if (profile.credential) {
      page.drawText(clean(L.credential(profile.credential), f.body), { x: tx, y: 96, font: f.body, size: 10, color: INK });
    }
  } else {
    centered(page, name, 130, f.scSemibold, 22, GREEN);
    centered(page, L.nutritionist, 112, f.scSemibold, 13, INK);
    if (profile.credential) centered(page, L.credential(profile.credential), 96, f.body, 10, INK);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function generatePlanPdf(
  data: PlanDocumentData,
  opts: { baseTemplate?: Uint8Array; logo?: Uint8Array } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f = await embedFonts(doc);
  const lang = data.language;
  const ctx: Ctx = { doc, f, L: pdfLabels(lang), lang, data };

  let customCover = false;
  if (opts.baseTemplate) {
    // Custom design: the nutritionist's uploaded PDF first, then the data pages.
    try {
      const base = await PDFDocument.load(opts.baseTemplate, { ignoreEncryption: true });
      const pages = await doc.copyPages(base, base.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
      customCover = true;
    } catch {
      // Corrupt/unreadable template → fall back to the classic design.
    }
  }

  if (!customCover) drawCover(ctx);
  if (data.consultation) drawMeasurements(ctx);
  drawMeals(ctx);
  drawSupplementsNotes(ctx);
  if (!customCover) await drawBackCover(ctx, opts.logo);

  doc.setTitle(`${ctx.L.planTitle} — ${data.client.name}`);
  doc.setAuthor(data.profile.name);
  doc.setCreator("Alimea");
  doc.setLanguage(lang);
  return doc.save();
}
