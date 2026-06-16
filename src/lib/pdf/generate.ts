import { readFileSync } from "node:fs";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  computeBmi,
  sumPerimeters,
  sumSkinfolds,
  type Measurements,
  type PlanDocumentData,
  type PlanLanguage,
} from "@/lib/types";
import { embedFonts, type AlimeaFonts } from "./fonts";
import { pdfLabels } from "./labels";

// --- A4 geometry (template is 828x1170px → 595.28x841.89pt) ----------------
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;

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
}

// --- text helpers -----------------------------------------------------------
function fill(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
}

function textWidth(font: PDFFont, text: string, size: number) {
  return font.widthOfTextAtSize(text, size);
}

function centered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const w = textWidth(font, text, size);
  page.drawText(text, { x: (PAGE_W - w) / 2, y, font, size, color });
}

/** Word-wrap into lines that fit maxWidth. Respects explicit "\n". */
function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para.trim() === "") {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (textWidth(font, trial, size) > maxWidth && line) {
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

/** Draws wrapped text from a top y, returns the y after the block. */
function paragraph(
  page: PDFPage,
  text: string,
  x: number,
  topY: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
  leading: number,
  color = INK,
): number {
  let y = topY;
  for (const line of wrapLines(font, text, size, maxWidth)) {
    if (line) page.drawText(line, { x, y, font, size, color });
    y -= leading;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Page 1 — Cover
// ---------------------------------------------------------------------------
function drawCover(ctx: Ctx, page: PDFPage, data: PlanDocumentData) {
  fill(page);
  const { f, L } = ctx;
  centered(page, L.planTitle, PAGE_H - 360, f.scBold, 46, INK);
  centered(page, data.client.name, PAGE_H - 405, f.scSemibold, 24, TAUPE);

  // Simple stylised apple mark (brand green) — minimalist cover ornament.
  const cx = PAGE_W / 2;
  const cy = 235;
  page.drawCircle({ x: cx - 7, y: cy, size: 15, color: c(150, 200, 145) });
  page.drawCircle({ x: cx + 7, y: cy, size: 15, color: c(124, 184, 120) });
  page.drawCircle({ x: cx, y: cy + 2, size: 12, color: c(168, 210, 162) });
  // leaf
  page.drawEllipse({ x: cx + 4, y: cy + 18, xScale: 7, yScale: 3, rotate: { type: "degrees", angle: 35 } as never, color: GREEN });
  page.drawLine({ start: { x: cx, y: cy + 14 }, end: { x: cx + 2, y: cy + 22 }, thickness: 1.2, color: GREEN });

  const period = monthYear(data.plan, ctx.lang);
  centered(page, period, 175, f.scSemibold, 17, INK);
}

function monthYear(plan: PlanDocumentData["plan"], lang: PlanLanguage): string {
  const d = new Date(plan.createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const s = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt-PT", {
    month: "long",
    year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Page 2 — Measurements sheet
// ---------------------------------------------------------------------------
function drawMeasurements(ctx: Ctx, page: PDFPage, data: PlanDocumentData) {
  fill(page);
  const { f, L } = ctx;
  const cur = data.consultation?.measurements;
  const prev = data.previousConsultation?.measurements;
  if (!cur) {
    centered(page, L.measurementsSheet, PAGE_H - 70, f.scBold, 30, TAUPE);
    return;
  }

  centered(page, L.measurementsSheet, PAGE_H - 70, f.scBold, 30, TAUPE);

  const labelRight = 300; // labels right-aligned to this x
  const col1 = 340;
  const col2 = 470;
  let y = PAGE_H - 130;

  const date = (d?: string) =>
    d ? new Intl.DateTimeFormat("pt-PT").format(new Date(d)) : "";
  // date headers
  page.drawText(date(data.consultation?.date), { x: col1, y, font: f.scRegular, size: 11, color: INK });
  if (data.previousConsultation)
    page.drawText(date(data.previousConsultation.date), { x: col2, y, font: f.scRegular, size: 11, color: INK });
  y -= 26;

  const dec = ctx.lang === "en" ? "." : ",";
  const fmt = (n?: number) =>
    n == null ? "" : Number.isInteger(n) ? String(n) : String(n).replace(".", dec);

  const row = (
    label: string,
    v1?: number,
    v2?: number,
    opts: { band?: boolean; indent?: number } = {},
  ) => {
    const rowH = 24;
    if (opts.band) {
      page.drawRectangle({ x: 30, y: y - 7, width: PAGE_W - 60, height: rowH, color: BAND });
    }
    const size = 12;
    const lw = textWidth(f.scRegular, label, size);
    page.drawText(label, {
      x: labelRight - lw - (opts.indent ?? 0),
      y,
      font: f.scRegular,
      size,
      color: INK,
    });
    if (v1 != null) page.drawText(fmt(v1), { x: col1, y, font: f.body, size: 11, color: INK });
    if (v2 != null) page.drawText(fmt(v2), { x: col2, y, font: f.body, size: 11, color: INK });
    y -= rowH + 8;
  };

  row(L.weight, cur.weightKg, prev?.weightKg);
  row(L.height, m(cur.heightM), m(prev?.heightM));
  row(L.bmi, computeBmi(cur), prev && computeBmi(prev), { band: true });
  y -= 6;
  row(L.waist, cur.perimeters.waist, prev?.perimeters.waist, { indent: -20 });
  row(L.abdominalPerimeter, cur.perimeters.abdominal, prev?.perimeters.abdominal, { indent: -20 });
  row(L.chest, cur.perimeters.chest, prev?.perimeters.chest, { indent: -20 });
  row(L.arm, cur.perimeters.arm, prev?.perimeters.arm, { indent: -20 });
  row(L.hip, cur.perimeters.hip, prev?.perimeters.hip, { indent: -20 });
  row(L.thigh, cur.perimeters.thigh, prev?.perimeters.thigh, { indent: -20 });
  row(L.calf, cur.perimeters.calf, prev?.perimeters.calf, { indent: -20 });
  row(L.sumPerimeters, sumPerimeters(cur), prev && sumPerimeters(prev), { band: true });
  y -= 6;
  row(L.tricipital, cur.skinfolds.tricipital, prev?.skinfolds.tricipital, { indent: -20 });
  row(L.subscapular, cur.skinfolds.subscapular, prev?.skinfolds.subscapular, { indent: -20 });
  row(L.bicipital, cur.skinfolds.bicipital, prev?.skinfolds.bicipital, { indent: -20 });
  row(L.iliocristal, cur.skinfolds.iliocristal, prev?.skinfolds.iliocristal, { indent: -20 });
  row(L.supraspinal, cur.skinfolds.supraspinal, prev?.skinfolds.supraspinal, { indent: -20 });
  row(L.abdominal, cur.skinfolds.abdominal, prev?.skinfolds.abdominal, { indent: -20 });
  row(L.geminal, cur.skinfolds.geminal, prev?.skinfolds.geminal, { indent: -20 });
  row(L.crural, cur.skinfolds.crural, prev?.skinfolds.crural, { indent: -20 });
  row(L.sumSkinfolds, sumSkinfolds(cur), prev && sumSkinfolds(prev), { band: true });

  // Anthropometry band centered
  y -= 10;
  page.drawRectangle({ x: 200, y: y - 7, width: PAGE_W - 400 + 200, height: 26, color: BAND });
  centered(page, L.anthropometry, y, f.scRegular, 13, INK);
  y -= 40;
  row(L.bodyFat, cur.bodyFatPct, prev?.bodyFatPct, { indent: -20 });
  row(L.muscleMass, cur.muscleMassKg, prev?.muscleMassKg, { indent: -20 });
}

function m(v?: number): number | undefined {
  if (v == null) return undefined;
  // store height in m; show as cm-style integer like the template (164)
  return v < 3 ? Math.round(v * 100) : v;
}

// ---------------------------------------------------------------------------
// Meal pages — flow meals across as many pages as needed
// ---------------------------------------------------------------------------
function contactHeader(ctx: Ctx, page: PDFPage, data: PlanDocumentData) {
  const { f } = ctx;
  const p = data.profile;
  const lines = [p.email, p.instagram ? `IG: ${p.instagram.replace("@", "")}` : "", p.credential ? `CP: ${p.credential}` : ""].filter(Boolean);
  let y = PAGE_H - 40;
  for (const line of lines) {
    const w = textWidth(f.scRegular, line, 8);
    page.drawText(line, { x: PAGE_W - MARGIN - w, y, font: f.scRegular, size: 8, color: INK });
    y -= 13;
  }
}

function newMealPage(ctx: Ctx, data: PlanDocumentData): { page: PDFPage; y: number } {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  fill(page);
  contactHeader(ctx, page, data);
  return { page, y: PAGE_H - 110 };
}

function drawMeals(ctx: Ctx, data: PlanDocumentData) {
  const { f, L } = ctx;
  let { page, y } = newMealPage(ctx, data);
  const contentX = 175;
  const contentW = PAGE_W - MARGIN - contentX;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 20) {
      ({ page, y } = newMealPage(ctx, data));
    }
  };

  for (const meal of data.plan.meals) {
    ensure(70);
    // meal title (small caps, large)
    page.drawText(meal.name + (meal.time ? `  ·  ${meal.time}` : ""), {
      x: MARGIN + 20,
      y,
      font: f.scBold,
      size: 22,
      color: INK,
    });
    y -= 36;

    const multiOption = meal.options.length > 1;
    meal.options.forEach((opt, i) => {
      const lines = wrapLines(f.body, opt.content, 11.5, multiOption ? contentW : PAGE_W - MARGIN - (MARGIN + 8));
      const blockH = Math.max(lines.length * 16 + 18, 40);
      ensure(blockH);

      if (multiOption) {
        // "Opção n" label + vertical divider, like the template
        page.drawText(L.option(i + 1), { x: MARGIN + 8, y: y - 2, font: f.scMedium, size: 11, color: TAUPE });
        page.drawLine({
          start: { x: contentX - 18, y: y + 10 },
          end: { x: contentX - 18, y: y - lines.length * 16 + 4 },
          thickness: 1,
          color: LIGHT,
        });
        let ly = y;
        for (const line of lines) {
          page.drawText(line, { x: contentX, y: ly, font: f.body, size: 11.5, color: INK });
          ly -= 16;
        }
        y = ly - 14;
      } else {
        // single block: render with light formatting (bold the "Label -" prefixes)
        let ly = y;
        for (const line of lines) {
          const colonIdx = line.indexOf(" - ");
          const isLabelLine = colonIdx > 0 && colonIdx < 14 && !line.startsWith("•");
          if (isLabelLine) {
            const label = line.slice(0, colonIdx);
            const rest = line.slice(colonIdx);
            page.drawText(label, { x: MARGIN + 8, y: ly, font: f.scMedium, size: 11.5, color: TAUPE });
            page.drawText(rest, {
              x: MARGIN + 8 + textWidth(f.scMedium, label, 11.5),
              y: ly,
              font: f.body,
              size: 11.5,
              color: INK,
            });
          } else {
            page.drawText(line, { x: MARGIN + 8, y: ly, font: f.body, size: 11.5, color: INK });
          }
          ly -= 16;
        }
        y = ly - 8;
      }
    });
    y -= 18;
  }
}

// ---------------------------------------------------------------------------
// Supplementation + Notes page
// ---------------------------------------------------------------------------
function drawSupplementsNotes(ctx: Ctx, data: PlanDocumentData) {
  const { plan } = data;
  if (!plan.supplementation && !plan.notes) return;
  const { f, L } = ctx;
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  fill(page);
  contactHeader(ctx, page, data);
  let y = PAGE_H - 110;
  const maxW = PAGE_W - MARGIN * 2;

  if (plan.supplementation) {
    page.drawText(L.supplementation, { x: MARGIN, y, font: f.scBold, size: 20, color: INK });
    y -= 30;
    y = paragraph(page, plan.supplementation, MARGIN + 8, y, f.body, 11.5, maxW, 16, INK);
    y -= 24;
  }
  if (plan.notes) {
    page.drawText(L.notes, { x: MARGIN, y, font: f.scBold, size: 20, color: TAUPE });
    y -= 30;
    paragraph(page, plan.notes, MARGIN + 8, y, f.body, 11.5, maxW, 16, INK);
  }
}

// ---------------------------------------------------------------------------
// Back cover — quote, next appointment, contacts, logo
// ---------------------------------------------------------------------------
async function drawBackCover(ctx: Ctx, data: PlanDocumentData) {
  const { f, L, doc } = ctx;
  const { plan, profile } = data;
  const page = doc.addPage([PAGE_W, PAGE_H]);
  fill(page);

  if (plan.motivationalQuote) {
    const quoted = `“${plan.motivationalQuote}”`;
    const lines = wrapLines(f.scBold, quoted, 30, PAGE_W - 160);
    let y = PAGE_H - 200;
    for (const line of lines) {
      centered(page, line, y, f.scBold, 30, TAUPE);
      y -= 42;
    }
  }

  if (plan.nextAppointment) {
    centered(page, L.nextConsultation, PAGE_H - 410, f.scSemibold, 15, INK);
    centered(page, plan.nextAppointment, PAGE_H - 435, f.scSemibold, 15, TAUPE);
  }

  // contact band
  const bandY = PAGE_H - 560;
  page.drawRectangle({ x: 0, y: bandY - 6, width: PAGE_W, height: 40, color: BAND });
  const contacts = [profile.address, profile.phone, profile.instagram].filter(Boolean) as string[];
  const segW = PAGE_W / Math.max(contacts.length, 1);
  contacts.forEach((txt, i) => {
    const size = 11;
    const w = textWidth(f.body, txt, size);
    page.drawText(txt, { x: i * segW + (segW - w) / 2, y: bandY + 8, font: f.body, size, color: INK });
  });

  // logo + name footer
  try {
    const logoBytes = readFileSync(
      join(process.cwd(), "public", (profile.logoUrl ?? "/pdf-assets/logo.png").replace(/^\//, "")),
    );
    const isJpg = /\.jpe?g$/i.test(profile.logoUrl ?? "");
    const png = isJpg ? await doc.embedJpg(logoBytes) : await doc.embedPng(logoBytes);
    const lw = 90;
    const lh = (png.height / png.width) * lw;
    page.drawImage(png, { x: MARGIN, y: 80, width: lw, height: lh });
    const tx = MARGIN + lw + 16;
    page.drawText(profile.name, { x: tx, y: 130, font: f.scSemibold, size: 22, color: GREEN });
    page.drawText(L.nutritionist, { x: tx, y: 112, font: f.scSemibold, size: 13, color: INK });
    page.drawText(L.credential(profile.credential), { x: tx, y: 96, font: f.body, size: 10, color: INK });
  } catch {
    // logo missing — render name only
    centered(page, profile.name, 120, f.scSemibold, 22, GREEN);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function generatePlanPdf(
  data: PlanDocumentData,
  opts: { baseTemplate?: Uint8Array } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f = await embedFonts(doc);
  const lang = data.language;
  const ctx: Ctx = { doc, f, L: pdfLabels(lang), lang };

  if (opts.baseTemplate) {
    // Custom design: prepend the nutritionist's uploaded PDF, then append the
    // generated data pages (measurements, meals, supplementation/notes).
    try {
      const base = await PDFDocument.load(opts.baseTemplate);
      const pages = await doc.copyPages(base, base.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
    } catch {
      // Corrupt/unreadable template → fall back to the classic cover.
      drawCover(ctx, doc.addPage([PAGE_W, PAGE_H]), data);
    }
    drawMeasurements(ctx, doc.addPage([PAGE_W, PAGE_H]), data);
    drawMeals(ctx, data);
    drawSupplementsNotes(ctx, data);
  } else {
    drawCover(ctx, doc.addPage([PAGE_W, PAGE_H]), data);
    drawMeasurements(ctx, doc.addPage([PAGE_W, PAGE_H]), data);
    drawMeals(ctx, data);
    drawSupplementsNotes(ctx, data);
    await drawBackCover(ctx, data);
  }

  doc.setTitle(`${ctx.L.planTitle} — ${data.client.name}`);
  doc.setAuthor(data.profile.name);
  return doc.save();
}

export type { Measurements };
