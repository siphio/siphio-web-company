// Asset Generator agent — prompt builder
// Constructs a prompt for the Claude Code Agent Tool sub-agent that generates
// visual assets (hero illustrations, feature icons, decorative elements)
// via Nano Banana 2 (Gemini API).
// Reference: PRD Phase 3, SC-004

import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import type { SectionPlan, SectionEntry } from "../lib/types";
import type { Theme } from "../../src/lib/theme/types";
import { ASSET_CATEGORIES } from "../lib/asset-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map section purpose to asset category name. */
function purposeToCategory(purpose: string): string {
  switch (purpose) {
    case "hero":
      return "hero";
    case "features":
      return "bento-card";
    case "pricing":
      return "bento-card";
    case "testimonials":
      return "decorative";
    case "stats":
      return "decorative";
    case "cta":
      return "decorative";
    case "logos":
      return "feature-icon";
    case "navbar":
    case "footer":
      return ""; // No asset generation for these sections
    default:
      return "decorative";
  }
}

/** Serialize section plan entries for prompt embedding. */
function serializeSections(plan: SectionPlan): string {
  return plan.sections
    .map(
      (s: SectionEntry) =>
        `  - id: ${s.id}\n    purpose: ${s.purpose}\n    visual_requirement: ${s.visual_requirement}\n    layout_preference: ${s.layout_preference}`,
    )
    .join("\n");
}

/** Build base prompt from style profile keywords and theme. */
function buildBasePromptContext(theme: Theme): string {
  return `Style: friendly modern SaaS illustration. Palette: accent ${theme.palette.accent_primary}, secondary ${theme.palette.accent_secondary}, warm ${theme.palette.accent_warm}. Background: light/white (${theme.palette.background}). Rounded shapes, soft gradients, flat design. No text in image. No human faces.`;
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

export function buildAssetGeneratorPrompt(
  sectionPlan: SectionPlan,
  theme: Theme,
  runDir: string,
  moodboardPaths: string[],
): string {
  const basePromptContext = buildBasePromptContext(theme);

  // Build per-section asset generation instructions
  const assetSections = sectionPlan.sections
    .filter((s) => purposeToCategory(s.purpose) !== "")
    .map((s) => {
      const catName = purposeToCategory(s.purpose);
      const cat = ASSET_CATEGORIES[catName];
      if (!cat) return "";

      return `
### Section: ${s.id} (${s.purpose})
- **Category**: ${catName}
- **Size**: ${cat.imageSize}, Aspect: ${cat.aspectRatio}
- **Visual requirement**: ${s.visual_requirement}
- **Cascading prompt**: "${cat.basePrompt} ${cat.categoryPrompt} Subject: ${s.visual_requirement} for ${s.purpose} section."
- **Output path**: \`${runDir}/assets/${s.id}.png\``;
    })
    .filter(Boolean)
    .join("\n");

  const moodboardInstructions =
    moodboardPaths.length > 0
      ? `Read these reference images and pass them to each generation call for style anchoring:
${moodboardPaths.map((p) => `- \`${p}\``).join("\n")}

Pass the first 3 images as reference images to each Gemini API call.`
      : "No moodboard reference images available. Use text-only prompts.";

  return `You are the Asset Generator agent. Your job is to generate visual assets for each section of a landing page using the Nano Banana 2 API (Gemini 3.1 Flash Image Preview).

## Theme Context

${basePromptContext}

## Section Plan

\`\`\`yaml
sections:
${serializeSections(sectionPlan)}
\`\`\`

## Reference Images (Moodboard)

${moodboardInstructions}

## Asset Generation Instructions

For each section below, generate an image using the Gemini API. Use the cascading prompt pattern: base prompt (style) + category prompt (size/composition) + specific prompt (section visual requirement).

${assetSections}

## API Usage

Use the \`@google/genai\` SDK:

\`\`\`typescript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    { text: "your cascading prompt here" },
    // Include reference image inlineData parts here
  ],
  config: {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  },
});
\`\`\`

## Retry Logic (SC-004)

- If \`finishReason\` is not \`STOP\`: simplify prompt (drop specific layer, keep base + category), retry
- On 429 error: wait 60 seconds, then retry
- On 5xx error: exponential backoff (2s, 4s, 8s), then retry
- After 3 failed attempts per image: skip and record \`fallbackUsed: true\`
- Wait at least 2 seconds between API requests

## Output

1. Generate images and write each to \`${runDir}/assets/{section-id}.png\`
2. Create the assets directory: \`${runDir}/assets/\`
3. Write an asset manifest to \`${runDir}/asset-manifest.yaml\`:

\`\`\`yaml
assets:
  - sectionId: "hero"
    success: true
    imagePath: "${runDir}/assets/hero.png"
    fallbackUsed: false
  - sectionId: "features"
    success: false
    fallbackUsed: true
\`\`\`

## Constraints

- Maximum 3 concurrent API requests
- Skip navbar and footer sections (no assets needed)
- Only use .jpg reference images from moodboard (skip .avf files)
- Use imageConfig.imageSize (not "resolution") — SDK naming convention
- Generated images are raster PNG only (no SVG output from Gemini)
- Log total API request count for cost awareness

After completing all generations, confirm how many assets were generated vs fallbacks used.`;
}

/**
 * Get moodboard .jpg image paths for reference image passing.
 * Filters to .jpg files only (skip .avf, .avif, .txt files).
 */
export function getMoodboardImagePaths(moodboardDir: string): string[] {
  try {
    const files = readdirSync(moodboardDir);
    return files
      .filter((f) => f.endsWith(".jpg"))
      .slice(0, 3)
      .map((f) => resolve(moodboardDir, f));
  } catch {
    return [];
  }
}
