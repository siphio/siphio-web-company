// Task 13 — Theme derivation engine
// Starts from template defaults, applies business brand colors,
// falls back to industry-conventional accents, and enforces WCAG AA contrast.

import type { BusinessProfile, Theme } from "./types";

// ---------------------------------------------------------------------------
// Industry → conventional accent mapping
// ---------------------------------------------------------------------------

const INDUSTRY_ACCENTS: Record<string, string> = {
  fintech: "#22C55E",
  education: "#3B82F6",
  health: "#EF4444",
  saas: "#8B5CF6",
  devtools: "#06B6D4",
  agency: "#F59E0B",
  ecommerce: "#EC4899",
  ai: "#8B5CF6",
  crypto: "#F59E0B",
  general: "", // empty → keep defaults
};

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Parse a hex string (#RGB or #RRGGBB) into {r, g, b} 0-255. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/, "");
  let r: number;
  let g: number;
  let b: number;

  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    throw new Error(`Invalid hex color: "${hex}"`);
  }

  if ([r, g, b].some((c) => Number.isNaN(c))) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }

  return { r, g, b };
}

/**
 * Relative luminance per WCAG 2.1 definition.
 * Input: sRGB values 0-255.
 * Returns a value between 0 (black) and 1 (white).
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * WCAG 2.1 contrast ratio between two hex colors.
 * Returns a value between 1 (identical) and 21 (black on white).
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const { r: r1, g: g1, b: b1 } = hexToRgb(hex1);
  const { r: r2, g: g2, b: b2 } = hexToRgb(hex2);

  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// HSL ↔ RGB round-trip (needed by adjustLightness)
// ---------------------------------------------------------------------------

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max - min);

    if (max === rn) {
      h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) / 6;
    } else {
      h = ((rn - gn) / delta + 4) / 6;
    }
  }

  return { h: h * 360, s, l };
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const hNorm = ((h % 360) + 360) % 360;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hueToRgbChannel = (p: number, q: number, t: number): number => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hFrac = hNorm / 360;

  return {
    r: Math.round(hueToRgbChannel(p, q, hFrac + 1 / 3) * 255),
    g: Math.round(hueToRgbChannel(p, q, hFrac) * 255),
    b: Math.round(hueToRgbChannel(p, q, hFrac - 1 / 3) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Nudge a hex color lighter or darker by `amount` (0-1 scale on lightness).
 * Uses HSL internally so hue and saturation are preserved.
 */
export function adjustLightness(
  hex: string,
  direction: "lighter" | "darker",
  amount: number
): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  let newL: number;
  if (direction === "lighter") {
    newL = Math.min(1, l + amount);
  } else {
    newL = Math.max(0, l - amount);
  }

  const adjusted = hslToRgb(h, s, newL);
  return rgbToHex(adjusted.r, adjusted.g, adjusted.b);
}

// ---------------------------------------------------------------------------
// WCAG AA enforcement
// ---------------------------------------------------------------------------

/** Minimum contrast ratios per WCAG 2.1 AA */
const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3.0;

/** Step size for iterative lightness adjustments (5% per step). */
const LIGHTNESS_STEP = 0.05;
/** Max iterations to prevent infinite loops. */
const MAX_ADJUSTMENT_STEPS = 20;

/**
 * Ensure `foreground` has at least `minRatio` contrast against `background`.
 * Adjusts the foreground color's lightness if necessary.
 * Returns the (possibly adjusted) foreground hex.
 */
function enforceContrast(
  foreground: string,
  background: string,
  minRatio: number
): string {
  let fg = foreground;
  let ratio = contrastRatio(fg, background);

  if (ratio >= minRatio) {
    return fg;
  }

  // Decide direction: if background is light, darken foreground; otherwise lighten.
  const bgRgb = hexToRgb(background);
  const bgLum = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const direction: "lighter" | "darker" = bgLum > 0.5 ? "darker" : "lighter";

  let steps = 0;
  while (ratio < minRatio && steps < MAX_ADJUSTMENT_STEPS) {
    fg = adjustLightness(fg, direction, LIGHTNESS_STEP);
    ratio = contrastRatio(fg, background);
    steps++;
  }

  return fg;
}

// ---------------------------------------------------------------------------
// Main derivation function
// ---------------------------------------------------------------------------

/**
 * Derive a concrete Theme from a business profile and the template defaults.
 *
 * Priority chain:
 *   1. Explicit brand_colors from the business profile (highest)
 *   2. Industry-conventional accents
 *   3. Template defaults (style-profile fresh-green accent, dark-navy CTA)
 *
 * After color selection the palette is validated against WCAG AA contrast
 * requirements. Failing pairs are auto-adjusted (PRD SC-002 error path).
 */
export function deriveTheme(
  businessProfile: BusinessProfile,
  templateTheme: Theme
): Theme {
  // Deep-clone the template so we don't mutate the original.
  const theme: Theme = JSON.parse(JSON.stringify(templateTheme));

  // Give the derived theme a descriptive name.
  const slugName = businessProfile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  theme.name = `${slugName}-light`;

  // ----- Step 1: Apply brand colors (highest priority) --------------------

  if (businessProfile.brand_colors?.primary) {
    theme.palette.accent_primary = businessProfile.brand_colors.primary;
  }

  if (businessProfile.brand_colors?.secondary) {
    theme.palette.accent_secondary = businessProfile.brand_colors.secondary;
  }

  // ----- Step 2: Industry fallback (only when no explicit brand colors) ----

  if (!businessProfile.brand_colors?.primary && businessProfile.industry) {
    const industryKey = businessProfile.industry.toLowerCase();
    const accent = INDUSTRY_ACCENTS[industryKey];

    if (accent && accent !== "") {
      theme.palette.accent_primary = accent;
    }
    // If industry is "general" or unknown, template defaults stay.
  }

  // ----- Step 3: WCAG AA contrast enforcement -----------------------------
  // Check critical text-on-background pairs and adjust if needed.

  const bg = theme.palette.background;

  // Normal text on background — 4.5:1
  theme.palette.text_primary = enforceContrast(
    theme.palette.text_primary,
    bg,
    WCAG_AA_NORMAL
  );

  // Secondary text on background — 4.5:1
  theme.palette.text_secondary = enforceContrast(
    theme.palette.text_secondary,
    bg,
    WCAG_AA_NORMAL
  );

  // Muted text on background — 4.5:1 (still body-size text)
  theme.palette.text_muted = enforceContrast(
    theme.palette.text_muted,
    bg,
    WCAG_AA_NORMAL
  );

  // CTA text on CTA fill — 4.5:1
  theme.palette.cta_text = enforceContrast(
    theme.palette.cta_text,
    theme.palette.cta_fill,
    WCAG_AA_NORMAL
  );

  // Accent primary used as large text (headings, badges) — 3:1 on background
  theme.palette.accent_primary = enforceContrast(
    theme.palette.accent_primary,
    bg,
    WCAG_AA_LARGE
  );

  // Accent secondary — same large-text rule
  theme.palette.accent_secondary = enforceContrast(
    theme.palette.accent_secondary,
    bg,
    WCAG_AA_LARGE
  );

  return theme;
}
