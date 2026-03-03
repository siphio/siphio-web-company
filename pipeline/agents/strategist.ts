// Strategist agent — prompt builder
// Constructs a prompt for the Claude Code Agent Tool sub-agent that plans
// the section flow of a landing page based on a BusinessProfile and style profile.

import type { BusinessProfile } from "../../src/lib/theme/types";

// --- Controlled vocabulary ---

const SECTION_PURPOSES = [
  "hero",
  "features",
  "pricing",
  "testimonials",
  "cta",
  "footer",
  "navbar",
  "faq",
  "stats",
  "team",
  "logos",
  "contact",
  "gallery",
  "blog",
] as const;

const LAYOUT_TERMS = [
  "centered-stack",
  "split-horizontal",
  "bento-asymmetric",
  "grid-uniform",
  "single-column",
  "masonry",
] as const;

const VISUAL_TYPES = [
  "illustration",
  "screenshot",
  "icon-cluster",
  "decorative",
  "photography",
] as const;

// --- Helpers ---

function serializeProfileAsYaml(profile: BusinessProfile): string {
  const lines: string[] = [];
  lines.push(`name: "${profile.name}"`);
  lines.push(`description: "${profile.description}"`);
  lines.push(`audience: "${profile.audience}"`);
  if (profile.industry) lines.push(`industry: "${profile.industry}"`);
  if (profile.tone) lines.push(`tone: "${profile.tone}"`);
  if (profile.brand_colors) {
    lines.push(`brand_colors:`);
    lines.push(`  primary: "${profile.brand_colors.primary}"`);
    if (profile.brand_colors.secondary) {
      lines.push(`  secondary: "${profile.brand_colors.secondary}"`);
    }
  }
  lines.push(`features:`);
  for (const feat of profile.features) {
    lines.push(`  - title: "${feat.title}"`);
    lines.push(`    description: "${feat.description}"`);
  }
  return lines.join("\n");
}

function determineSectionCount(featureCount: number): { min: number; max: number; extras: string } {
  if (featureCount <= 2) {
    return {
      min: 5,
      max: 5,
      extras: "Use exactly 5 sections: navbar, hero, features, cta, footer.",
    };
  }
  if (featureCount <= 4) {
    return {
      min: 6,
      max: 7,
      extras:
        "Use 6-7 sections. In addition to the core 5 (navbar, hero, features, cta, footer), " +
        "add 1-2 from: testimonials, stats, or pricing — whichever best supports the business profile.",
    };
  }
  return {
    min: 7,
    max: 8,
    extras:
      "Use 7-8 sections. In addition to the core 5, add 2-3 from: testimonials, stats, pricing, " +
      "logos, faq, or a second features section — choose based on which best supports the business profile.",
  };
}

// --- Prompt builder ---

export function buildStrategistPrompt(
  profile: BusinessProfile,
  styleProfilePath: string,
  vocabPath: string,
  runDir: string,
): string {
  const featureCount = profile.features.length;
  const sectionGuidance = determineSectionCount(featureCount);
  const outputPath = `${runDir}/section-plan.yaml`;

  return `You are the Strategist agent. Your job is to plan the section flow for a landing page.

## Business Profile

\`\`\`yaml
${serializeProfileAsYaml(profile)}
\`\`\`

## Instructions

1. **Read the style profile** at \`${styleProfilePath}\` to understand the visual style, color palette, typography, and layout preferences established for this project. Internalize the mood and design direction — your section choices must feel consistent with this style.

2. **Read the controlled vocabulary** at \`${vocabPath}\` to see all allowed values for section_purpose, layout, and visual_type tags. You MUST only use values from that vocabulary in your output.

3. **Determine the section flow.** The business has ${featureCount} feature${featureCount === 1 ? "" : "s"}. ${sectionGuidance.extras} Target section count: ${sectionGuidance.min}${sectionGuidance.min !== sectionGuidance.max ? `-${sectionGuidance.max}` : ""}.

4. **For each section**, produce the following fields:
   - \`id\`: A unique kebab-case identifier (e.g., \`hero-main\`, \`features-grid\`, \`cta-bottom\`).
   - \`purpose\`: One of the allowed section_purpose values: ${SECTION_PURPOSES.join(", ")}.
   - \`title_hint\`: A short phrase (3-8 words) suggesting the headline direction for the copy writer. Do NOT write final copy — just a directional hint.
   - \`layout_preference\`: One of the allowed layout values: ${LAYOUT_TERMS.join(", ")}. Pick the layout that best fits the section's purpose and the style profile's preferences.
   - \`visual_requirement\`: One of the allowed visual_type values: ${VISUAL_TYPES.join(", ")}. Pick what visual treatment suits this section.

5. **Section ordering rules:**
   - \`navbar\` is always first.
   - \`hero\` is always second.
   - \`footer\` is always last.
   - \`cta\` should appear near the bottom, just before footer.
   - Feature-heavy sections go in the upper-middle.
   - Social proof (testimonials, logos, stats) goes in the lower-middle.
   - Never place two sections with the same purpose adjacent to each other.

6. **Style alignment:** Reference the style profile you read to guide layout and visual choices. For example, if the style profile emphasizes illustration-forward design, prefer \`illustration\` for visual_requirement. If it favors centered layouts, lean toward \`centered-stack\`.

## Output

Write a YAML file to \`${outputPath}\` with this exact structure:

\`\`\`yaml
# Section plan generated by Strategist agent
# Business: ${profile.name}
# Feature count: ${featureCount}
# Section count: [N]

sections:
  - id: navbar-main
    purpose: navbar
    title_hint: "..."
    layout_preference: centered-stack
    visual_requirement: decorative
  - id: hero-main
    purpose: hero
    title_hint: "..."
    layout_preference: "..."
    visual_requirement: "..."
  # ... remaining sections ...
  - id: footer-main
    purpose: footer
    title_hint: "..."
    layout_preference: "..."
    visual_requirement: "..."
\`\`\`

Use the Write tool to create the file at that path. The file must be valid YAML. Do NOT wrap the YAML in a markdown code fence inside the file — write raw YAML only.

## Constraints

- Only use section_purpose values from: ${SECTION_PURPOSES.join(", ")}
- Only use layout_preference values from: ${LAYOUT_TERMS.join(", ")}
- Only use visual_requirement values from: ${VISUAL_TYPES.join(", ")}
- Every section must have all 5 fields (id, purpose, title_hint, layout_preference, visual_requirement)
- Section count must be between ${sectionGuidance.min} and ${sectionGuidance.max}
- title_hint must be 3-8 words — directional, not final copy
- id values must be unique and kebab-case

After writing the file, confirm the file path and list the sections you chose with a brief rationale for each.`;
}
