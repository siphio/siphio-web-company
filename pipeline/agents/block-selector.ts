// Block Selector agent prompt builder
// Constructs a prompt for the Claude Code Agent Tool sub-agent
// that selects optimal blocks per section using 4-layer reasoning.
// Reference: PRD 4.2 — Block Selection Decision Tree

import type { SectionPlan, SectionEntry, BlockEntry } from "../lib/types";

function serializeCandidates(candidates: BlockEntry[]): string {
  return candidates
    .map(
      (b) =>
        `  - name: ${b.name}\n    category: ${b.category}\n    mood: ${b.tags?.mood ?? "unknown"}\n    density: ${b.tags?.density ?? "unknown"}\n    layout: ${b.tags?.layout ?? "unknown"}\n    screenshot: ${b.screenshot_url}`,
    )
    .join("\n");
}

function serializeSections(plan: SectionPlan): string {
  return plan.sections
    .map(
      (s) =>
        `  - id: ${s.id}\n    purpose: ${s.purpose}\n    title_hint: "${s.title_hint}"\n    layout_preference: ${s.layout_preference}\n    visual_requirement: ${s.visual_requirement}`,
    )
    .join("\n");
}

export function buildBlockSelectorPrompt(
  sectionPlan: SectionPlan,
  filteredCatalogs: Map<string, BlockEntry[]>,
  pairingRulesPath: string,
  runDir: string,
): string {
  const candidateBlocks: string[] = [];
  for (const [sectionId, candidates] of filteredCatalogs.entries()) {
    candidateBlocks.push(
      `### Candidates for section "${sectionId}" (${candidates.length} blocks):\n${serializeCandidates(candidates)}`,
    );
  }

  return `You are the Block Selector agent for the Siphio landing page pipeline.

Your job: select the single best shadcnblocks.com block for each section in the section plan.

## Section Plan

sections:
${serializeSections(sectionPlan)}

## Pre-Filtered Block Candidates

Each section below has been pre-filtered to only show landing-page-relevant blocks matching that section's purpose. You must select from these candidates.

${candidateBlocks.join("\n\n")}

## Pairing Rules

Read the pairing rules file at: ${pairingRulesPath}

These define which section types work well together and which must never be adjacent.

## Selection Process — 4-Layer Reasoning

For each section, apply these layers in order:

**Layer 1: Functional Fit** (already done — candidates are pre-filtered by section_purpose)

**Layer 2: Aesthetic Fit**
- Prefer blocks with mood tag matching the overall page aesthetic: "friendly" or "clean"
- Prefer blocks with density tag that fits the section: "sparse" for hero/CTA, "balanced" for features, "dense" for stats/logos
- Score each candidate on how well its mood + density match

**Layer 3: Compositional Fit**
- Check pairing rules: does this block's category have a \`never_after\` conflict with the previous section's selected block?
- Prefer blocks from categories listed in \`pairs_well_with\` for the adjacent sections

**Layer 4: Differentiation**
- Prefer blocks that have NOT been selected for other sections
- If two blocks score equally, choose the one with a different layout type from already-selected blocks

## Output

Write a YAML file to: ${runDir}/block-selections.yaml

Use the Write tool with this structure:

\`\`\`yaml
sections:
  - section_id: "navbar"
    block_name: "header1"
    category: "header"
    customization_notes: "Brief notes on how to customize this block for the page"
    alternatives:
      - "header2"
      - "header5"
  - section_id: "hero"
    block_name: "hero42"
    category: "hero"
    customization_notes: "Replace headline, add accent font span, update CTA"
    alternatives:
      - "hero15"
      - "hero88"
\`\`\`

Rules:
- Exactly ONE block per section
- Include 2-3 alternatives per section (fallbacks if installation fails)
- customization_notes should mention what text/content to replace
- Do NOT select blocks that violate \`never_after\` pairing rules
- Do NOT select the same block for multiple sections

Write the file now.`;
}
