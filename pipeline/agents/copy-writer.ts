import { SectionPlan } from "../lib/types";

/**
 * Tone guidance mapped to each supported tone keyword.
 * Each entry provides stylistic direction the sub-agent uses
 * when choosing words, sentence rhythm, and emotional register.
 */
const TONE_GUIDANCE: Record<string, string> = {
  professional:
    "Authoritative and clear. Use precise language that conveys expertise " +
    "without jargon. Prefer short declarative sentences. Avoid exclamation " +
    "marks. Confidence comes from specificity, not hyperbole.",
  friendly:
    "Warm and approachable. Write as if speaking to a smart friend. " +
    "Contractions are encouraged. Light humor is acceptable but never forced. " +
    "Sentences should feel conversational, not corporate.",
  bold:
    "High-energy and direct. Lead with strong verbs. Sentence fragments are " +
    "fine for impact. Be provocative where appropriate — challenge the status " +
    "quo. Confidence borders on audacity but never crosses into arrogance.",
  minimal:
    "Sparse and intentional. Every word must earn its place. Prefer single-clause " +
    "sentences. Strip adjectives to one per noun at most. White space in language " +
    "mirrors white space in design.",
};

/**
 * Serialize sections into a YAML-like block for embedding in the prompt.
 * We avoid importing js-yaml here because this runs at prompt-build time,
 * not inside the sub-agent. A simple serializer keeps dependencies light.
 */
function serializeSections(plan: SectionPlan): string {
  const lines: string[] = ["sections:"];
  for (const s of plan.sections) {
    lines.push(`  - id: "${s.id}"`);
    lines.push(`    purpose: "${s.purpose}"`);
    lines.push(`    title_hint: "${s.title_hint}"`);
    if (s.feature_index !== undefined) {
      lines.push(`    feature_index: ${s.feature_index}`);
    }
    lines.push(`    layout_preference: "${s.layout_preference}"`);
    lines.push(`    visual_requirement: "${s.visual_requirement}"`);
  }
  return lines.join("\n");
}

/**
 * Serialize features into a YAML-like block for embedding in the prompt.
 */
function serializeFeatures(
  features: Array<{ title: string; description: string }>
): string {
  if (features.length === 0) return "features: []";
  const lines: string[] = ["features:"];
  for (const f of features) {
    lines.push(`  - title: "${f.title}"`);
    lines.push(`    description: "${f.description}"`);
  }
  return lines.join("\n");
}

/**
 * Build the full prompt for the Copy Writer sub-agent.
 *
 * The returned string is passed directly to the Claude Code Agent Tool.
 * The sub-agent receives this as its sole instruction set and produces
 * a `copy.yaml` file in the run directory.
 */
export function buildCopyWriterPrompt(
  sectionPlan: SectionPlan,
  profileName: string,
  profileDescription: string,
  profileAudience: string,
  profileTone: string,
  features: Array<{ title: string; description: string }>,
  vocabPath: string,
  runDir: string
): string {
  const toneKey = profileTone.toLowerCase();
  const toneDirective =
    TONE_GUIDANCE[toneKey] ??
    TONE_GUIDANCE["professional"];

  const sectionsYaml = serializeSections(sectionPlan);
  const featuresYaml = serializeFeatures(features);
  const outputPath = `${runDir}/copy.yaml`;

  return `You are the Copy Writer agent in a multi-agent landing page pipeline.
Your job is to generate conversion-focused copy for every section in the section plan below.

---

## Business Profile

- **Name**: ${profileName}
- **Description**: ${profileDescription}
- **Target Audience**: ${profileAudience}
- **Tone**: ${profileTone}

## Tone Guidance

${toneDirective}

---

## Section Plan

\`\`\`yaml
${sectionsYaml}
\`\`\`

## Product Features

\`\`\`yaml
${featuresYaml}
\`\`\`

---

## Controlled Vocabulary

Read the vocabulary file at \`${vocabPath}\` before writing any copy.
All terms you use in headlines, subtext, and CTAs must come from either:
1. The word pools defined in the vocabulary file, OR
2. Business-specific terms from the profile above (product name, audience terms, feature names).

Do NOT invent marketing buzzwords outside these two sources.

### Headline Patterns (pick one per section)

| Pattern | Description |
|---------|-------------|
| mixed-bold-italic | Part of the headline is bold sans-serif, one phrase is italic serif accent |
| all-bold | Entire headline in bold sans-serif — no accent phrase |
| italic-lead | Headline leads with an italic serif phrase, remainder is bold sans |
| minimal | Short, understated, no accent phrase |

**Default pattern is \`mixed-bold-italic\`.** Use it for hero and primary feature sections.
Use \`all-bold\` or \`minimal\` for secondary sections (footer, logos, simple CTAs).

### CTA Styles (informational only — record the style, the assembler handles rendering)

| Style | When to Use |
|-------|-------------|
| pill-filled | Primary CTAs (hero, pricing) |
| pill-outline | Secondary CTAs alongside a primary |
| rectangular | Form submit buttons |
| text-link | Inline or footer CTAs |

---

## Rules

1. **Headlines**: Maximum 10 words. Punchy and benefit-driven.
2. **headline_accent_phrase**: When using \`mixed-bold-italic\` or \`italic-lead\` pattern, specify the exact word or phrase (2-4 words) from the headline that should render in italic serif. Set to \`null\` for \`all-bold\` and \`minimal\` patterns.
3. **Subtext**: Maximum 2 lines (roughly 20-30 words). Supports the headline — adds context, not repetition.
4. **CTA text**: Action-oriented, starts with a verb (e.g., "Get started", "See pricing", "Try it free"). Maximum 4 words.
5. **Bullet points**: Only for feature sections. 3-5 bullets, each one line. Lead with benefit, not feature name.
6. **testimonial_quote**: Only for testimonial sections. One short quote (1-2 sentences). If the section purpose is not a testimonial, omit this field.
7. Every \`section_id\` in the output must match a section \`id\` from the plan exactly.
8. Produce a CopyEntry for EVERY section in the plan — do not skip any.

---

## Output Format

Write a YAML file to \`${outputPath}\` using the Write tool.

The file must have this structure:

\`\`\`yaml
copy:
  - section_id: "hero"
    headline: "Build faster with smart tools"
    headline_accent_phrase: "smart tools"
    subtext: "Ship production-ready pages in minutes, not weeks."
    cta_text: "Get started"
  - section_id: "features"
    headline: "Everything you need"
    headline_accent_phrase: null
    subtext: "Powerful features designed for modern teams."
    bullet_points:
      - "Automate repetitive tasks and save hours each week"
      - "Collaborate in real-time with your entire team"
      - "Deploy with confidence using built-in testing"
  - section_id: "testimonials"
    headline: "Trusted by teams worldwide"
    headline_accent_phrase: "worldwide"
    subtext: "See what our customers have to say."
    testimonial_quote: "This tool transformed how we build landing pages."
\`\`\`

Use \`js-yaml\` to serialize the data. Import it as:
\`\`\`
import * as yaml from "js-yaml";
\`\`\`

Then write with the Write tool. Do NOT output the YAML to the terminal — write it to the file only.

---

## Process

1. Read the vocabulary file at \`${vocabPath}\`.
2. Review every section in the plan above.
3. For each section, generate copy following the rules and tone guidance.
4. Choose the appropriate headline pattern based on the section purpose.
5. Ensure accent phrases are actual substrings of the headline.
6. Write the complete \`copy.yaml\` to \`${outputPath}\`.
7. After writing, confirm the file was created by stating the number of sections written.
`;
}
