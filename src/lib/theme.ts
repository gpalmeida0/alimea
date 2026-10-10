// ---------------------------------------------------------------------------
// Appearance — the look each nutritionist chooses for their own workspace.
//
// Tailwind's colour tokens point at CSS variables (see tailwind.config.ts and
// globals.css, which holds the default light theme). themeCss() turns a saved
// Appearance into the variable overrides for that account: light/dark palette,
// a brand scale generated from one colour, corner roundness and heading font.
// ---------------------------------------------------------------------------

export const APPEARANCE_MODES = ["light", "dark", "system"] as const;
export const CORNER_STYLES = ["sharp", "soft", "round"] as const;
export const HEADING_FONTS = ["serif", "sans"] as const;

export type AppearanceMode = (typeof APPEARANCE_MODES)[number];
export type CornerStyle = (typeof CORNER_STYLES)[number];
export type HeadingFont = (typeof HEADING_FONTS)[number];

export interface Appearance {
  mode: AppearanceMode;
  /** Brand colour as #RRGGBB — buttons, links, highlights. */
  brandColor: string;
  corners: CornerStyle;
  headingFont: HeadingFont;
}

export const DEFAULT_APPEARANCE: Appearance = {
  mode: "light",
  brandColor: "#2E7D32",
  corners: "soft",
  headingFont: "serif",
};

/** Suggested brand colours (any #RRGGBB is accepted). */
export const BRAND_PRESETS = [
  { id: "green", hex: "#2E7D32" },
  { id: "teal", hex: "#0F766E" },
  { id: "blue", hex: "#2563EB" },
  { id: "indigo", hex: "#4F46E5" },
  { id: "purple", hex: "#7C3AED" },
  { id: "rose", hex: "#BE185D" },
  { id: "terracotta", hex: "#C2410C" },
  { id: "taupe", hex: "#8A6F5A" },
  { id: "graphite", hex: "#374151" },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

/** Coerce anything (form input, a stored JSON column) into a valid Appearance. */
export function normalizeAppearance(input: unknown): Appearance {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    mode: oneOf(APPEARANCE_MODES, raw.mode, DEFAULT_APPEARANCE.mode),
    brandColor: typeof raw.brandColor === "string" && HEX.test(raw.brandColor) ? raw.brandColor.toUpperCase() : DEFAULT_APPEARANCE.brandColor,
    corners: oneOf(CORNER_STYLES, raw.corners, DEFAULT_APPEARANCE.corners),
    headingFont: oneOf(HEADING_FONTS, raw.headingFont, DEFAULT_APPEARANCE.headingFont),
  };
}

// --- Colour maths ------------------------------------------------------------
export type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
/** Text placed on light brand colours. */
const INK: Rgb = [16, 32, 26];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `amount` of `b` blended into `a` (0 = a, 1 = b). */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return a.map((v, i) => Math.round(v + (b[i] - v) * amount)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 (none) to 21 (black on white). */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White where it is legible on `bg`, otherwise dark ink. */
export function readableOn(bg: Rgb): Rgb {
  return contrast(bg, WHITE) >= 3 ? WHITE : INK;
}

/** Blend `color` toward `toward` until it stands out from `bg` by `min`. */
function ensureContrast(color: Rgb, bg: Rgb, toward: Rgb, min: number): Rgb {
  let out = color;
  for (let step = 1; step <= 10 && contrast(out, bg) < min; step++) out = mix(color, toward, step / 10);
  return out;
}

// --- Palettes ----------------------------------------------------------------
type Scheme = "light" | "dark";
type Tokens = Record<string, Rgb>;

/** Dark values for the neutral tokens. The light ones are the CSS defaults. */
const DARK: Tokens = {
  background: [17, 22, 19],
  foreground: [232, 237, 233],
  card: [24, 31, 27],
  "card-foreground": [232, 237, 233],
  border: [44, 54, 48],
  input: [58, 70, 63],
  muted: [32, 40, 35],
  "muted-foreground": [156, 168, 161],
  secondary: [62, 122, 66],
  "secondary-foreground": [232, 245, 233],
  accent: [240, 150, 40],
  "accent-foreground": [26, 16, 0],
  "accent-700": [255, 190, 110],
  destructive: [239, 68, 68],
  "destructive-foreground": [255, 255, 255],
  cream: [36, 33, 30],
  taupe: [180, 157, 138],
};

const LIGHT_BACKGROUND: Rgb = [247, 248, 245];

/**
 * The brand tokens generated from one colour. Tints (50–200) sit close to the
 * page background and shades (600–700) are the readable text colours, so the
 * scale runs the other way round in dark mode.
 */
export function brandScale(hex: string, scheme: Scheme): Tokens {
  const base = hexToRgb(hex);
  if (scheme === "light") {
    const brand = ensureContrast(base, LIGHT_BACKGROUND, BLACK, 3);
    return {
      brand,
      "brand-50": mix(brand, WHITE, 0.92),
      "brand-100": mix(brand, WHITE, 0.81),
      "brand-200": mix(brand, WHITE, 0.64),
      "brand-500": brand,
      "brand-600": mix(brand, BLACK, 0.18),
      "brand-700": mix(brand, BLACK, 0.35),
      "brand-foreground": readableOn(brand),
    };
  }
  const brand = ensureContrast(base, DARK.background, WHITE, 3);
  return {
    brand,
    "brand-50": mix(brand, DARK.background, 0.85),
    "brand-100": mix(brand, DARK.background, 0.75),
    "brand-200": mix(brand, DARK.background, 0.6),
    "brand-500": brand,
    "brand-600": mix(brand, WHITE, 0.3),
    "brand-700": mix(brand, WHITE, 0.5),
    "brand-foreground": readableOn(brand),
  };
}

const CORNER_SCALE: Record<CornerStyle, number> = { sharp: 0.35, soft: 1, round: 1.6 };

const declarations = (tokens: Tokens) =>
  Object.entries(tokens)
    .map(([name, rgb]) => `--${name}:${rgb.join(" ")}`)
    .join(";");

/**
 * CSS for one account's appearance. Safe to inline in a <style> tag: the input
 * is normalised first, so only validated values reach the output.
 */
export function themeCss(input: unknown): string {
  const a = normalizeAppearance(input);
  const shape = [`--radius-scale:${CORNER_SCALE[a.corners]}`];
  if (a.headingFont === "sans") shape.push("--font-heading:var(--font-sans)");

  const light = `:root{color-scheme:light;${declarations(brandScale(a.brandColor, "light"))};${shape.join(";")}}`;
  const dark = `:root{color-scheme:dark;${declarations({ ...DARK, ...brandScale(a.brandColor, "dark") })}}`;
  if (a.mode === "light") return light;
  if (a.mode === "dark") return light + dark;
  return `${light}@media (prefers-color-scheme:dark){${dark}}`;
}
