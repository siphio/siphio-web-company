// Task 14 — CSS custom property generator
// Converts a Theme object into a CSS string with :root variables,
// Google Fonts @import directives, and design token variables.
// HSL values follow the shadcn/ui convention: "H S% L%" (space-separated, no hsl() wrapper).

import type { Theme } from "./types";

// ---------------------------------------------------------------------------
// Color conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert a hex color (#RGB or #RRGGBB) to HSL components.
 * Returns h in degrees (0-360), s and l as fractions (0-1).
 */
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const cleaned = hex.replace(/^#/, "");
  let r: number;
  let g: number;
  let b: number;

  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16) / 255;
    g = parseInt(cleaned[1] + cleaned[1], 16) / 255;
    b = parseInt(cleaned[2] + cleaned[2], 16) / 255;
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16) / 255;
    g = parseInt(cleaned.slice(2, 4), 16) / 255;
    b = parseInt(cleaned.slice(4, 6), 16) / 255;
  } else {
    throw new Error(`Invalid hex color: "${hex}"`);
  }

  if ([r, g, b].some((c) => Number.isNaN(c))) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max - min);

    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6;
    } else {
      h = ((r - g) / delta + 4) / 6;
    }

    h *= 360;
  }

  return { h, s, l };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format HSL as the shadcn/ui convention: "H S% L%" (space-separated).
 * Rounds to 1 decimal for readability.
 */
function formatHSL(hex: string): string {
  const { h, s, l } = hexToHSL(hex);
  const hRound = Math.round(h * 10) / 10;
  const sRound = Math.round(s * 1000) / 10;
  const lRound = Math.round(l * 1000) / 10;
  return `${hRound} ${sRound}% ${lRound}%`;
}

/**
 * Build a Google Fonts @import URL for one or more font families.
 * Deduplicates families. Encodes spaces as `+` per Google Fonts convention.
 */
function googleFontsImport(
  fonts: Array<{ family: string; weights: number[] }>
): string {
  // Deduplicate by family name
  const seen = new Set<string>();
  const unique: Array<{ family: string; weights: number[] }> = [];

  for (const font of fonts) {
    if (!seen.has(font.family)) {
      seen.add(font.family);
      unique.push(font);
    }
  }

  const specs = unique.map((f) => {
    const encoded = f.family.replace(/ /g, "+");
    const wghts = f.weights
      .slice()
      .sort((a, b) => a - b)
      .join(";");
    // Include both normal and italic for fonts that may use italic style
    return `family=${encoded}:ital,wght@0,${wghts};1,${wghts}`;
  });

  return `@import url('https://fonts.googleapis.com/css2?${specs.join("&")}&display=swap');`;
}

/**
 * Parse a CSS dimension string (e.g. "12px") into its numeric value.
 * Used to generate unitless variables where needed.
 */
function parsePixelValue(value: string): number {
  const match = value.match(/^([\d.]+)px$/);
  if (!match) {
    return 0;
  }
  return parseFloat(match[1]);
}

// ---------------------------------------------------------------------------
// Main CSS generation
// ---------------------------------------------------------------------------

/**
 * Generate a complete CSS string from a Theme object.
 *
 * Includes:
 *   - Google Fonts @import for heading, accent, and body fonts
 *   - :root block with shadcn/ui-style HSL custom properties
 *   - Spacing, border-radius, and shadow variables
 *
 * Output is ready to be written to a `.css` file or injected via <style>.
 */
export function generateCSS(theme: Theme): string {
  const lines: string[] = [];

  // ----- Google Fonts import -----------------------------------------------

  const fontSpecs: Array<{ family: string; weights: number[] }> = [
    {
      family: theme.typography.heading_font,
      weights: [400, theme.typography.heading_weight],
    },
    {
      family: theme.typography.accent_font,
      weights: [theme.typography.accent_weight],
    },
    {
      family: theme.typography.body_font,
      weights: [400, 500, 600, theme.typography.body_weight],
    },
  ];

  // Deduplicate weights within each spec
  for (const spec of fontSpecs) {
    spec.weights = Array.from(new Set(spec.weights));
  }

  lines.push(googleFontsImport(fontSpecs));
  lines.push("");

  // ----- :root custom properties -------------------------------------------

  lines.push(":root {");
  lines.push("  /* --- Palette (shadcn HSL convention: H S% L%) --- */");
  lines.push(`  --background: ${formatHSL(theme.palette.background)};`);
  lines.push(`  --surface: ${formatHSL(theme.palette.surface)};`);
  lines.push(`  --border: ${formatHSL(theme.palette.border)};`);
  lines.push(`  --text-primary: ${formatHSL(theme.palette.text_primary)};`);
  lines.push(
    `  --text-secondary: ${formatHSL(theme.palette.text_secondary)};`
  );
  lines.push(`  --text-muted: ${formatHSL(theme.palette.text_muted)};`);
  lines.push(
    `  --accent-primary: ${formatHSL(theme.palette.accent_primary)};`
  );
  lines.push(
    `  --accent-secondary: ${formatHSL(theme.palette.accent_secondary)};`
  );
  lines.push(`  --accent-warm: ${formatHSL(theme.palette.accent_warm)};`);
  lines.push(`  --cta-fill: ${formatHSL(theme.palette.cta_fill)};`);
  lines.push(`  --cta-text: ${formatHSL(theme.palette.cta_text)};`);

  // shadcn/ui also expects some standard aliases
  lines.push("");
  lines.push("  /* --- shadcn/ui standard aliases --- */");
  lines.push(`  --foreground: ${formatHSL(theme.palette.text_primary)};`);
  lines.push(`  --card: ${formatHSL(theme.palette.surface)};`);
  lines.push(
    `  --card-foreground: ${formatHSL(theme.palette.text_primary)};`
  );
  lines.push(`  --popover: ${formatHSL(theme.palette.surface)};`);
  lines.push(
    `  --popover-foreground: ${formatHSL(theme.palette.text_primary)};`
  );
  lines.push(
    `  --primary: ${formatHSL(theme.palette.accent_primary)};`
  );
  lines.push(`  --primary-foreground: ${formatHSL(theme.palette.cta_text)};`);
  lines.push(
    `  --secondary: ${formatHSL(theme.palette.accent_secondary)};`
  );
  lines.push(
    `  --secondary-foreground: ${formatHSL(theme.palette.text_primary)};`
  );
  lines.push(`  --muted: ${formatHSL(theme.palette.surface)};`);
  lines.push(
    `  --muted-foreground: ${formatHSL(theme.palette.text_muted)};`
  );
  lines.push(`  --accent: ${formatHSL(theme.palette.surface)};`);
  lines.push(
    `  --accent-foreground: ${formatHSL(theme.palette.text_primary)};`
  );
  lines.push(`  --destructive: 0 84.2% 60.2%;`);
  lines.push(
    `  --destructive-foreground: ${formatHSL(theme.palette.cta_text)};`
  );
  lines.push(`  --input: ${formatHSL(theme.palette.border)};`);
  lines.push(`  --ring: ${formatHSL(theme.palette.accent_primary)};`);

  // ----- Typography --------------------------------------------------------

  lines.push("");
  lines.push("  /* --- Typography --- */");
  lines.push(
    `  --font-heading: '${theme.typography.heading_font}', sans-serif;`
  );
  lines.push(`  --font-heading-weight: ${theme.typography.heading_weight};`);
  lines.push(
    `  --font-accent: '${theme.typography.accent_font}', serif;`
  );
  lines.push(`  --font-accent-weight: ${theme.typography.accent_weight};`);
  lines.push(`  --font-accent-style: ${theme.typography.accent_style};`);
  lines.push(`  --font-body: '${theme.typography.body_font}', sans-serif;`);
  lines.push(`  --font-body-weight: ${theme.typography.body_weight};`);
  lines.push(
    `  --font-body-line-height: ${theme.typography.body_line_height};`
  );

  // ----- Spacing scale (based on 4px grid) ---------------------------------

  lines.push("");
  lines.push("  /* --- Spacing (4px grid) --- */");
  lines.push("  --space-1: 0.25rem;");
  lines.push("  --space-2: 0.5rem;");
  lines.push("  --space-3: 0.75rem;");
  lines.push("  --space-4: 1rem;");
  lines.push("  --space-6: 1.5rem;");
  lines.push("  --space-8: 2rem;");
  lines.push("  --space-10: 2.5rem;");
  lines.push("  --space-12: 3rem;");
  lines.push("  --space-16: 4rem;");
  lines.push("  --space-20: 5rem;");
  lines.push("  --space-24: 6rem;");

  // ----- Border radii ------------------------------------------------------

  lines.push("");
  lines.push("  /* --- Border Radius --- */");
  lines.push(`  --radius-sm: ${theme.borders.radius_sm};`);
  lines.push(`  --radius-md: ${theme.borders.radius_md};`);
  lines.push(`  --radius-lg: ${theme.borders.radius_lg};`);
  lines.push(`  --radius-pill: ${theme.borders.radius_pill};`);
  // shadcn/ui uses --radius as the base
  lines.push(
    `  --radius: ${parsePixelValue(theme.borders.radius_md) / 16}rem;`
  );

  // ----- Shadows -----------------------------------------------------------

  lines.push("");
  lines.push("  /* --- Shadows --- */");
  lines.push(`  --shadow-card: ${theme.shadows.card};`);
  lines.push(`  --shadow-elevated: ${theme.shadows.elevated};`);

  // ----- Effects (as boolean flags for JS/CSS consumption) -----------------

  lines.push("");
  lines.push("  /* --- Effect flags (1 = on, 0 = off) --- */");
  lines.push(`  --effect-grain: ${theme.effects.grain ? 1 : 0};`);
  lines.push(
    `  --effect-glassmorphism: ${theme.effects.glassmorphism ? 1 : 0};`
  );
  lines.push(
    `  --effect-mesh-gradient: ${theme.effects.mesh_gradient ? 1 : 0};`
  );
  lines.push(
    `  --effect-soft-gradient: ${theme.effects.soft_gradient ? 1 : 0};`
  );

  lines.push("}");

  return lines.join("\n");
}
