import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_PRESETS,
  DEFAULT_APPEARANCE,
  brandScale,
  contrast,
  hexToRgb,
  mix,
  normalizeAppearance,
  readableOn,
  themeCss,
  type Rgb,
} from "@/lib/theme";

const DARK_BG: Rgb = [17, 22, 19];
const LIGHT_BG: Rgb = [247, 248, 245];

test("normalizeAppearance: keeps valid values, replaces anything else with defaults", () => {
  assert.deepEqual(normalizeAppearance(undefined), DEFAULT_APPEARANCE);
  assert.deepEqual(normalizeAppearance("dark"), DEFAULT_APPEARANCE);
  assert.deepEqual(normalizeAppearance({ mode: "neon", brandColor: "red", corners: 3, headingFont: null }), DEFAULT_APPEARANCE);
  assert.deepEqual(normalizeAppearance({ mode: "dark", brandColor: "#2563eb", corners: "round", headingFont: "sans" }), {
    mode: "dark",
    brandColor: "#2563EB",
    corners: "round",
    headingFont: "sans",
  });
});

test("colour maths: hex parsing, mixing and WCAG contrast", () => {
  assert.deepEqual(hexToRgb("#2E7D32"), [46, 125, 50]);
  assert.deepEqual(mix([0, 0, 0], [255, 255, 255], 0.5), [128, 128, 128]);
  assert.deepEqual(mix([10, 20, 30], [255, 255, 255], 0), [10, 20, 30]);
  assert.equal(contrast([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrast([255, 255, 255], [0, 0, 0]), 21);
  assert.equal(contrast([120, 120, 120], [120, 120, 120]), 1);
});

test("readableOn: white text on dark colours, dark ink on light ones", () => {
  assert.deepEqual(readableOn(hexToRgb("#2E7D32")), [255, 255, 255]);
  assert.deepEqual(readableOn(hexToRgb("#FDE047")), [16, 32, 26]);
});

test("brandScale (light): reproduces the original Alimea green palette", () => {
  const s = brandScale("#2E7D32", "light");
  assert.deepEqual(s.brand, [46, 125, 50]);
  assert.deepEqual(s["brand-500"], s.brand);
  assert.deepEqual(s["brand-foreground"], [255, 255, 255]);
  // Within a couple of units of the hand-picked #EEF6EE / #256628 / #1D521F.
  const near = (a: Rgb, b: Rgb) => a.every((v, i) => Math.abs(v - b[i]) <= 3);
  assert.ok(near(s["brand-50"], [238, 246, 238]));
  assert.ok(near(s["brand-600"], [37, 102, 40]));
  assert.ok(near(s["brand-700"], [29, 82, 31]));
});

test("brandScale: every preset stays legible in both schemes", () => {
  for (const { hex } of BRAND_PRESETS) {
    for (const [scheme, bg] of [["light", LIGHT_BG], ["dark", DARK_BG]] as const) {
      const s = brandScale(hex, scheme);
      assert.ok(contrast(s.brand, bg) >= 3, `${hex} ${scheme}: brand vs page`);
      assert.ok(contrast(s["brand-foreground"], s.brand) >= 3, `${hex} ${scheme}: text on brand`);
      assert.ok(contrast(s["brand-700"], s["brand-50"]) >= 4.5, `${hex} ${scheme}: badge text`);
    }
  }
});

test("brandScale: colours too close to the page are pushed away from it", () => {
  const pale = brandScale("#FFFDE7", "light");
  assert.ok(contrast(pale.brand, LIGHT_BG) >= 3);
  assert.notDeepEqual(pale.brand, hexToRgb("#FFFDE7"));
  const nearBlack = brandScale("#0A0A0A", "dark");
  assert.ok(contrast(nearBlack.brand, DARK_BG) >= 3);
  // In dark mode the tints are dark and the text shades are light.
  assert.ok(contrast(nearBlack["brand-50"], DARK_BG) < contrast(nearBlack["brand-700"], DARK_BG));
});

test("themeCss: light, dark and system modes", () => {
  const light = themeCss({ mode: "light" });
  assert.match(light, /^:root\{color-scheme:light;--brand:46 125 50;/);
  assert.match(light, /--radius-scale:1\}$/);
  assert.doesNotMatch(light, /color-scheme:dark|--font-heading/);

  const dark = themeCss({ mode: "dark", corners: "sharp", headingFont: "sans" });
  assert.match(dark, /--radius-scale:0\.35;--font-heading:var\(--font-sans\)\}:root\{color-scheme:dark;--background:17 22 19;/);
  assert.doesNotMatch(dark, /@media/);

  const system = themeCss({ mode: "system", corners: "round" });
  assert.match(system, /--radius-scale:1\.6\}@media \(prefers-color-scheme:dark\)\{:root\{color-scheme:dark;/);
  assert.ok(system.endsWith("}}"));
});

test("themeCss: never echoes unvalidated input into the stylesheet", () => {
  const css = themeCss({ mode: "dark", brandColor: "#fff}</style><script>alert(1)</script>", corners: "x;}" });
  assert.doesNotMatch(css, /script|<|alert/);
  assert.equal(css, themeCss({ mode: "dark" }));
});
