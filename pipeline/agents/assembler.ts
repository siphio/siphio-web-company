/**
 * Assembler Agent — Prompt Builder
 *
 * Constructs a detailed prompt for the Claude Code Agent Tool sub-agent
 * that combines installed block source code with copy, theme tokens, and
 * placeholder assets into the final output files.
 */

import type {
  BlockSelection,
  BlockChoice,
  SectionCopy,
  CopyEntry,
  AssetManifest,
} from "../lib/types";
import type { Theme } from "../../src/lib/theme/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Serialize block selections to a YAML-like string for prompt embedding. */
function serializeSelections(selections: BlockSelection): string {
  return selections.sections
    .map(
      (s: BlockChoice) =>
        [
          `- section_id: ${s.section_id}`,
          `  block_name: ${s.block_name}`,
          `  category: ${s.category}`,
          `  customization_notes: "${s.customization_notes}"`,
          `  alternatives: [${s.alternatives.map((a) => `"${a}"`).join(", ")}]`,
        ].join("\n"),
    )
    .join("\n");
}

/** Serialize copy entries to a YAML-like string for prompt embedding. */
function serializeCopy(copy: SectionCopy): string {
  return copy.sections
    .map((c: CopyEntry) => {
      const lines: string[] = [
        `- section_id: ${c.section_id}`,
        `  headline: "${c.headline}"`,
      ];
      if (c.headline_accent_phrase) {
        lines.push(
          `  headline_accent_phrase: "${c.headline_accent_phrase}"`,
        );
      }
      lines.push(`  subtext: "${c.subtext}"`);
      if (c.cta_text) {
        lines.push(`  cta_text: "${c.cta_text}"`);
      }
      if (c.bullet_points && c.bullet_points.length > 0) {
        lines.push(`  bullet_points:`);
        c.bullet_points.forEach((bp) => lines.push(`    - "${bp}"`));
      }
      if (c.testimonial_quote) {
        lines.push(`  testimonial_quote: "${c.testimonial_quote}"`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

/** Build the theme CSS string from a Theme object. */
function buildThemeCss(theme: Theme): string {
  const lines: string[] = [];

  lines.push(":root {");
  lines.push("  /* Palette */");
  if (theme.palette) {
    for (const [key, value] of Object.entries(theme.palette)) {
      const varName = `--${key.replace(/_/g, "-")}`;
      lines.push(`  ${varName}: ${value};`);
    }
  }

  lines.push("");
  lines.push("  /* Typography */");
  if (theme.typography) {
    for (const [key, value] of Object.entries(theme.typography)) {
      const varName = `--font-${key.replace(/_/g, "-")}`;
      lines.push(`  ${varName}: ${value};`);
    }
  }

  lines.push("");
  lines.push("  /* Borders */");
  if (theme.borders) {
    for (const [key, value] of Object.entries(theme.borders)) {
      const varName = `--border-${key.replace(/_/g, "-")}`;
      lines.push(`  ${varName}: ${value};`);
    }
  }

  lines.push("");
  lines.push("  /* Shadows */");
  if (theme.shadows) {
    for (const [key, value] of Object.entries(theme.shadows)) {
      const varName = `--shadow-${key.replace(/_/g, "-")}`;
      lines.push(`  ${varName}: ${value};`);
    }
  }

  lines.push("");
  lines.push("  /* Effects */");
  if (theme.effects) {
    for (const [key, value] of Object.entries(theme.effects)) {
      const varName = `--effect-${key.replace(/_/g, "-")}`;
      lines.push(`  ${varName}: ${value};`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

/** Convert a section_id like "hero-section" to a PascalCase component name. */
function toPascalCase(sectionId: string): string {
  return sectionId
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

export function buildAssemblerPrompt(
  selections: BlockSelection,
  copy: SectionCopy,
  theme: Theme,
  projectDir: string,
  outputDir: string,
  assetManifest?: AssetManifest,
): string {
  const themeCss = buildThemeCss(theme);

  // Build the section mapping table for the prompt.
  const sectionTable = selections.sections
    .map((s: BlockChoice) => {
      const copyEntry = copy.sections.find(
        (c: CopyEntry) => c.section_id === s.section_id,
      );
      return `| ${s.section_id} | ${s.block_name} | ${copyEntry ? "Yes" : "No"} |`;
    })
    .join("\n");

  // Build per-section detailed instructions.
  const perSectionInstructions = selections.sections
    .map((s: BlockChoice) => {
      const copyEntry = copy.sections.find(
        (c: CopyEntry) => c.section_id === s.section_id,
      );
      const componentName = toPascalCase(s.section_id);

      let instruction = `
### Section: ${s.section_id}

**Source file:** \`${projectDir}/src/components/${s.block_name}.tsx\`
**Output file:** \`${outputDir}/components/${s.section_id}.tsx\`
**Component name:** \`${componentName}\`
**Category:** ${s.category}
**Customization notes:** ${s.customization_notes}

Steps:
1. Read the source file at \`${projectDir}/src/components/${s.block_name}.tsx\` using the Read tool.
2. Create a new component based on its structure but with the following modifications.`;

      if (copyEntry) {
        instruction += `
3. Replace the main headline text with: "${copyEntry.headline}"`;

        if (copyEntry.headline_accent_phrase) {
          instruction += `
4. Apply mixed-bold-italic pattern to the headline:
   - Find the phrase "${copyEntry.headline_accent_phrase}" within the headline text.
   - Wrap it in: \`<span className="font-[var(--font-accent)] italic">${copyEntry.headline_accent_phrase}</span>\`
   - The surrounding headline text keeps its normal styling with \`font-[var(--font-heading)]\`.`;
        }

        instruction += `
${copyEntry.headline_accent_phrase ? "5" : "4"}. Replace subtext/description with: "${copyEntry.subtext}"`;

        if (copyEntry.cta_text) {
          instruction += `
${copyEntry.headline_accent_phrase ? "6" : "5"}. Replace CTA button text with: "${copyEntry.cta_text}"`;
        }

        if (copyEntry.bullet_points && copyEntry.bullet_points.length > 0) {
          instruction += `
${copyEntry.headline_accent_phrase ? "7" : "6"}. Replace feature/bullet list items with:
${copyEntry.bullet_points.map((bp, i) => `   ${i + 1}. "${bp}"`).join("\n")}`;
        }

        if (copyEntry.testimonial_quote) {
          instruction += `
- Replace testimonial/quote text with: "${copyEntry.testimonial_quote}"`;
        }
      }

      return instruction;
    })
    .join("\n");

  // Build the imports list for page.tsx.
  const pageImports = selections.sections
    .map((s: BlockChoice) => {
      const componentName = toPascalCase(s.section_id);
      return `import { ${componentName} } from "./components/${s.section_id}";`;
    })
    .join("\n");

  const pageSections = selections.sections
    .map((s: BlockChoice) => {
      const componentName = toPascalCase(s.section_id);
      return `      <${componentName} />`;
    })
    .join("\n");

  // -------------------------------------------------------------------------
  // Assemble the full prompt
  // -------------------------------------------------------------------------

  return `You are the Assembler agent. Your job is to combine installed shadcnblocks source code with provided copy and theme tokens to produce the final page output files.

## Overview

You will create customized section components, a page file that composes them, and a theme CSS file.

## Data

### Block Selections (YAML)
\`\`\`yaml
${serializeSelections(selections)}
\`\`\`

### Copy Data (YAML)
\`\`\`yaml
${serializeCopy(copy)}
\`\`\`

### Section Mapping

| section_id | block_name | has_copy |
|------------|------------|----------|
${sectionTable}

## Theme CSS

Write the following content to \`${outputDir}/theme.css\`:

\`\`\`css
${themeCss}
\`\`\`

## Global Rules

### Theme Compliance
- NEVER hardcode color values. Always use CSS variables: \`var(--accent-primary)\`, \`var(--background)\`, etc.
- All heading text must use \`font-[var(--font-heading)]\` unless it is an accent phrase.
- All body text must use \`font-[var(--font-body)]\`.
- Accent phrases use \`font-[var(--font-accent)]\` with \`italic\` class.
- Border radius values must use \`var(--border-radius)\` or the appropriate border variable.
- Shadows must use \`var(--shadow-*)\` variables.
- If a color in the source block is hardcoded (e.g., \`text-blue-600\`, \`bg-gray-100\`), replace it with the closest semantic CSS variable from the theme.

### Mixed-Font Headline Pattern
For any section that has a \`headline_accent_phrase\` in its copy data:
1. The full headline is rendered in \`font-[var(--font-heading)] font-bold\`.
2. The accent phrase portion is wrapped in \`<span className="font-[var(--font-accent)] italic">{accent phrase}</span>\`.
3. This creates the mixed-bold-italic typographic pattern.

### Component Structure
Every output section component must follow this pattern:

\`\`\`tsx
import { cn } from "@/lib/utils";
// ... other imports as needed from the source block

interface SectionProps {
  className?: string;
}

const ComponentName = ({ className }: SectionProps) => {
  return (
    <section className={cn("py-20", className)}>
      {/* customized content */}
    </section>
  );
};

export { ComponentName };
\`\`\`

- Keep all UI component imports from the source block (Button, Card, Badge, etc.).
- Keep layout structure and Tailwind utility classes from the source block.
- Replace only text content and theme-violating color/font classes.
- Preserve any icons, decorative elements, and structural markup.

### Animation Wrappers

Import animation components from \`@/components/animations\` and wrap section content based on section type:

| Section Type | Animation | Notes |
|-------------|-----------|-------|
| Hero | \`FadeInUpDelayed\` on subtitle (delay 0.2) + CTA (delay 0.4) | Do NOT animate the hero headline — it must be visible immediately |
| Features (grid) | \`StaggerContainer\` + \`StaggerItem\` + \`HoverLiftCard\` | Each card staggers in with hover lift |
| Features (bento) | \`FadeInUp\` on each cell with manual \`FadeInUpDelayed\` | Delay based on cell position (0, 0.1, 0.2...) |
| Pricing | \`StaggerContainer\` + \`StaggerItem\` + \`HoverLiftCard\` | Pricing tier cards stagger in |
| Testimonials | \`StaggerContainer\` + \`StaggerItem\` | Text blocks stagger in, no hover |
| CTA | \`FadeInUp\` on the entire section | Simple fade-in for call-to-action |
| Logo bar | \`StaggerContainer\` + \`StaggerItem\` | Logos stagger in left to right |
| Footer | None | Footers do not animate |
| Navbar | None | Navbars do not animate |

Import only the animations you need per component. Example:
\`\`\`tsx
import { FadeInUpDelayed } from "@/components/animations";
\`\`\`

Wrap section content in animation components — never modify block source code for animation. Animation wrappers go AROUND existing content.

### Asset Integration
${assetManifest ? `
Assets have been generated. For sections with successful assets, replace placeholder SVG \`src\` attributes with the generated image path:
${assetManifest.assets.filter(a => a.success && a.imagePath).map(a => `- Section \`${a.sectionId}\`: Use \`${a.imagePath}\``).join("\n")}

For sections where \`fallbackUsed: true\`, keep the existing placeholder SVG behavior.` : "No asset manifest provided. Keep existing placeholder SVG behavior for all sections."}

## Per-Section Instructions

For each section below, read the source block file, customize it, and write the output.
${perSectionInstructions}

## Output Files

### 1. Section Components

Write each customized section component to its output path as specified above. Use the Write tool for each file.

### 2. Page File

Write the following to \`${outputDir}/page.tsx\`:

\`\`\`tsx
import "./theme.css";
${pageImports}

export default function GeneratedPage() {
  return (
    <main>
${pageSections}
    </main>
  );
}
\`\`\`

### 3. Theme CSS

Write the theme CSS shown above to \`${outputDir}/theme.css\`.

## Execution Order

1. Read all source block files first to understand the structure of each block.
2. Write \`${outputDir}/theme.css\`.
3. Write each section component to \`${outputDir}/components/{section-id}.tsx\`.
4. Write \`${outputDir}/page.tsx\` last.

Use the Write tool for every file. Do not skip any section. Do not modify files outside of \`${outputDir}/\`.`;
}
