# Feature: Phase 1 — Component Library & Foundation

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files etc.

## Feature Description

Build the foundational layer for Siphio's multi-agent landing page builder: a searchable catalog of 1,300+ shadcnblocks.com premium blocks tagged with controlled vocabulary terms, a theme engine with CSS variable derivation, business profile input validation, and the pipeline directory structure that all subsequent phases depend on.

## User Story

As a multi-agent pipeline orchestrator
I want a structured, tagged component library with theme engine and vocabulary definitions
So that Phase 2 agents (Block Selector, Copy Writer, Assembler) can make precise, consistent decisions

## Problem Statement

The agent pipeline cannot function without a curated, searchable block catalog. Without controlled vocabulary tags, agents resort to free-text reasoning which is imprecise and context-heavy. Without a theme engine, generated pages lack visual consistency. This phase creates all the reference data and configuration that downstream agents consume.

## Solution Statement

1. Initialize a Next.js project with shadcn/ui and the premium `@shadcnblocks` registry
2. Enumerate all blocks via MCP, cache to a YAML catalog with controlled vocabulary tags
3. Define complete word pools for agent vocabulary
4. Build pairing rules for 8 core section categories
5. Create theme derivation logic (business profile + style profile → CSS variables)
6. Establish the pipeline directory structure and business profile schema

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High
**Primary Systems Affected**: Project scaffold, component library, theme engine, pipeline infrastructure
**Dependencies**: shadcnblocks MCP Server, shadcn/ui CLI, Node.js 20+
**Agent Behavior**: No (foundation data, not agent logic)

---

## TECHNOLOGY PROFILES CONSUMED

**Profiles read from `.agents/reference/`:**

- `shadcnblocks-mcp-profile.md` — Used for: Block enumeration, catalog building, MCP tool usage
  - Key endpoints: `list_items_in_registries`, `view_items_in_registries`, `search_items_in_registries`, `get_project_registries`
  - Auth method: Bearer token via `components.json` registry config
  - Critical constraints: Cache `list_items_in_registries` result (G3), CDN URLs are manual construction (G8), fuzzy search returns partial matches (G4), free vs pro block count difference (G7)

- `shadcn-ui-cli-profile.md` — Used for: Project initialization, block installation, registry configuration
  - Key endpoints: `shadcn init`, `shadcn add`, `shadcn list`, `shadcn view`
  - Auth method: `SHADCNBLOCKS_API_KEY` must be in shell environment (not .env alone — gotcha 7.3)
  - Critical constraints: `components.json` must exist before MCP works (G1/7.2), `--yes --overwrite --silent` flags mandatory (7.1), no concurrent `add` commands (Section 4)

**Impact on Implementation:**
- Must initialize project with `shadcn init` before any MCP or CLI operations
- Must export `SHADCNBLOCKS_API_KEY` to shell before spawning agents
- Catalog build is a single MCP call (`list_items_in_registries`) + local processing
- Block detail enrichment uses `view_items_in_registries` in batches of 10-20 with 1s delay

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `PRD.md` (lines 387-432) — Phase 1 scope, prerequisites, deliverables, "Done When" criteria
- `PRD.md` (lines 49-88) — Technology decisions for shadcnblocks + Nano Banana 2
- `PRD.md` (lines 105-132) — Decision trees: Block Selection, Theme Derivation
- `PRD.md` (lines 185-200) — SC-008 (missing block category) + SC-010 (bento grid) scenarios
- `context/style-profile.yaml` (full file) — Color profile, typography, layout patterns, theme defaults (Section 9), section flow template (Section 10)
- `.agents/reference/shadcnblocks-mcp-profile.md` (full file) — MCP tools, data models, gotchas, rate limits
- `.agents/reference/shadcn-ui-cli-profile.md` (full file) — CLI commands, error codes, automation flags

### New Files to Create

```
# Project scaffold
app/                           # Next.js App Router
  layout.tsx                   # Root layout with theme fonts
  globals.css                  # CSS variables from theme engine
  page.tsx                     # Placeholder landing page
src/
  components/ui/               # Created by shadcn init
  lib/utils.ts                 # Created by shadcn init

# Pipeline infrastructure
pipeline/
  input/                       # Business profile + style profile
    business-profile.schema.yaml
    sample-business-profile.yaml
  library/                     # Block catalog
    block-catalog.yaml         # Full catalog index (all 1,300+ blocks)
    blocks/                    # Detail files for landing-page-relevant blocks
  vocabulary/
    controlled-vocabulary.yaml # All word pools
    pairing-rules.yaml         # Block category pairing rules
  run-template/                # Template for per-run pipeline state
    01-strategy/
    02-blocks/
    03-copy/
    04-assets/
    05-assembly/
    06-qa/

# Theme engine
src/lib/
  theme/
    theme-template.yaml        # Default theme token template
    derive-theme.ts            # Business profile → concrete theme.yaml
    generate-css.ts            # theme.yaml → globals.css variables
    types.ts                   # Theme type definitions

# Output structure template
output/                        # Final deliverable target

# Configuration
components.json                # shadcn/ui + @shadcnblocks registry config
.env.local                     # SHADCNBLOCKS_API_KEY (already exists from preflight)
tailwind.config.ts             # Tailwind with CSS variable references
tsconfig.json                  # Path aliases matching components.json

# Catalog builder scripts
scripts/
  build-catalog.ts             # MCP → YAML catalog builder
  tag-blocks.ts                # Controlled vocabulary tagger
  validate-profile.ts          # Business profile validator
  theme-validator.ts           # Theme compliance checker (PRD Section 4.1)
```

### Patterns to Follow

**Naming Conventions:** kebab-case for files, PascalCase for React components, camelCase for functions/variables

**YAML Structure:** Use consistent 2-space indentation, string values quoted when containing special chars, arrays for lists

**Script Pattern:** TypeScript scripts in `scripts/` using `tsx` runner (`npx tsx scripts/build-catalog.ts`)

**Theme Token Pattern:** CSS custom properties on `:root`, consumed by Tailwind `theme.extend` references:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --accent-primary: 142.1 76.2% 36.3%;
}
```

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: CREATE Next.js Project Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --yes
```

- **IMPLEMENT**: Initialize in current project root. App Router mode, TypeScript, Tailwind, src/ directory, no import alias (we configure aliases via components.json).
- **GOTCHA**: Must use `--yes` to skip all interactive prompts. If project root has existing files, the CLI may warn — use `--yes` to proceed.
- **VALIDATE**: `test -f package.json && test -f tsconfig.json && test -d src/app && echo "PASS" || echo "FAIL"`

### Task 2: CREATE shadcn/ui Configuration

```bash
npx shadcn@latest init --yes --silent
```

- **IMPLEMENT**: Creates `components.json`, `src/lib/utils.ts`, and configures path aliases. Style: `new-york`, CSS variables: true, base color: neutral.
- **PROFILE**: shadcn-ui-cli-profile.md Section 1 — init creates components.json
- **GOTCHA**: CLI profile 7.2 — must restart Claude Code after this for MCP to read new config
- **VALIDATE**: `test -f components.json && grep -q "cssVariables" components.json && echo "PASS" || echo "FAIL"`

### Task 3: UPDATE components.json — Add @shadcnblocks Registry

- **IMPLEMENT**: Add `registries` section to `components.json`:
```json
"registries": {
  "@shadcnblocks": {
    "url": "https://shadcnblocks.com/r/{name}",
    "headers": {
      "Authorization": "Bearer ${SHADCNBLOCKS_API_KEY}"
    }
  }
}
```
- **PROFILE**: shadcnblocks-mcp-profile.md Section 1, shadcn-ui-cli-profile.md Section 1
- **GOTCHA**: CLI reads `SHADCNBLOCKS_API_KEY` from shell env, not .env files (CLI profile gotcha 7.3). Ensure orchestrator exports the var.
- **VALIDATE**: `grep -q "@shadcnblocks" components.json && echo "PASS" || echo "FAIL"`

### Task 4: CREATE .mcp.json — MCP Server Configuration

- **IMPLEMENT**: Create `.mcp.json` in project root:
```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```
- **PROFILE**: shadcnblocks-mcp-profile.md Section 1 — MCP setup step 1
- **GOTCHA**: MCP profile G2 — requires Claude Code restart after creating this file
- **VALIDATE**: `test -f .mcp.json && cat .mcp.json | npx -y json -q && echo "PASS" || echo "FAIL"`

### Task 5: CREATE Pipeline Directory Structure

- **IMPLEMENT**: Create the full directory tree:
```
pipeline/input/
pipeline/library/blocks/
pipeline/vocabulary/
pipeline/run-template/01-strategy/
pipeline/run-template/02-blocks/
pipeline/run-template/03-copy/
pipeline/run-template/04-assets/
pipeline/run-template/05-assembly/
pipeline/run-template/06-qa/
output/
scripts/
src/lib/theme/
```
- **PATTERN**: Matches PRD Section 6 pipeline directory layout
- **VALIDATE**: `test -d pipeline/library/blocks && test -d pipeline/vocabulary && test -d scripts && echo "PASS" || echo "FAIL"`

### Task 6: CREATE pipeline/vocabulary/controlled-vocabulary.yaml

- **IMPLEMENT**: Define all 7 word pools. These are the ONLY terms agents use for block tagging and selection.

```yaml
mood:
  - clean          # Minimal, whitespace-forward
  - friendly       # Approachable, illustrated, warm
  - bold           # High contrast, strong typography
  - elegant        # Refined, serif accents, subtle
  - playful        # Colorful, animated, casual
  - professional   # Structured, corporate, serious
  - techy          # Developer-focused, code-forward

density:
  - sparse         # Large whitespace, few elements
  - balanced       # Moderate content, comfortable spacing
  - dense          # Compact, information-rich, tight spacing

layout:
  - centered-stack    # Vertically stacked, center-aligned
  - split-horizontal  # Two-column left/right
  - bento-asymmetric  # Mixed-size grid cards (3+2, 2x3)
  - grid-uniform      # Equal-size columns (2, 3, or 4)
  - single-column     # Full-width, stacked content
  - masonry           # Pinterest-style variable height

section_purpose:
  - hero              # Above-the-fold primary section
  - features          # Product/service capability showcase
  - pricing           # Plan comparison and selection
  - testimonials      # Social proof and customer quotes
  - cta               # Conversion prompt with action
  - footer            # Page footer with links
  - navbar            # Navigation header
  - faq               # Frequently asked questions
  - stats             # Metrics and numbers showcase
  - team              # People/team showcase
  - logos             # Partner/integration logo cloud
  - contact           # Lead capture form
  - gallery           # Visual showcase grid
  - blog              # Content preview cards

visual_type:
  - illustration      # Hand-drawn or vector illustrations
  - screenshot        # Product UI screenshots
  - icon-cluster      # Grouped icons or logos
  - decorative        # Abstract shapes, blobs, patterns
  - photography       # Real photos (rare in this aesthetic)

headline_pattern:
  - mixed-bold-italic   # Bold sans + italic serif (signature)
  - all-bold            # Uniform bold sans
  - italic-lead         # Italic opening + bold closing
  - minimal             # Regular weight, understated

cta_style:
  - pill-filled       # Rounded, solid background
  - pill-outline      # Rounded, border only
  - rectangular       # Standard border-radius
  - text-link         # No button, underlined text
```

- **PATTERN**: Terms derived from `context/style-profile.yaml` Sections 1-6
- **VALIDATE**: `test -f pipeline/vocabulary/controlled-vocabulary.yaml && echo "PASS" || echo "FAIL"`

### Task 7: CREATE pipeline/vocabulary/pairing-rules.yaml

- **IMPLEMENT**: Define pairing rules for 8 core section categories. Rules govern which blocks work well adjacent to each other.

```yaml
# Pairing rules — used by Block Selector (Phase 2) to prevent visual clashes
# Reference: PRD Section 4.2 (Block Selection Decision Tree), SC-003
rules:
  hero:
    pairs_well_with: [logos, features]
    never_after: [cta, footer]
    max_adjacent_same_density: 1
    notes: "Hero is always first content section after navbar"

  features:
    pairs_well_with: [hero, testimonials, stats, cta]
    never_after: [features]           # No two feature sections adjacent
    max_adjacent_same_density: 2
    notes: "Primary features → detail features OK if different layout type"

  pricing:
    pairs_well_with: [features, testimonials, faq, cta]
    never_after: [pricing, hero]
    max_adjacent_same_density: 1
    notes: "Pricing needs context (features) before it"

  testimonials:
    pairs_well_with: [features, pricing, cta]
    never_after: [testimonials, logos]
    max_adjacent_same_density: 1

  cta:
    pairs_well_with: [testimonials, faq, features, pricing]
    never_after: [hero, cta]
    max_adjacent_same_density: 1
    notes: "CTA repeats at end, never directly after hero"

  footer:
    pairs_well_with: [cta]
    never_after: [hero, features]
    max_adjacent_same_density: 1
    notes: "Footer is always last section"

  navbar:
    pairs_well_with: [hero]
    never_after: []                   # Navbar is always first
    max_adjacent_same_density: 1

  faq:
    pairs_well_with: [pricing, cta, testimonials]
    never_after: [hero, faq]
    max_adjacent_same_density: 1
```

- **PATTERN**: Derived from `context/style-profile.yaml` Section 10 (recommended section flow)
- **VALIDATE**: `test -f pipeline/vocabulary/pairing-rules.yaml && echo "PASS" || echo "FAIL"`

### Task 8: CREATE scripts/build-catalog.ts — MCP Catalog Builder

- **IMPLEMENT**: TypeScript script that:
  1. Calls shadcn MCP `list_items_in_registries` for `@shadcnblocks` (or falls back to CLI `shadcn list @shadcnblocks`)
  2. Parses each block entry: extracts name, infers category from name prefix (e.g., `hero125` → category `hero`)
  3. Constructs CDN screenshot URL: `https://deifkwefumgah.cloudfront.net/shadcnblocks/screenshots/block/{name}-4x3.webp`
  4. Writes `pipeline/library/block-catalog.yaml` with all entries
  5. Reports: total count, count per category, landing-page-relevant count
- **PROFILE**: MCP profile Section 3.2 (`list_items_in_registries`), G3 (cache aggressively), G8 (CDN URL manual construction)
- **IMPORTS**: `js-yaml` for YAML writing, `child_process` for CLI fallback
- **GOTCHA**: MCP tools are available via Claude Code MCP integration, not directly callable from scripts. The script should use `shadcn list @shadcnblocks` CLI as the primary enumeration method. MCP is for interactive agent use in Phase 2.
- **VALIDATE**: `npx tsx scripts/build-catalog.ts && test -f pipeline/library/block-catalog.yaml && echo "PASS" || echo "FAIL"`

### Task 9: CREATE scripts/tag-blocks.ts — Controlled Vocabulary Tagger

- **IMPLEMENT**: TypeScript script that:
  1. Reads `pipeline/library/block-catalog.yaml`
  2. Reads `pipeline/vocabulary/controlled-vocabulary.yaml`
  3. For each block, assigns tags based on rules:
     - `section_purpose`: From category name (hero → hero, features → features, etc.)
     - `mood`: From description keywords ("minimal" → clean, "colorful" → playful, "dark" → bold)
     - `density`: From description keywords ("compact" → dense, "spacious" → sparse, default → balanced)
     - `layout`: From description keywords ("grid" → grid-uniform, "bento" → bento-asymmetric, "centered" → centered-stack)
  4. Writes updated catalog back to `block-catalog.yaml` with tags on each entry
  5. Reports: tagged count, untagged count, distribution per tag
- **IMPORTS**: `js-yaml`
- **GOTCHA**: Some blocks may not match any keyword → default to `mood: clean`, `density: balanced`, `layout: single-column`
- **VALIDATE**: `npx tsx scripts/tag-blocks.ts && grep -c "mood:" pipeline/library/block-catalog.yaml | xargs test 0 -lt && echo "PASS" || echo "FAIL"`

### Task 10: CREATE Block Detail Files for Landing-Page Categories

- **IMPLEMENT**: Script or addition to `build-catalog.ts` that:
  1. Filters catalog for landing-page categories: hero, features, pricing, testimonials, cta, footer, navbar, faq, stats, team, logos, bento, contact, gallery
  2. For each filtered block: calls `shadcn view @shadcnblocks/{name}` to get source code and dependencies
  3. Writes `pipeline/library/blocks/{name}.yaml` with: name, category, tags, description, dependencies, registryDependencies, file count, slot count (number of content placeholders in JSX)
  4. Batches requests: 10-20 at a time with 1s delay between batches
- **PROFILE**: MCP profile Section 3.4 (`view_items_in_registries`), rate limits (Section 4)
- **GOTCHA**: CLI `shadcn view` may output to stdout — capture and parse. Some blocks may fail (deprecated/renamed) — log and skip.
- **VALIDATE**: `ls pipeline/library/blocks/*.yaml 2>/dev/null | wc -l | xargs test 50 -lt && echo "PASS" || echo "FAIL"`

### Task 11: CREATE src/lib/theme/types.ts — Theme Type Definitions

- **IMPLEMENT**: TypeScript types for all theme tokens:
  - `ThemePalette`: background, surface, border, text_primary, text_secondary, text_muted, accent_primary, accent_secondary, accent_warm, cta_fill, cta_text
  - `ThemeTypography`: heading_font, heading_weight, accent_font, accent_weight, accent_style, body_font, body_weight, body_line_height
  - `ThemeBorders`: radius_sm, radius_md, radius_lg, radius_pill
  - `ThemeShadows`: card, elevated
  - `ThemeEffects`: grain, glassmorphism, mesh_gradient, soft_gradient
  - `Theme`: combines all above + name field
  - `BusinessProfile`: name, description, features[], audience, industry?, brand_colors?, tone?
- **PATTERN**: Mirror structure from `context/style-profile.yaml` Section 9
- **VALIDATE**: `npx tsc --noEmit src/lib/theme/types.ts && echo "PASS" || echo "FAIL"`

### Task 12: CREATE src/lib/theme/theme-template.yaml

- **IMPLEMENT**: Default theme YAML with all values from `context/style-profile.yaml` Section 9. This is the baseline that gets overridden by business profile brand colors.
- Copy the entire `theme` section from style profile as-is — these are the defaults.
- **VALIDATE**: `test -f src/lib/theme/theme-template.yaml && echo "PASS" || echo "FAIL"`

### Task 13: CREATE src/lib/theme/derive-theme.ts

- **IMPLEMENT**: Function `deriveTheme(businessProfile: BusinessProfile, styleProfile: Theme): Theme` that:
  1. Starts with theme-template defaults
  2. IF business profile has `brand_colors.primary` → use as `accent_primary`
  3. IF business profile has `brand_colors.secondary` → use as `accent_secondary`
  4. IF business has `industry` → look up industry-conventional accent from a small mapping (fintech → fresh-green, education → soft-blue, health → coral-red, etc.)
  5. ELSE → keep style profile defaults (fresh-green accent, dark-navy CTA)
  6. Run WCAG AA contrast check on text-on-background and CTA combos
  7. Auto-adjust lightness if contrast fails (PRD SC-002 error path)
  8. Return concrete Theme object
- **PATTERN**: PRD Section 4.2 — Theme Derivation decision tree
- **IMPORTS**: No external deps needed — contrast calculation is a simple formula
- **VALIDATE**: `npx tsx -e "import {deriveTheme} from './src/lib/theme/derive-theme'; console.log('OK')" && echo "PASS" || echo "FAIL"`

### Task 14: CREATE src/lib/theme/generate-css.ts

- **IMPLEMENT**: Function `generateCSS(theme: Theme): string` that:
  1. Converts hex colors to HSL values for CSS custom properties
  2. Generates `:root { --background: H S% L%; ... }` block
  3. Generates font-face imports or Google Fonts `@import` for heading + accent + body fonts
  4. Generates spacing, border-radius, and shadow variables
  5. Returns complete CSS string for `globals.css`
- **IMPORTS**: No external deps — hex to HSL is pure math
- **VALIDATE**: `npx tsx -e "import {generateCSS} from './src/lib/theme/generate-css'; console.log('OK')" && echo "PASS" || echo "FAIL"`

### Task 15: UPDATE app/globals.css — Wire Theme Variables

- **IMPLEMENT**: Replace default Tailwind globals with theme-derived CSS variables. Include:
  - `:root` block with all theme palette variables in HSL format
  - Font imports for Plus Jakarta Sans, DM Serif Display, Inter
  - Base Tailwind directives: `@tailwind base; @tailwind components; @tailwind utilities;`
  - Default body styles using CSS variables
- **PATTERN**: shadcn/ui convention — CSS variables in HSL without the `hsl()` wrapper, consumed by Tailwind as `hsl(var(--background))`
- **VALIDATE**: `grep -q "accent-primary" src/app/globals.css && echo "PASS" || echo "FAIL"`

### Task 16: UPDATE tailwind.config.ts — Extend with Theme Variables

- **IMPLEMENT**: Extend Tailwind theme to reference CSS custom properties:
  - Colors: `background: "hsl(var(--background))"`, etc. for all palette tokens
  - Font families: heading, accent, body
  - Border radius: sm, md, lg, pill
  - Box shadow: card, elevated
- **PATTERN**: Standard shadcn/ui Tailwind config pattern
- **VALIDATE**: `grep -q "accent-primary" tailwind.config.ts && echo "PASS" || echo "FAIL"`

### Task 17: CREATE pipeline/input/business-profile.schema.yaml

- **IMPLEMENT**: YAML schema defining:
  - Required fields: `name` (string), `description` (string, 10-500 chars), `features` (array, min 1, max 8, each has `title` + `description`), `audience` (string)
  - Optional fields: `industry` (string, from known list), `brand_colors` (object with `primary` hex, `secondary` hex), `tone` (enum: professional, friendly, bold, minimal)
- **PATTERN**: PRD SC-001 requires "name, description, 3 features, and industry", SC-002 requires brand colors
- **VALIDATE**: `test -f pipeline/input/business-profile.schema.yaml && echo "PASS" || echo "FAIL"`

### Task 18: CREATE pipeline/input/sample-business-profile.yaml

- **IMPLEMENT**: A complete sample business profile for testing:
```yaml
name: "CloudMetrics"
description: "Real-time analytics dashboard for SaaS businesses"
features:
  - title: "Live Dashboard"
    description: "See your metrics update in real-time with zero lag"
  - title: "Smart Alerts"
    description: "Get notified before problems become outages"
  - title: "Team Reports"
    description: "Share beautiful reports with your entire team"
audience: "SaaS founders and product managers"
industry: "fintech"
tone: "professional"
brand_colors:
  primary: "#3B82F6"
  secondary: "#10B981"
```
- **VALIDATE**: `test -f pipeline/input/sample-business-profile.yaml && echo "PASS" || echo "FAIL"`

### Task 19: CREATE scripts/validate-profile.ts

- **IMPLEMENT**: Validation script that:
  1. Reads a business profile YAML file (path from CLI arg)
  2. Checks required fields exist and meet constraints
  3. Validates hex color format if brand_colors provided
  4. Validates feature count (1-8)
  5. Reports errors with field names and constraints
  6. Exits 0 on valid, 1 on invalid
- **IMPORTS**: `js-yaml`
- **VALIDATE**: `npx tsx scripts/validate-profile.ts pipeline/input/sample-business-profile.yaml && echo "PASS" || echo "FAIL"`

### Task 20: CREATE scripts/theme-validator.ts

- **IMPLEMENT**: Theme compliance checker that:
  1. Reads a generated `.tsx` page file
  2. Checks for hardcoded color values (hex codes not in theme)
  3. Checks for hardcoded font families not matching theme
  4. Checks for hardcoded spacing values outside theme scale
  5. Reports violations as JSON: `{ file, line, type, value, suggestion }`
  6. Exits 0 if zero violations, 1 otherwise
- **PATTERN**: PRD Section 4.1 — Theme Validator (non-AI script for speed)
- **IMPORTS**: `fs`, regex-based scanning
- **VALIDATE**: `npx tsx scripts/theme-validator.ts --help 2>&1 | grep -q "Usage" || echo "Script created (no --help flag is OK)"`

### Task 21: CREATE app/layout.tsx — Root Layout with Theme Fonts

- **IMPLEMENT**: Next.js root layout with:
  1. Google Fonts imports: Plus Jakarta Sans (400, 700), DM Serif Display (400 italic), Inter (400)
  2. Font CSS variables applied to `<html>` element
  3. Metadata with title "Siphio — Landing Page Builder"
  4. Body with `className` using theme font variable
- **PATTERN**: Next.js 14 App Router font optimization pattern
- **VALIDATE**: `grep -q "Plus_Jakarta_Sans\|Plus Jakarta Sans" src/app/layout.tsx && echo "PASS" || echo "FAIL"`

### Task 22: INTEGRATION TEST — End-to-End Theme Derivation

- **IMPLEMENT**: Run the full theme pipeline:
  1. `npx tsx scripts/validate-profile.ts pipeline/input/sample-business-profile.yaml`
  2. Create a small test script that calls `deriveTheme` + `generateCSS` with the sample profile
  3. Verify output CSS contains the business profile's brand blue (#3B82F6) as accent
  4. Verify WCAG contrast passes for all text-on-background combos
- **VALIDATE**: `npx tsx scripts/validate-profile.ts pipeline/input/sample-business-profile.yaml && echo "PASS" || echo "FAIL"`

### Task 23: INTEGRATION TEST — Catalog Health Check

- **IMPLEMENT**: After running `build-catalog.ts` + `tag-blocks.ts`:
  1. Verify catalog has 1,000+ entries (Pro tier — MCP profile G7)
  2. Verify every entry has: name, category, at least one mood tag, density tag, layout tag, screenshot_url
  3. Verify landing-page categories have block detail files
  4. Report category distribution
- **VALIDATE**: `npx tsx scripts/build-catalog.ts && npx tsx scripts/tag-blocks.ts && echo "PASS" || echo "FAIL"`

---

## TESTING STRATEGY

### Unit Tests

- Theme derivation: brand color override, industry lookup, WCAG contrast adjustment
- CSS generation: hex-to-HSL conversion, variable naming, font imports
- Profile validation: missing fields, invalid hex, feature count bounds
- Block tagger: keyword-to-tag mapping, default fallbacks

### Integration Tests

- Full pipeline: sample profile → derive theme → generate CSS → valid output
- Catalog build: MCP/CLI enumeration → YAML index → tagged catalog → detail files
- Theme validator: scan a sample .tsx with intentional violations → reports them

### Edge Cases

- Business profile with 1 feature (minimum) and 8 features (maximum)
- Brand colors that fail WCAG contrast → auto-adjustment
- Block with no description → default tags applied
- Category with 0 blocks in catalog → graceful handling per SC-008

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
npx tsc --noEmit
npx next lint
```

**Expected**: All commands pass with exit code 0

### Level 2: Unit Tests

```bash
npx tsx scripts/validate-profile.ts pipeline/input/sample-business-profile.yaml
```

**Expected**: Profile validates without errors

### Level 3: Live Integration Tests

```bash
# T1-01: Verify MCP/CLI is functional
npx shadcn@latest --version

# T1-02: Verify @shadcnblocks registry is accessible
npx shadcn@latest list @shadcnblocks 2>&1 | head -20

# T2-01: Install a test base component
npx shadcn@latest add button --yes --overwrite --silent

# T2-02: Install a test premium block
npx shadcn@latest add @shadcnblocks/hero-125 --yes --overwrite --silent
```

**Expected**: All commands exit 0; `hero-125` files appear in `src/components/`

### Level 4: Live Integration Validation

```bash
# Full catalog build + tagging pipeline
npx tsx scripts/build-catalog.ts
npx tsx scripts/tag-blocks.ts

# Theme derivation end-to-end
npx tsx -e "
import { deriveTheme } from './src/lib/theme/derive-theme.js';
import { generateCSS } from './src/lib/theme/generate-css.js';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
const profile = yaml.load(readFileSync('pipeline/input/sample-business-profile.yaml', 'utf8'));
const template = yaml.load(readFileSync('src/lib/theme/theme-template.yaml', 'utf8'));
const theme = deriveTheme(profile, template);
const css = generateCSS(theme);
console.log(css.includes('--accent-primary') ? 'PASS' : 'FAIL');
"

# Next.js build succeeds
npx next build
```

**Expected**: Catalog has 1,000+ entries; theme CSS includes custom properties; build succeeds

---

## ACCEPTANCE CRITERIA

- [ ] Next.js project initialized with App Router, TypeScript, Tailwind, shadcn/ui
- [ ] `components.json` configured with `@shadcnblocks` registry and Bearer auth
- [ ] `.mcp.json` configured for Claude Code MCP server
- [ ] Block catalog contains 1,000+ entries with controlled vocabulary tags (per MCP profile G7)
- [ ] Every block has: name, category, mood, density, layout, screenshot_url
- [ ] Controlled vocabulary YAML complete with all 7 word pools
- [ ] Pairing rules defined for 8 core categories
- [ ] Theme template matches style profile Section 9 defaults
- [ ] Theme derivation handles brand color override + WCAG contrast check
- [ ] CSS variable generation produces valid `:root` block
- [ ] Business profile schema validates required/optional fields
- [ ] Pipeline directory structure matches PRD Section 6
- [ ] `npx next build` succeeds with zero errors
- [ ] SC-008 (missing category) handled gracefully in catalog

---

## COMPLETION CHECKLIST

- [ ] All 23 tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands (Levels 1-4) executed successfully
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx next lint` — zero lint errors
- [ ] `npx next build` — successful build
- [ ] Block catalog populated with 1,000+ tagged entries
- [ ] Theme pipeline produces valid CSS from sample profile

---

## NOTES

### Scope Analysis Decisions (Phase 0)

1. **Catalog storage**: YAML index + detail files for relevant categories only. Full detail for all 1,300+ blocks would bloat the library. Agents in Phase 2 read the index for filtering, then detail files for selected candidates only.

2. **Tagging approach**: Algorithmic from description + category name, not manual. At 1,300+ blocks, manual tagging is infeasible. Default tags (clean, balanced, single-column) applied when no keyword match — agents can refine in Phase 2.

3. **MCP vs CLI for enumeration**: Scripts use CLI (`shadcn list`, `shadcn view`) because MCP tools require Claude Code MCP integration which isn't callable from TypeScript scripts. MCP tools are reserved for interactive agent use in Phase 2.

4. **Theme derivation**: Pure TypeScript with no external color libraries. Hex-to-HSL and contrast calculation are simple formulas. Avoids unnecessary dependencies.

5. **Font loading**: Google Fonts via Next.js font optimization (next/font/google). No self-hosted fonts in v1.

6. **Pairing rules**: 8 categories cover the style profile's recommended section flow. Rules are simple (pairs_well_with, never_after) — not weighted scores. Phase 2 Block Selector adds scoring logic on top.

7. **PRD assumption**: PRD references "YAML index + individual block detail files" but doesn't specify exact schema. Assumed block detail includes: name, category, tags, description, dependencies, registryDependencies, file count, slot count. If more fields needed, Phase 2 plan adjusts.

## PIV-Automator-Hooks
plan_status: ready_for_execution
phase_source: Phase 1 from PRD
independent_tasks_count: 6
dependent_chains: 4
technologies_consumed: shadcnblocks-mcp, shadcn-ui-cli
next_suggested_command: execute
next_arg: ".agents/plans/phase-1-component-library-foundation.md"
estimated_complexity: high
confidence: 8/10
