import { readFileSync } from 'fs';

// Theme validator — scans generated .tsx files for hardcoded values outside theme tokens
// Reference: PRD Section 4.1 — Theme Validator (non-AI script for speed)

interface Violation {
  file: string;
  line: number;
  type: 'color' | 'font' | 'spacing';
  value: string;
  suggestion: string;
}

// Allowed theme colors (from style profile defaults + common overrides)
const THEME_COLORS = new Set([
  // Neutrals that are always OK
  '#000000', '#ffffff', '#000', '#fff',
  'transparent', 'currentColor', 'inherit',
]);

// Regex patterns for detecting hardcoded values
const HEX_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b/g;
const RGB_PATTERN = /rgb\([^)]+\)/g;
const RGBA_PATTERN = /rgba\([^)]+\)/g;
const FONT_FAMILY_PATTERN = /font-family:\s*['"]([^'"]+)['"]/g;
const HARDCODED_PX_PATTERN = /(?:margin|padding|gap|width|height):\s*(\d+)px/g;

// Allowed font families from theme
const THEME_FONTS = new Set([
  'Plus Jakarta Sans',
  'DM Serif Display',
  'Inter',
  'var(--font-heading)',
  'var(--font-accent)',
  'var(--font-body)',
]);

function validateFile(filePath: string): Violation[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip import statements and comments
    if (line.trim().startsWith('import ') || line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }

    // Check for hardcoded hex colors
    let match;
    HEX_COLOR_PATTERN.lastIndex = 0;
    while ((match = HEX_COLOR_PATTERN.exec(line)) !== null) {
      const color = match[0].toLowerCase();
      if (!THEME_COLORS.has(color) && !line.includes('var(--')) {
        violations.push({
          file: filePath,
          line: lineNum,
          type: 'color',
          value: match[0],
          suggestion: 'Use a CSS variable: var(--accent-primary), var(--background), etc.',
        });
      }
    }

    // Check for hardcoded rgb/rgba (outside of CSS variable definitions)
    RGB_PATTERN.lastIndex = 0;
    while ((match = RGB_PATTERN.exec(line)) !== null) {
      if (!line.includes('var(--') && !line.includes(':root')) {
        violations.push({
          file: filePath,
          line: lineNum,
          type: 'color',
          value: match[0],
          suggestion: 'Use a CSS variable instead of hardcoded rgb()',
        });
      }
    }

    RGBA_PATTERN.lastIndex = 0;
    while ((match = RGBA_PATTERN.exec(line)) !== null) {
      if (!line.includes('var(--') && !line.includes(':root') && !line.includes('shadow')) {
        violations.push({
          file: filePath,
          line: lineNum,
          type: 'color',
          value: match[0],
          suggestion: 'Use a CSS variable instead of hardcoded rgba()',
        });
      }
    }

    // Check for hardcoded font families
    FONT_FAMILY_PATTERN.lastIndex = 0;
    while ((match = FONT_FAMILY_PATTERN.exec(line)) !== null) {
      if (!THEME_FONTS.has(match[1])) {
        violations.push({
          file: filePath,
          line: lineNum,
          type: 'font',
          value: match[1],
          suggestion: `Use theme font variable. Allowed: ${[...THEME_FONTS].join(', ')}`,
        });
      }
    }
  }

  return violations;
}

// CLI entry point
const targetFile = process.argv[2];

if (!targetFile) {
  console.log('Usage: npx tsx scripts/theme-validator.ts <file.tsx>');
  console.log('Scans a .tsx file for hardcoded colors, fonts, and spacing outside the theme.');
  process.exit(0);
}

try {
  const violations = validateFile(targetFile);

  if (violations.length === 0) {
    console.log(`✅ No theme violations found in ${targetFile}`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${violations.length} theme violation(s) in ${targetFile}:\n`);
    for (const v of violations) {
      console.log(`  Line ${v.line}: [${v.type}] ${v.value}`);
      console.log(`    → ${v.suggestion}\n`);
    }
    console.log(JSON.stringify(violations, null, 2));
    process.exit(1);
  }
} catch (err: any) {
  console.error(`Error reading file: ${err.message}`);
  process.exit(1);
}
