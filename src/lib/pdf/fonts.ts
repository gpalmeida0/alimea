import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PDFDocument, PDFFont } from "pdf-lib";

const FONT_DIR = join(process.cwd(), "src", "lib", "pdf", "fonts");

function load(name: string): Buffer {
  return readFileSync(join(FONT_DIR, name));
}

export interface AlimeaFonts {
  /** Cormorant Small Caps — used for the cover title, section headings, labels. */
  scRegular: PDFFont;
  scMedium: PDFFont;
  scSemibold: PDFFont;
  scBold: PDFFont;
  /** Caudex — readable serif body text. */
  body: PDFFont;
  bodyBold: PDFFont;
  bodyItalic: PDFFont;
}

/**
 * Embeds the Alimea PDF typefaces into a document.
 * Mirrors the template typography: Cormorant SC for display / labels and
 * Caudex for body copy.
 */
export async function embedFonts(doc: PDFDocument): Promise<AlimeaFonts> {
  const [scR, scM, scS, scB, body, bodyB, bodyI] = await Promise.all([
    doc.embedFont(load("CormorantSC-Regular.ttf"), { subset: true }),
    doc.embedFont(load("CormorantSC-Medium.ttf"), { subset: true }),
    doc.embedFont(load("CormorantSC-SemiBold.ttf"), { subset: true }),
    doc.embedFont(load("CormorantSC-Bold.ttf"), { subset: true }),
    doc.embedFont(load("Caudex-Regular.ttf"), { subset: true }),
    doc.embedFont(load("Caudex-Bold.ttf"), { subset: true }),
    doc.embedFont(load("Caudex-Italic.ttf"), { subset: true }),
  ]);
  return {
    scRegular: scR,
    scMedium: scM,
    scSemibold: scS,
    scBold: scB,
    body,
    bodyBold: bodyB,
    bodyItalic: bodyI,
  };
}
