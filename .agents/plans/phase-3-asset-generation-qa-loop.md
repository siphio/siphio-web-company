# Feature: Phase 3 — Asset Generation & QA Loop

The following plan should be complete, but validate documentation and codebase patterns before implementing.
Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

Add AI-generated visual assets (hero illustrations, feature icons, decorative elements) via Nano Banana 2 (Gemini API), replacing Phase 2 placeholder SVGs. Implement the autonomous QA iteration loop with 3-level evaluation and scoped re-runs. Apply basic scroll animations (fade-in-up, hover lift, staggered reveal) via Framer Motion wrapper components. This completes the full autonomous pipeline: business profile in → polished, asset-rich landing page out.

## User Story

As a founder/marketer
I want custom illustrations and icons generated for my landing page with autonomous quality checking
So that I receive a polished, brand-consistent result without manual iteration

## Problem Statement

Phase 2 produces assembled pages with themed placeholder SVGs — functional but visually generic. There is no QA feedback loop to catch theme violations, visual monotony, or copy mismatches. The pipeline ships whatever it produces on the first pass without self-correction.

## Solution Statement

Three additions to the pipeline: (1) An Asset Generator agent that uses Nano Banana 2 with cascading prompts and moodboard reference images to produce style-consistent illustrations and icons. (2) Animation wrapper components that the Assembler applies based on section type. (3) A QA Agent that evaluates assembled output across 3 levels and routes issues back to specific agents for scoped re-runs, with a max of 3 iterations before shipping.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High
**Primary Systems Affected**: pipeline/agents/, pipeline/orchestrator.ts, src/components/animations/, output/
**Dependencies**: @google/genai SDK, motion (Framer Motion), Gemini API key
**Agent Behavior**: Yes — implements QA Issue Routing and Convergence Check decision trees (PRD 4.2)

---

## TECHNOLOGY PROFILES CONSUMED

- `nano-banana-2-gemini-api-profile.md` — Used for: Asset Generator agent
  - Key endpoint: `generateContent` with `responseModalities: ["IMAGE"]`
  - Model: `gemini-3.1-flash-image-preview`
  - Auth: `GOOGLE_GEMINI_API_KEY` env var via `@google/genai` SDK
  - Critical: Max 3 concurrent requests, 2s min delay, 3 retries with exponential backoff
  - Reference images: Up to 14 per request (use 2-3 moodboard images)
  - Safety: Dual-layer filtering — set `BLOCK_ONLY_HIGH` thresholds
  - No SVG output (raster only) — icons at `512px` then trace if needed

- `framer-motion-profile.md` — Used for: Animation wrapper components
  - Package: `motion` (not legacy `framer-motion`)
  - Import: `import { motion } from "motion/react"`
  - Requires: `"use client"` directive on every file importing motion
  - 3 recipes: FadeInUp, HoverLift, StaggeredReveal — all copy-paste ready from profile Section 3
  - Performance: Only animate `opacity`, `y`, `scale`, `boxShadow` (GPU-accelerated)
  - Gotcha: Hero headline must NOT animate (visible immediately) — only subtitle + CTA

**Impact on Implementation:**
Asset Generator must handle Nano Banana 2's aggressive content filtering (profile Gotcha 2) with prompt simplification on retry. Framer Motion requires small `"use client"` wrapper components to avoid polluting server component tree. Both integrate into the existing Assembler flow — assets are placed by Assembler, animations are wrapper divs around existing sections.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `pipeline/orchestrator.ts` (lines 1-598) — Main pipeline; extend with Asset Generator + QA loop steps
- `pipeline/agents/strategist.ts` — MIRROR: Prompt builder pattern for new agents
- `pipeline/agents/assembler.ts` — MIRROR: Theme CSS embedding, section iteration, per-section instructions
- `pipeline/agents/copy-writer.ts` — MIRROR: Tone guidance mapping pattern
- `pipeline/agents/block-selector.ts` — MIRROR: Candidate serialization for prompt embedding
- `pipeline/lib/types.ts` — All pipeline state interfaces; extend with Asset + QA types
- `pipeline/templates/placeholder-svg.ts` — Existing fallback SVGs; Asset Generator falls back to these
- `pipeline/lib/yaml-helpers.ts` — `readYaml`, `writeYaml` helpers
- `pipeline/lib/catalog-filter.ts` — Pattern for reading YAML catalogs
- `scripts/theme-validator.ts` — Theme compliance checker; QA Agent invokes this programmatically
- `src/lib/theme/types.ts` — Theme, BusinessProfile, ThemePalette types
- `context/style-profile.yaml` — Moodboard analysis used to build base prompt for Asset Generator
- `context/moodboard-websites/` — 6 `.jpg` reference images for style anchoring
- `src/app/layout.tsx` — Font loading with `"use client"` pattern reference
- `src/components/hero125.tsx` — Example installed block (animation targets)
- `output/theme.css` — Generated theme CSS variables
- `pipeline/vocabulary/controlled-vocabulary.yaml` — Word pools for QA vocabulary checking

### New Files to Create

**Asset Generator:**
- `pipeline/agents/asset-generator.ts` — Prompt builder for the Asset Generator sub-agent
- `pipeline/lib/gemini-client.ts` — Nano Banana 2 API wrapper (generate, retry, throttle)
- `pipeline/lib/asset-types.ts` — Asset category configs, prompt templates, sizing presets

**QA Agent:**
- `pipeline/agents/qa-agent.ts` — Prompt builder for the QA evaluation sub-agent
- `pipeline/lib/qa-types.ts` — QA issue types, routing rules, convergence state

**Animation Wrappers:**
- `src/components/animations/fade-in-up.tsx` — FadeInUp + FadeInUpDelayed wrappers
- `src/components/animations/hover-lift.tsx` — HoverLiftCard + HoverScaleButton wrappers
- `src/components/animations/stagger.tsx` — StaggerContainer + StaggerItem wrappers
- `src/components/animations/index.ts` — Re-exports for clean imports

### Patterns to Follow

**Prompt Builder Pattern** (all Phase 2 agents):
```typescript
export function buildXxxPrompt(inputs, runDir): string {
  // 1. Serialize inputs to YAML-like strings
  // 2. Return template literal with instructions, data, output path
  // 3. Agent writes output to runDir as YAML/file
}
```

**File-Based State**: All inter-agent data passes through YAML files in `pipeline/run-{id}/`. No in-memory state between agents.

**Error Handling**: Functions return `null` on exhausted retries (not throw). Caller handles fallback.

**Theme CSS Variables**: Never hardcode colors. Use `var(--accent-primary)`, `var(--font-heading)`, etc.

---

## AGENT BEHAVIOR IMPLEMENTATION

### Decision Trees to Implement

**QA Issue Routing (PRD 4.2):**
- IF issue is `theme_violation` → route to Assembler for direct fix
- ELSE IF `visual_monotony` → route to Block Selector for re-pick
- ELSE IF `copy_mismatch` → route to Copy Writer for section re-run
- ELSE IF `asset_quality` → route to Asset Generator with tighter constraints
- ELSE IF `structural` → route to Assembler
- ON FAILURE (same issue persists) → increment iteration counter, try alternative approach

**Convergence Check (PRD 4.2):**
- IF QA passes all 3 levels → ship
- ELSE IF iteration < 3 AND issues decreasing → route fixes, re-run QA
- ELSE IF iteration < 3 AND issues increasing → structural problem, try alternative block combination
- ELSE (iteration >= 3) → ship with issues documented, escalate

**Asset Retry (PRD SC-004, mapped from Nano Banana 2 profile Section 5):**
- Try generation with full cascading prompt (base + category + specific)
- On non-STOP finishReason → simplify prompt (drop specific, keep base + category)
- On 429 → wait 60s cooldown
- On 5xx → exponential backoff (2s, 4s, 8s)
- After 3 failures → return null, use placeholder SVG

### Scenario Mappings

| Scenario | Agent Workflow | Decision Tree | Success Criteria |
|---|---|---|---|
| SC-004: Asset Generation Failure | Asset Gen → retry simplified → placeholder SVG | Asset Retry | Image generated or graceful fallback |
| SC-005: Copy Vocabulary Violation | QA detects → routes to Copy Writer → re-run | QA Issue Routing | All terms match vocabulary word pools |
| SC-006: QA Convergence Failure | 3 iterations exhausted → ship + issue report | Convergence Check | Issues documented, user notified |
| SC-007: Parallel Agent Timeout | Asset Gen exceeds 5min → Assembler uses placeholders | Convergence Check | Page assembled regardless of timeout |

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation — Types, SDK, Animation Components

**Tasks:**
- Install `@google/genai` and `motion` packages
- Define asset and QA type interfaces extending `pipeline/lib/types.ts`
- Create Gemini API client wrapper with retry/throttle logic
- Create animation wrapper components (3 recipes from Framer Motion profile)

### Phase 2: Core — Asset Generator + QA Agent

**Tasks:**
- Build Asset Generator prompt builder following existing agent pattern
- Build cascading prompt templates (base theme + category presets)
- Build QA Agent prompt builder with 3-level evaluation
- Define QA issue routing and convergence tracking

### Phase 3: Integration — Orchestrator Extension + Assembler Updates

**Tasks:**
- Add Asset Generator step to orchestrator pipeline
- Update Assembler prompt to include animation wrappers and real asset paths
- Add QA loop step with iteration tracking
- Wire convergence logic and scoped re-run routing

### Phase 4: Testing & Validation

**Tasks:**
- Gemini API connectivity test (Tier 1)
- Animation component render tests
- QA routing logic tests
- End-to-end pipeline with sample business profile

---

## VALIDATION STRATEGY

### Tools to Validate

| Tool | Test Inputs | Expected Behavior | Mock Needed |
|------|-------------|-------------------|-------------|
| Gemini API (`generateContent`) | Simple prompt + 512px | Returns PNG base64, finishReason: STOP | No (Tier 1 live) |
| Gemini API (with refs) | Prompt + 2 moodboard images | Returns styled PNG | No (Tier 3 live) |
| Theme Validator script | Generated .tsx files | Zero violations | No |
| Animation wrappers | React render test | Components render children | No (jsdom) |

### PRD Scenario Validation

| Scenario | Test Plan | Pass Criteria |
|---|---|---|
| SC-004 | Mock 2 blocked responses then success | Retry produces image on 3rd attempt |
| SC-004 fallback | Mock 3 blocked responses | Returns null, placeholder SVG used |
| SC-005 | Generate copy with non-vocab term | QA catches, routes to Copy Writer |
| SC-006 | Force 3 failing QA iterations | Ships with issue report, no crash |
| SC-007 | Simulate 5min Asset Gen timeout | Assembler proceeds with placeholders |

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### 1. ADD npm dependencies

- **IMPLEMENT**: Run `npm install @google/genai motion`
- **VALIDATE**: `node -e "require('@google/genai'); require('motion'); console.log('ok')"`

### 2. CREATE `pipeline/lib/asset-types.ts`

- **IMPLEMENT**: Define asset category types and cascading prompt config:
  ```typescript
  export interface AssetCategory {
    name: string;
    imageSize: "512px" | "1K" | "2K";
    aspectRatio: string;
    basePrompt: string;       // From style profile
    categoryPrompt: string;   // Per-category suffix
  }
  export interface AssetRequest {
    sectionId: string;
    category: AssetCategory;
    specificPrompt: string;   // From section plan visual_requirement
    referenceImages: Buffer[];
  }
  export interface AssetResult {
    sectionId: string;
    success: boolean;
    imagePath?: string;       // output/assets/{section-id}.png
    fallbackUsed: boolean;
  }
  export interface AssetManifest {
    assets: AssetResult[];
  }
  ```
- **DEFINE** the 5 preset categories:
  - `hero`: `2K`, `16:9`, base prompt from style profile keywords
  - `feature-icon`: `512px`, `1:1`, flat icon style prompt
  - `bento-card`: `1K`, `3:2`, abstract decorative card prompt
  - `background-texture`: `2K`, `16:9`, subtle pattern prompt
  - `decorative`: `1K`, `1:1`, small accent element prompt
- **PROFILE**: Nano Banana 2 profile Section 8 (PRD Capability Mapping) for exact sizing
- **VALIDATE**: `npx tsx -e "import './pipeline/lib/asset-types'; console.log('ok')"`

### 3. CREATE `pipeline/lib/gemini-client.ts`

- **IMPLEMENT**: Gemini API wrapper with:
  - `GoogleGenAI` initialization from `process.env.GOOGLE_GEMINI_API_KEY`
  - `generateAsset(request: AssetRequest): Promise<Buffer | null>` — single generation call
  - `generateAssetWithRetry(request: AssetRequest, retries = 3): Promise<Buffer | null>` — retry with prompt simplification
  - Throttle config: `maxConcurrent: 3`, `minDelayMs: 2000`, `backoffMultiplier: 2`, `rateLimitCooldownMs: 60000`
  - Safety settings: `BLOCK_ONLY_HIGH` for all categories except sexually explicit (`BLOCK_MEDIUM_AND_ABOVE`)
  - Prompt simplification on non-STOP finishReason: drop `specificPrompt`, keep `basePrompt + categoryPrompt`
  - On 429: wait 60s. On 5xx: exponential backoff. After all retries: return `null`.
- **PATTERN**: MIRROR retry pattern from profile Section 5 (lines 206-231)
- **PROFILE**: Nano Banana 2 profile Section 3.1 for `generateContent` call shape, Section 4 for rate limits
- **IMPORTS**: `GoogleGenAI` from `@google/genai`, `fs` for writing output, `AssetRequest` from `./asset-types`
- **GOTCHA**: Blocked requests still consume API quota (profile Section 5). Track total requests for cost awareness.
- **GOTCHA**: No SVG output — raster only. Write as `.png` to `output/assets/`.
- **VALIDATE**: `npx tsx -e "import { GoogleGenAI } from '@google/genai'; console.log('SDK loaded')"`

### 4. CREATE `pipeline/lib/qa-types.ts`

- **IMPLEMENT**: Define QA evaluation types:
  ```typescript
  export type QAIssueType = "theme_violation" | "visual_monotony" | "copy_mismatch" | "asset_quality" | "structural";
  export type QARouteTarget = "assembler" | "block-selector" | "copy-writer" | "asset-generator";
  export interface QAIssue {
    type: QAIssueType;
    severity: "critical" | "warning";
    sectionId: string;
    description: string;
    routeTo: QARouteTarget;
  }
  export interface QAResult {
    iteration: number;
    passed: boolean;
    issues: QAIssue[];
    levels: { l1_technical: boolean; l2_theme: boolean; l3_design: boolean };
  }
  export interface QAConvergenceState {
    iterations: QAResult[];
    maxIterations: 3;
    currentIteration: number;
    converged: boolean;
    shippedWithIssues: boolean;
  }
  ```
- **IMPLEMENT**: Issue routing map (from PRD 4.2):
  ```typescript
  export const ISSUE_ROUTE_MAP: Record<QAIssueType, QARouteTarget> = {
    theme_violation: "assembler",
    visual_monotony: "block-selector",
    copy_mismatch: "copy-writer",
    asset_quality: "asset-generator",
    structural: "assembler",
  };
  ```
- **VALIDATE**: `npx tsx -e "import './pipeline/lib/qa-types'; console.log('ok')"`

### 5. CREATE animation wrapper components

- **CREATE** `src/components/animations/fade-in-up.tsx`:
  - `"use client"` directive at top
  - `FadeInUp` component: `initial={{ opacity: 0, y: 40 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, margin: "-50px" }}`, `transition={{ duration: 0.5, ease: "easeOut" }}`
  - `FadeInUpDelayed` component: same but accepts `delay` prop
  - MIRROR: Framer Motion profile Section 3, Recipe 1 (lines 139-176)

- **CREATE** `src/components/animations/hover-lift.tsx`:
  - `"use client"` directive
  - `HoverLiftCard`: `whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}`
  - `HoverScaleButton`: `whileHover={{ scale: 1.03 }}`, `whileTap={{ scale: 0.98 }}`
  - MIRROR: Profile Section 3, Recipe 2 (lines 189-228)

- **CREATE** `src/components/animations/stagger.tsx`:
  - `"use client"` directive
  - `StaggerContainer`: variants with `staggerChildren: 0.1`, `delayChildren: 0.1`, uses `whileInView="visible"`
  - `StaggerItem`: child variant `{ opacity: 0, y: 30 }` → `{ opacity: 1, y: 0 }`
  - MIRROR: Profile Section 3, Recipe 3 (lines 237-294)

- **CREATE** `src/components/animations/index.ts`:
  - Re-export all components from the three files above
  - No `"use client"` needed on this barrel file

- **GOTCHA**: All motion imports must be from `motion/react` (not `framer-motion`)
- **GOTCHA**: Hero headline must NOT be animated — only subtitle + CTA get FadeInUpDelayed
- **VALIDATE**: `npx tsc --noEmit src/components/animations/index.ts`

### 6. CREATE `pipeline/agents/asset-generator.ts`

- **IMPLEMENT**: Prompt builder function `buildAssetGeneratorPrompt(sectionPlan, theme, runDir, moodboardPaths)`:
  - Reads `context/style-profile.yaml` to extract base prompt keywords (mood, palette description, style direction)
  - Builds cascading prompt per section: `${basePrompt}. ${categoryPrompt}. Subject: ${section.visual_requirement} for ${section.purpose} section.`
  - Serializes section plan entries with their `visual_requirement` fields
  - Instructs sub-agent to: read moodboard images → call Gemini API per section → write images to `{runDir}/assets/` → write `asset-manifest.yaml` with paths and success/failure status
  - Includes the throttle config, retry logic instructions, and fallback to placeholder SVG
  - Output: `{runDir}/assets/` directory + `{runDir}/asset-manifest.yaml`
- **PATTERN**: MIRROR `pipeline/agents/strategist.ts` for prompt builder structure
- **PROFILE**: Nano Banana 2 profile Section 3.2 for reference image API shape
- **GOTCHA**: Reference images must be `.jpg`/`.png` — skip `.avf` files in moodboard directory
- **GOTCHA**: Use `imageConfig.imageSize` not `resolution` — SDK naming from profile Section 2
- **VALIDATE**: `npx tsc --noEmit pipeline/agents/asset-generator.ts`

### 7. CREATE `pipeline/agents/qa-agent.ts`

- **IMPLEMENT**: Prompt builder `buildQAAgentPrompt(runDir, outputDir, iteration, previousIssues?)`:
  - Level 1 (Technical): Check that all output `.tsx` files have valid imports, no undefined references, TypeScript compiles without error. Instruct agent to run `npx tsc --noEmit output/page.tsx`.
  - Level 2 (Theme): Run `npx tsx scripts/theme-validator.ts` on each output component. Check all colors use CSS variables, fonts use theme variables, no hardcoded values.
  - Level 3 (Design Quality): Evaluate against style profile checklist:
    - Visual monotony: Are adjacent sections using different layouts?
    - Copy vocabulary: Do headlines use controlled vocabulary terms?
    - Asset consistency: Do generated images use consistent style (if assets present)?
    - Section flow: Does ordering follow PRD patterns?
    - Mixed-font headlines: Are accent phrases properly applied?
  - Output: `{runDir}/qa-result-{iteration}.yaml` with `QAResult` structure
  - Include routing instructions: map each issue type to target agent per `ISSUE_ROUTE_MAP`
  - Include `previousIssues` for regression detection (issues increasing = structural problem)
- **PATTERN**: MIRROR `pipeline/agents/assembler.ts` for multi-step evaluation prompt structure
- **VALIDATE**: `npx tsc --noEmit pipeline/agents/qa-agent.ts`

### 8. UPDATE `pipeline/lib/types.ts` — Add Asset + QA interfaces

- **ADD** imports from `./asset-types` and `./qa-types` (re-export for single import point)
- **UPDATE** `PipelineRun` interface to include:
  ```typescript
  assets?: AssetManifest;
  qaState?: QAConvergenceState;
  ```
- **UPDATE** `SectionEntry` interface to add optional `asset_path?: string` field
- **VALIDATE**: `npx tsc --noEmit pipeline/lib/types.ts`

### 9. UPDATE `pipeline/orchestrator.ts` — Extend pipeline with Asset Gen + QA Loop

- **ADD** imports for new agent builders and types:
  - `import { buildAssetGeneratorPrompt } from "./agents/asset-generator"`
  - `import { buildQAAgentPrompt } from "./agents/qa-agent"`
  - `import type { AssetManifest, QAConvergenceState } from "./lib/types"`
- **ADD** new constants:
  - `MOODBOARD_DIR`: `resolve(PROJECT_ROOT, "context/moodboard-websites")`
  - `MAX_QA_ITERATIONS = 3`
- **ADD** helper: `getMoodboardImagePaths(): string[]` — scans `MOODBOARD_DIR` for `.jpg` files, returns first 3 paths
- **ADD** helper: `mkAssetsDir(runDir)` — creates `{runDir}/assets/` directory
- **ADD** Step 8b after current Step 8 (Theme Validation):
  - Print `🟡 Step 9: Running Asset Generator agent...`
  - Get moodboard paths, create assets directory
  - Build Asset Generator prompt, write to `{runDir}/asset-generator-prompt.md`
  - Check for existing `asset-manifest.yaml` (agent may have already run)
  - If not exists: generate default manifest with `fallbackUsed: true` for CLI testing
  - Print results summary
- **ADD** Step 8c: Update Assembler call to include asset paths and animation instructions
- **ADD** Step 9: QA Loop
  - Initialize convergence state: `{ iterations: [], maxIterations: 3, currentIteration: 0, converged: false }`
  - While `!converged && currentIteration < MAX_QA_ITERATIONS`:
    - Build QA agent prompt for current iteration
    - Write prompt to `{runDir}/qa-prompt-{iteration}.md`
    - Check for existing QA result (agent may have already run)
    - If not exists: generate default passing result for CLI testing
    - Read QA result, push to iterations array
    - If `result.passed`: set `converged = true`
    - Else if issues increasing vs previous iteration: log structural problem warning
    - Else: log issue routing, increment iteration
  - Write final `qa-convergence.yaml` to run directory
  - Print convergence result summary
- **PRESERVE**: All existing Steps 1-8, variable names, helper functions unchanged
- **GOTCHA**: Keep `generateDefaultSectionPlan`, `generateDefaultBlockSelections`, `generateDefaultCopy` — add parallel `generateDefaultAssetManifest` and `generateDefaultQAResult` for CLI testing
- **VALIDATE**: `npx tsc --noEmit pipeline/orchestrator.ts`

### 10. UPDATE `pipeline/agents/assembler.ts` — Animation + Asset Integration

- **UPDATE** `buildAssemblerPrompt` signature to accept optional `assetManifest?: AssetManifest`:
  - Add `assetManifest` parameter with default `undefined`
  - If assets provided: include asset paths in per-section instructions
  - If no assets: keep existing placeholder behavior
- **ADD** animation instructions to Global Rules section:
  - Section type → animation mapping table (from Framer Motion profile Section 8):
    - Hero: `FadeInUpDelayed` on subtitle + CTA (delay 0.2, 0.4). NOT on headline.
    - Features (grid): `StaggerContainer` + `StaggerItem` + `HoverLiftCard`
    - Features (bento): `FadeInUp` on each cell with manual delay
    - Pricing: `StaggerContainer` + `StaggerItem` + `HoverLiftCard`
    - Testimonials: `StaggerContainer` + `StaggerItem`
    - CTA: `FadeInUp` on entire section
    - Logo bar: `StaggerContainer` + `StaggerItem`
    - Footer: None
  - Instruct Assembler to import from `@/components/animations`
  - Instruct Assembler to wrap section content in animation components, not replace
- **ADD** per-section asset instructions:
  - For sections with `assetManifest` entry where `success: true`: replace placeholder SVG `src` with `output/assets/{section-id}.png`
  - For sections with `fallbackUsed: true`: keep existing placeholder SVG
- **GOTCHA**: Animation imports require the wrapper files, not raw `motion/react` — keeps `"use client"` boundary clean
- **VALIDATE**: `npx tsc --noEmit pipeline/agents/assembler.ts`

### 11. ADD `package.json` scripts

- **ADD** `"pipeline:qa"`: `"npx tsx scripts/theme-validator.ts"` (convenience alias)
- **VALIDATE**: `npm run pipeline:qa -- --help` (or simply verify JSON is valid)

### 12. UPDATE `output/` directory structure

- **CREATE** `output/assets/.gitkeep` — directory for generated images
- **VALIDATE**: `ls output/assets/.gitkeep`

---

## TESTING STRATEGY

### Unit Tests

- `pipeline/lib/gemini-client.ts`: Test retry logic with mocked Gemini responses (STOP, SAFETY, 429, 500)
- `pipeline/lib/asset-types.ts`: Test category presets have valid imageSize/aspectRatio values
- `pipeline/lib/qa-types.ts`: Test ISSUE_ROUTE_MAP covers all QAIssueType values
- Animation components: Render tests via `@testing-library/react` + `vitest` + `jsdom`

### Integration Tests

- Gemini API Tier 1: `ai.models.list()` returns model list including `gemini-3.1-flash-image-preview`
- Gemini API Tier 3 (approval required): Single 512px test image generation (~$0.045)
- Full pipeline: `npx tsx pipeline/orchestrator.ts pipeline/input/sample-business-profile.yaml` completes with asset + QA steps

### Edge Cases

- All 3 Gemini retries blocked (IMAGE_SAFETY) → verify placeholder SVG used
- Rate limit (429) → verify 60s cooldown then retry
- QA iteration count reaches 3 with increasing issues → verify ships with issue report
- Asset Generator timeout (>5min) → verify Assembler proceeds with placeholders
- Empty moodboard directory → verify Asset Generator works without reference images (text-only prompt)

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
npx tsc --noEmit
npm run lint
```

**Expected**: Exit code 0, zero errors

### Level 2: Unit Tests

```bash
npx tsx -e "
import { ASSET_CATEGORIES } from './pipeline/lib/asset-types';
import { ISSUE_ROUTE_MAP } from './pipeline/lib/qa-types';
const cats = Object.keys(ASSET_CATEGORIES);
if (cats.length !== 5) throw new Error('Expected 5 asset categories');
const routes = Object.keys(ISSUE_ROUTE_MAP);
if (routes.length !== 5) throw new Error('Expected 5 issue routes');
console.log('✅ Types validated');
"
```

### Level 3: Live Integration Tests

```bash
# Tier 1: Gemini API connectivity
npx tsx -e "
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
const models = await ai.models.list();
const has3_1 = models.models?.some(m => m.name?.includes('gemini-3.1-flash'));
console.log('Gemini API connected:', !!models.models?.length);
console.log('3.1 Flash available:', has3_1);
if (!models.models?.length) throw new Error('No models returned');
"

# Tier 1: Animation components render
npx tsc --noEmit src/components/animations/index.ts
```

### Level 4: Live Integration Validation

```bash
# Tier 3: Single image generation (cost: ~$0.045)
npx tsx -e "
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
const r = await ai.models.generateContent({
  model: 'gemini-3.1-flash-image-preview',
  contents: 'A simple teal circle on a white background, flat illustration, minimal',
  config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: '512px' } },
});
const part = r.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
console.log('Generation success:', r.candidates?.[0]?.finishReason === 'STOP');
console.log('Has image data:', !!part?.inlineData?.data);
if (r.candidates?.[0]?.finishReason !== 'STOP') throw new Error('Generation failed');
"

# End-to-end pipeline with all Phase 3 steps
npx tsx pipeline/orchestrator.ts pipeline/input/sample-business-profile.yaml

# Theme validation on output
npx tsx scripts/theme-validator.ts output/page.tsx
```

### Level 5: Build Validation

```bash
npm run build
```

---

## ACCEPTANCE CRITERIA

- [ ] Asset Generator produces images via Nano Banana 2 with cascading prompts + reference images
- [ ] 5 asset categories implemented with correct sizing: hero (2K/16:9), icons (512px/1:1), bento (1K/3:2), bg (2K/16:9), decorative (1K/1:1)
- [ ] Retry logic: 3 attempts with prompt simplification on non-STOP finishReason
- [ ] Fallback to placeholder SVGs on all retries exhausted (SC-004)
- [ ] QA Agent evaluates 3 levels: technical, theme compliance, design quality
- [ ] QA issues routed to correct agent per ISSUE_ROUTE_MAP (PRD 4.2)
- [ ] Convergence logic: max 3 iterations, ships with docs on exhaustion (SC-006)
- [ ] Animation wrappers: FadeInUp, HoverLiftCard, StaggerContainer/StaggerItem all render
- [ ] Section-type-to-animation mapping applied by Assembler (hero subtitle only, features stagger, etc.)
- [ ] Hero headline NOT animated (Framer Motion profile Gotcha 3)
- [ ] All `"use client"` directives on animation wrapper files
- [ ] `motion` package imported from `motion/react` (not legacy `framer-motion`)
- [ ] Full pipeline runs end-to-end with asset generation + QA loop steps
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] Theme Validator reports zero violations on output
- [ ] All PRD Phase 3 scenarios (SC-004, SC-005, SC-006, SC-007) have test coverage

---

## COMPLETION CHECKLIST

- [ ] All 12 tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands (L1-L5) executed successfully
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — succeeds
- [ ] Animation wrappers render in browser (`npm run dev`)
- [ ] All acceptance criteria met

---

## NOTES

**Design Decisions from Scope Analysis:**

1. **Extending orchestrator, not replacing**: Phase 2 orchestrator works. New steps append after existing pipeline. All Phase 2 default generators preserved for CLI testing mode.

2. **Prompt builder pattern maintained**: Asset Generator and QA Agent follow the same `buildXxxPrompt() → string` pattern as all Phase 2 agents. Consistency reduces cognitive load for execution agent.

3. **Animation as wrapper components, not inline**: Creating dedicated `src/components/animations/` wrappers keeps `"use client"` boundaries small. Assembler wraps existing sections — never modifies block source code for animation.

4. **QA convergence tracked in file**: `qa-convergence.yaml` in run directory enables debugging and auditability. Each iteration's result preserved in `qa-result-{N}.yaml`.

5. **Moodboard image selection**: Using `.jpg` files from `context/moodboard-websites/` only (not `.avf` or `.avif`). Profile Gotcha 3 warns about reference image quality — the website screenshots have the strongest style signal.

6. **Cost awareness**: Dev/testing uses `512px` images ($0.045/each). Production hero uses `2K` ($0.101). Total cost for 7-section page: ~$0.50 per pipeline run. Rate-limited at 3 concurrent to stay within Tier 1 limits.

7. **No SVG tracing in v1**: Nano Banana 2 outputs raster only. Icons remain as `.png` at `512px`. SVG tracing (potrace) deferred — adds complexity for marginal v1 benefit.

8. **Safety settings relaxed per profile**: Landing page assets are low-risk content. Set `BLOCK_ONLY_HIGH` to minimize false blocks from Gemini's aggressive dual-layer filters.

## PIV-Automator-Hooks
plan_status: ready_for_execution
phase_source: Phase 3 from PRD
independent_tasks_count: 5
dependent_chains: 3
technologies_consumed: nano-banana-2-gemini-api,framer-motion
next_suggested_command: execute
next_arg: ".agents/plans/phase-3-asset-generation-qa-loop.md"
estimated_complexity: high
confidence: 8/10
