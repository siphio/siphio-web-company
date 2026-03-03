import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

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

export { validateFile };

// CLI entry point
const targetArg = process.argv[2];

if (!targetArg) {
  console.log('Usage: npx tsx scripts/theme-validator.ts <file.tsx|pattern>');
  console.log('  Single file: npx tsx scripts/theme-validator.ts output/theme.css');
  console.log('  Batch:       npx tsx scripts/theme-validator.ts output/components/*.tsx');
  process.exit(0);
}

function resolveFiles(pattern: string): string[] {
  if (!pattern.includes('*')) {
    return [pattern];
  }

  const lastSlash = pattern.lastIndexOf('/');
  const dir = pattern.substring(0, lastSlash) || '.';
  const glob = pattern.substring(lastSlash + 1);
  const ext = glob.replace('*', '');

  try {
    const dirFiles = readdirSync(resolve(dir)) as string[];
    return dirFiles
      .filter((f: string) => f.endsWith(ext))
      .map((f: string) => join(dir, f));
  } catch {
    return [];
  }
}

const files = resolveFiles(targetArg);

if (files.length === 0) {
  console.log(`⚠️  No files matched: ${targetArg}`);
  process.exit(0);
}

let totalViolations = 0;
let filesWithViolations = 0;

for (const file of files) {
  try {
    const violations = validateFile(file);
    totalViolations += violations.length;

    if (violations.length === 0) {
      console.log(`✅ ${file}: clean`);
    } else {
      filesWithViolations++;
      console.log(`❌ ${file}: ${violations.length} violation(s)`);
      for (const v of violations) {
        console.log(`   Line ${v.line}: [${v.type}] ${v.value}`);
        console.log(`     → ${v.suggestion}`);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`⚠️  Error reading ${file}: ${message}`);
  }
}

console.log(`\n📊 Summary: ${files.length} files scanned, ${totalViolations} violations in ${filesWithViolations} files`);
process.exit(totalViolations > 0 ? 1 : 0);
