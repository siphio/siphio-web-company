/**
 * placeholder-svg.ts
 *
 * Generates themed SVG placeholder strings for use during Phase 2
 * before AI-generated assets are available. Each function returns a
 * valid SVG string that can be inlined as a data URI or written to
 * an .svg file.
 *
 * Aesthetic: friendly-modern-SaaS — soft shapes, rounded corners,
 * gentle gradients, generous whitespace.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a hex color string to an rgba string at the given opacity.
 * Accepts "#abc" or "#aabbcc" formats.
 */
function hexToRgba(hex: string, opacity: number): string {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// ---------------------------------------------------------------------------
// heroPlaceholder
// ---------------------------------------------------------------------------

/**
 * Generates a 600x400 abstract illustration SVG with soft shapes
 * (circles, rounded rectangles) in the provided accent colors.
 * Suitable for hero sections.
 */
export function heroPlaceholder(
  accentPrimary: string,
  accentSecondary: string,
): string {
  const bgFill = hexToRgba(accentPrimary, 0.1);
  const primaryLight = hexToRgba(accentPrimary, 0.25);
  const secondaryLight = hexToRgba(accentSecondary, 0.2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <defs>
    <linearGradient id="hero-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accentPrimary}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accentSecondary}" stop-opacity="0.08"/>
    </linearGradient>
  </defs>

  <!-- Subtle background -->
  <rect width="600" height="400" rx="24" ry="24" fill="${bgFill}"/>

  <!-- Large soft circle — top right -->
  <circle cx="460" cy="110" r="100" fill="${primaryLight}"/>

  <!-- Medium rounded rectangle — center left -->
  <rect x="60" y="140" width="200" height="130" rx="28" ry="28" fill="${secondaryLight}"/>

  <!-- Small accent circle — bottom center -->
  <circle cx="320" cy="320" r="50" fill="${accentPrimary}" opacity="0.3"/>

  <!-- Decorative pill — top left -->
  <rect x="80" y="60" width="120" height="40" rx="20" ry="20" fill="${accentSecondary}" opacity="0.25"/>

  <!-- Gradient overlay blob — bottom right -->
  <ellipse cx="480" cy="310" rx="90" ry="70" fill="url(#hero-grad)"/>

  <!-- Small dot cluster -->
  <circle cx="200" cy="320" r="12" fill="${accentPrimary}" opacity="0.2"/>
  <circle cx="230" cy="340" r="8" fill="${accentSecondary}" opacity="0.2"/>
  <circle cx="215" cy="350" r="6" fill="${accentPrimary}" opacity="0.15"/>
</svg>`;
}

// ---------------------------------------------------------------------------
// iconPlaceholder
// ---------------------------------------------------------------------------

/**
 * Generates a 48x48 icon SVG — a filled circle with the first
 * letter of `label` centered inside it.
 */
export function iconPlaceholder(accentPrimary: string, label: string): string {
  const bgFill = hexToRgba(accentPrimary, 0.1);
  const letter = (label.charAt(0) || "?").toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <!-- Subtle background circle -->
  <circle cx="24" cy="24" r="23" fill="${bgFill}"/>

  <!-- Primary circle -->
  <circle cx="24" cy="24" r="20" fill="${accentPrimary}" opacity="0.85"/>

  <!-- Letter -->
  <text
    x="24"
    y="24"
    text-anchor="middle"
    dominant-baseline="central"
    fill="currentColor"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="20"
    font-weight="600"
  >${letter}</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// bentoPlaceholder
// ---------------------------------------------------------------------------

/**
 * Generates a 400x300 decorative card SVG with abstract shapes,
 * suitable for bento grid cards and feature sections.
 */
export function bentoPlaceholder(
  accentPrimary: string,
  accentSecondary: string,
): string {
  const bgFill = hexToRgba(accentPrimary, 0.1);
  const primarySoft = hexToRgba(accentPrimary, 0.2);
  const secondarySoft = hexToRgba(accentSecondary, 0.18);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <defs>
    <linearGradient id="bento-grad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentSecondary}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${accentPrimary}" stop-opacity="0.06"/>
    </linearGradient>
  </defs>

  <!-- Subtle background -->
  <rect width="400" height="300" rx="20" ry="20" fill="${bgFill}"/>

  <!-- Gradient wash -->
  <rect width="400" height="300" rx="20" ry="20" fill="url(#bento-grad)"/>

  <!-- Rounded rectangle — top left -->
  <rect x="30" y="30" width="140" height="100" rx="20" ry="20" fill="${primarySoft}"/>

  <!-- Circle — right side -->
  <circle cx="310" cy="100" r="60" fill="${secondarySoft}"/>

  <!-- Pill shape — bottom center -->
  <rect x="120" y="200" width="160" height="50" rx="25" ry="25" fill="${accentPrimary}" opacity="0.18"/>

  <!-- Small decorative circle — bottom left -->
  <circle cx="60" cy="240" r="24" fill="${accentSecondary}" opacity="0.22"/>

  <!-- Tiny dot — top right area -->
  <circle cx="350" cy="220" r="14" fill="${accentPrimary}" opacity="0.15"/>

  <!-- Small rounded square — middle -->
  <rect x="200" y="120" width="50" height="50" rx="12" ry="12" fill="${secondarySoft}"/>
</svg>`;
}
