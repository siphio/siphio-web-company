# Feature: Phase 2 — Agent Pipeline Core Flow

The following plan should be complete, but validate documentation and codebase patterns before implementing.
Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

Build the complete agent orchestration pipeline from business profile input to assembled landing page output. Implements 4 core agents (Strategist, Block Selector, Copy Writer, Assembler), parallel execution, theme derivation with approval flow, block installation, and Theme Validator integration. Uses placeholder SVGs for visual assets (Phase 3 adds AI-generated assets). No QA iteration loop yet (Phase 3).

## User Story

As a founder/marketer
I want to provide my company details and receive a complete landing page
So that I get a professional web presence without hiring a design agency

## Problem Statement

Phase 1 built the component library, vocabulary, and theme engine — but there's no pipeline to use them. A user cannot yet go from business profile to assembled page. This phase connects all Phase 1 artifacts through an agent pipeline.

## Solution Statement

A TypeScript pipeline entry point reads the business profile, derives the theme, presents it for approval, then spawns four specialized Claude Code sub-agents that produce a section plan, block selections, section copy, and finally an assembled page. The Assembler installs blocks via CLI and composes the final output.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High
**Primary Systems Affected**: pipeline/, src/app/, output/
**Dependencies**: Claude Code Agent Tool, shadcn CLI, shadcnblocks MCP
**Agent Behavior**: Yes — implements Decision Trees from PRD Section 4.2

---

## TECHNOLOGY PROFILES CONSUMED

- `shadcnblocks-mcp-profile.md` — Used for: Block Selector search and discovery
  - Key tools: `search_items_in_registries`, `view_items_in_registries`
  - Auth: Bearer token via `components.json` + `SHADCNBLOCKS_API_KEY`
  - Critical: Fuzzy search (G4), cache catalog locally (G3)

- `shadcn-ui-cli-profile.md` — Used for: Block installation during assembly
  - Key command: `npx shadcn@latest add @shadcnblocks/{name} --yes --overwrite --silent`
  - Critical: Serial-only installation (Section 4), env var must be exported (G3), 120s timeout per block

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/theme/types.ts` — Theme, BusinessProfile, ThemePalette interfaces
- `src/lib/theme/derive-theme.ts` — `deriveTheme()` function: business profile → Theme object
- `src/lib/theme/generate-css.ts` — `generateCSS()` function: Theme → CSS string
- `src/lib/theme/theme-template.yaml` — Default theme values
- `pipeline/input/business-profile.schema.yaml` — Input schema constraints
- `pipeline/input/sample-business-profile.yaml` — Test input
- `pipeline/vocabulary/controlled-vocabulary.yaml` — All tag terms
- `pipeline/vocabulary/pairing-rules.yaml` — Block adjacency rules
- `pipeline/library/block-catalog.yaml` — 2,562 blocks with tags (826 landing-page relevant)
- `scripts/validate-profile.ts` — Business profile validator (reusable pattern)
- `scripts/theme-validator.ts` — Theme compliance checker (run post-assembly)
- `src/components/hero125.tsx` — Example installed block structure
- `src/app/layout.tsx` — Font loading pattern (Plus Jakarta Sans, DM Serif Display, Inter)
- `src/app/globals.css` — CSS variable definitions, Tailwind v4 `@theme inline` pattern
- `components.json` — shadcn config (aliases, registry)

### New Files to Create

**Pipeline core:**
- `pipeline/orchestrator.ts` — Main pipeline entry point
- `pipeline/agents/strategist.ts` — Strategist agent prompt builder
- `pipeline/agents/block-selector.ts` — Block Selector agent prompt builder
- `pipeline/agents/copy-writer.ts` — Copy Writer agent prompt builder
- `pipeline/agents/assembler.ts` — Assembler agent prompt builder
- `pipeline/lib/catalog-filter.ts` — Pre-filter catalog by section_purpose + pairing rules
- `pipeline/lib/block-installer.ts` — Serial block installation wrapper
- `pipeline/lib/section-plan.schema.ts` — Types for section plan YAML

**Per-run state (created at runtime, not committed):**
- `pipeline/run-{id}/theme.yaml` — Derived theme
- `pipeline/run-{id}/theme.css` — Generated CSS
- `pipeline/run-{id}/section-plan.yaml` — Strategist output
- `pipeline/run-{id}/block-selections.yaml` — Block Selector output
- `pipeline/run-{id}/copy.yaml` — Copy Writer output

**Output (final deliverable):**
- `output/page.tsx` — Composed page importing all section components
- `output/components/{section-name}.tsx` — Per-section component files
- `output/theme.css` — Theme CSS variables

### Patterns to Follow

**Naming:** kebab-case files, PascalCase components, camelCase functions
**Imports:** Use `@/` path aliases per `tsconfig.json` paths config
**YAML:** Use `js-yaml` for reading/writing (already installed)
**CLI execution:** Use `execSync` with `stdio: ['pipe','pipe','pipe']`, timeout 120s, inherit `process.env`
**Error pattern:** Try/catch with typed errors, exit code checks for CLI

---

## AGENT BEHAVIOR IMPLEMENTATION

### Decision Trees to Implement

**Block Selection (PRD 4.2 — Block Selection per section):**
- IF section has `must_contain` AND only 1 block matches functionally → select it
- ELSE IF multiple functional matches → score by aesthetic fit (mood + density tags)
- ELSE IF tied on aesthetic → score by compositional fit (pairing rules with adjacent sections)
- ELSE IF still tied → prefer block differing most from already-selected blocks
- ON FAILURE → escalate to Strategist to revise section requirements

**Theme Derivation (PRD 4.2 — Theme Derivation):**
- IF brand_colors.primary provided → use as accent, derive rest from style profile
- ELSE IF industry specified → apply INDUSTRY_ACCENTS mapping
- ELSE → keep template defaults (fresh-green accent, dark-navy CTA)
- Already implemented in `derive-theme.ts` — reuse directly

### Scenario Mappings

| Scenario | Agent Workflow | Decision Tree | Success Criteria |
|---|---|---|---|
| SC-001 Happy Path | Profile → Theme → Approval → Strategist → [Block Selector ∥ Copy Writer] → Assembler | Theme Derivation, Block Selection | 6-8 sections, renders in browser |
| SC-002 Brand Colors | Profile with hex → deriveTheme() applies WCAG → theme.yaml | Theme Derivation | Brand colors used, WCAG AA passes |
| SC-003 Pairing Conflicts | Block Selector checks pairing rules → skips conflicting → next-best | Block Selection | No `never_after` violations |
| SC-005 Vocabulary | Copy Writer uses controlled vocabulary word pools | N/A (prompt constraint) | QA vocabulary check passes |
| SC-009 Mixed Fonts | Assembler applies `mixed-bold-italic` headline pattern | N/A (assembly rule) | Hero headline has bold+italic |
| SC-010 Bento Grid | Block Selector searches bento/asymmetric for features | Block Selection | Asymmetric grid selected when available |

### Error Recovery

- Block install fails (CLI exit != 0): Try alternative block from same section_purpose tag
- Empty search results (SC-008): Fall back to `list_items_in_registries` filtered by category
- Theme contrast violation: `deriveTheme()` auto-adjusts (already implemented)
- Agent timeout (>5 min): Proceed with available outputs, log warning

---

## IMPLEMENTATION PLAN

### Phase 1: Pipeline Foundation

Set up directory structure, types, and utility functions that all agents depend on.

**Tasks:**
- Create `pipeline/` subdirectories (agents/, lib/, templates/)
- Define TypeScript interfaces for pipeline state (section plan, block selection, copy output)
- Build catalog filter utility
- Build block installer wrapper
- Create pipeline run-ID generation and directory scaffolding

### Phase 2: Agent Prompt Builders

Each agent is a prompt builder that constructs a detailed, context-rich prompt for the Claude Code Agent Tool. The agent reads relevant files and produces structured YAML output.

**Tasks:**
- Strategist: business profile + style profile → section-plan.yaml
- Block Selector: filtered catalog + section requirements + pairing rules → block-selections.yaml
- Copy Writer: section plan + business profile + vocabulary → copy.yaml
- Assembler: block source + copy + theme → component files + page.tsx

### Phase 3: Orchestrator

The main pipeline coordinator that sequences the agents and handles the approval flow.

**Tasks:**
- Profile validation → theme derivation → approval → agent spawning
- Parallel execution of Block Selector + Copy Writer
- Serial block installation
- Assembler invocation
- Theme Validator integration
- Output directory generation

---

## STEP-BY-STEP TASKS

### Task 1: CREATE `pipeline/lib/types.ts`

- **IMPLEMENT**: Pipeline state interfaces:
  ```
  SectionPlan { sections: SectionEntry[] }
  SectionEntry { id, purpose, title_hint, feature_index?, layout_preference, visual_requirement }
  BlockSelection { sections: BlockChoice[] }
  BlockChoice { section_id, block_name, category, customization_notes, alternatives }
  SectionCopy { sections: CopyEntry[] }
  CopyEntry { section_id, headline, subtext, cta_text?, bullet_points?, testimonial_quote? }
  PipelineRun { id, profile, theme, plan, blocks, copy, output_dir }
  ```
- **PATTERN**: Mirror style from `src/lib/theme/types.ts` (export interfaces, no classes)
- **IMPORTS**: None (pure types)
- **VALIDATE**: `npx tsc --noEmit pipeline/lib/types.ts`

### Task 2: CREATE `pipeline/lib/catalog-filter.ts`

- **IMPLEMENT**: Function `filterCatalog(sectionPurpose: string, alreadySelected: string[], pairingRules: PairingRules): BlockEntry[]`
  1. Read `pipeline/library/block-catalog.yaml`
  2. Filter blocks where `tags.section_purpose === sectionPurpose` AND `landing_page_relevant === true`
  3. Apply pairing rules: exclude blocks from categories in `never_after` for the previous section
  4. Exclude already-selected block names (differentiation)
  5. Return filtered list (max 50 candidates)
- **PATTERN**: MIRROR `scripts/tag-blocks.ts` for YAML loading pattern
- **IMPORTS**: `js-yaml`, `fs`
- **GOTCHA**: Catalog has 2,562 blocks — filter aggressively. Only pass landing-page-relevant blocks with matching `section_purpose` tag.
- **VALIDATE**: Write a quick test: filter for "hero" should return 100+ blocks, filter for "pricing" should return 30+

### Task 3: CREATE `pipeline/lib/block-installer.ts`

- **IMPLEMENT**: Function `installBlocks(blockNames: string[], projectDir: string): InstallResult[]`
  1. For each block in serial order:
     - Run `npx shadcn@latest add @shadcnblocks/{name} --yes --overwrite --silent`
     - Capture exit code and stderr
     - On success: record installed path
     - On failure: log error, try next block (don't abort pipeline)
  2. Return array of results with success/failure status
- **PROFILE**: shadcn-ui-cli-profile.md Section 3.2 — automation flags `--yes --overwrite --silent`
- **GOTCHA**: CLI profile G1 — `components.json` must exist. G3 — env var must be exported, not just in `.env`
- **GOTCHA**: CLI profile Section 4 — NEVER run concurrent `add` against same project directory
- **IMPORTS**: `child_process.execSync`
- **VALIDATE**: Install `hero125` (already exists in `src/components/`), verify file present

### Task 4: CREATE `pipeline/agents/strategist.ts`

- **IMPLEMENT**: Function `buildStrategistPrompt(profile: BusinessProfile, styleProfile: string): string`
  Constructs a prompt that tells the Claude Code Agent Tool to:
  1. Read the business profile (name, description, features, audience, industry, tone)
  2. Read the style profile (aesthetic preferences from moodboard)
  3. Determine section count (5-8) based on feature count:
     - 1-2 features → 5 sections (navbar, hero, features, CTA, footer)
     - 3-4 features → 6-7 sections (+ testimonials or stats or pricing)
     - 5+ features → 7-8 sections (+ logos, FAQ, or additional features section)
  4. For each section produce: id, purpose (from controlled vocabulary), title_hint, layout_preference, visual_requirement
  5. Output structured YAML to `pipeline/run-{id}/section-plan.yaml`
- **PATTERN**: Prompt includes the controlled vocabulary terms as allowed values
- **GOTCHA**: Prompt must tell agent to write YAML file, not just return text
- **VALIDATE**: Manual: run with sample-business-profile.yaml, check output is valid YAML

### Task 5: CREATE `pipeline/agents/block-selector.ts`

- **IMPLEMENT**: Function `buildBlockSelectorPrompt(sectionPlan: SectionPlan, filteredCatalog: BlockEntry[], pairingRules: string, runDir: string): string`
  Constructs a prompt that:
  1. Receives filtered block candidates per section (pre-filtered by Task 2)
  2. For each section, applies 4-layer selection (PRD 4.2):
     - Layer 1: Functional fit (section_purpose match) — already pre-filtered
     - Layer 2: Aesthetic fit (mood + density tags match style profile preferences)
     - Layer 3: Compositional fit (check pairing rules against adjacent selections)
     - Layer 4: Differentiation (prefer blocks not yet selected)
  3. Outputs `block-selections.yaml` with block_name, alternatives, customization_notes per section
- **PROFILE**: shadcnblocks-mcp-profile.md Section 3.3 — agent can use `search_items_in_registries` for real-time refinement if pre-filtered set is insufficient
- **GOTCHA**: Max ~50 candidates per section to fit context window
- **VALIDATE**: Check output YAML has one selection per section, no `never_after` violations

### Task 6: CREATE `pipeline/agents/copy-writer.ts`

- **IMPLEMENT**: Function `buildCopyWriterPrompt(sectionPlan: SectionPlan, profile: BusinessProfile, vocabulary: string, runDir: string): string`
  Constructs a prompt that:
  1. Receives section plan (purposes + title hints) and business profile
  2. For each section generates: headline, subtext (max 2 lines), CTA text (if applicable), bullet points (for features)
  3. Headlines follow `mixed-bold-italic` pattern: mark which words should be italic serif
  4. All terms must come from controlled vocabulary word pools or business-specific terms
  5. Tone matches `profile.tone` (professional/friendly/bold/minimal)
  6. Outputs `copy.yaml` to run directory
- **PATTERN**: Include vocabulary YAML inline in prompt as allowed terms
- **GOTCHA**: SC-005 — vocabulary violation. Prompt must explicitly list allowed headline verbs, adjective pools
- **VALIDATE**: Check output copy uses vocabulary terms, headlines are ≤ 10 words

### Task 7: CREATE `pipeline/agents/assembler.ts`

- **IMPLEMENT**: Function `buildAssemblerPrompt(selections: BlockSelection, copy: SectionCopy, theme: Theme, runDir: string, outputDir: string): string`
  Constructs a prompt that:
  1. For each section: read the installed block source (from `src/components/{block-name}.tsx`)
  2. Customize the block: replace placeholder text with copy from `copy.yaml`
  3. Apply theme tokens: ensure all colors use CSS variables, fonts use `--font-heading`/`--font-accent`/`--font-body`
  4. Apply `mixed-bold-italic` pattern to hero headline: wrap accent phrase in `<span>` with italic serif font
  5. Write each customized section to `output/components/{section-id}.tsx`
  6. Write `output/page.tsx` that imports and composes all sections in order
  7. Write `output/theme.css` from pre-generated CSS
- **PATTERN**: MIRROR `src/components/hero125.tsx` for component structure (functional component, cn() for classnames, Lucide icons)
- **GOTCHA**: CLI profile G8 — `--overwrite` replaces files entirely. Install blocks first, then read their source, then customize.
- **GOTCHA**: SC-009 — mixed-font headline requires JSX modification of the block's `<h1>` to split into `<span>` elements
- **VALIDATE**: `npx tsx scripts/theme-validator.ts output/components/{section}.tsx` — zero violations

### Task 8: CREATE `pipeline/orchestrator.ts`

- **IMPLEMENT**: Main pipeline function `runPipeline(profilePath: string): Promise<void>`
  1. **Validate input**: Read YAML, run through validation logic (mirror `scripts/validate-profile.ts`)
  2. **Generate run ID**: `run-${Date.now()}` or similar
  3. **Create run directory**: `pipeline/run-{id}/`
  4. **Derive theme**: Import `deriveTheme()` + `generateCSS()` from `src/lib/theme/`
     - Read `theme-template.yaml` as base
     - Apply business profile → concrete theme
     - Write `theme.yaml` + `theme.css` to run directory
  5. **Present for approval**: Output theme summary + proposed section count to terminal
     - Use `AskUserQuestion` or simple terminal prompt
     - On rejection: exit gracefully
  6. **Run Strategist**: Spawn agent with strategist prompt → wait → read `section-plan.yaml`
  7. **Pre-filter catalog**: For each section in plan, call `filterCatalog()`
  8. **Run Block Selector + Copy Writer in parallel**:
     - Spawn Block Selector agent with filtered catalog
     - Spawn Copy Writer agent with section plan + profile
     - Wait for both to complete
  9. **Install blocks**: Read `block-selections.yaml`, call `installBlocks()` serially
  10. **Run Assembler**: Spawn agent with all inputs → produces output files
  11. **Run Theme Validator**: Execute `npx tsx scripts/theme-validator.ts` on each output component
  12. **Report results**: Summary of what was built, any warnings
- **IMPORTS**: `deriveTheme`, `generateCSS` from `src/lib/theme/`, `js-yaml`, `child_process`, `fs`
- **GOTCHA**: Agent Tool spawns are async — use Promise.all() for parallel Block Selector + Copy Writer
- **VALIDATE**: Full pipeline run with `sample-business-profile.yaml`

### Task 9: CREATE `pipeline/templates/placeholder-svg.ts`

- **IMPLEMENT**: Functions that generate themed SVG placeholders:
  - `heroPlaceholder(theme: Theme): string` — simple illustration-style SVG with theme accent colors
  - `iconPlaceholder(theme: Theme, label: string): string` — small icon SVG with theme colors
  - `bentoPlaceholder(theme: Theme): string` — card-sized decorative SVG
- **PATTERN**: SVGs use `currentColor` or inline theme hex values
- **VALIDATE**: Output is valid SVG, renders in browser

### Task 10: UPDATE `src/app/globals.css`

- **IMPLEMENT**: Ensure the Siphio custom CSS variables section is preserved as the baseline
- **GOTCHA**: The theme.css generated per-run may need to be merged with or override `globals.css` variables. The Assembler's output `theme.css` should contain only the `:root` overrides, not the full Tailwind config.
- **VALIDATE**: `npm run build` succeeds

### Task 11: CREATE `output/.gitkeep`

- **IMPLEMENT**: Create `output/` and `output/components/` directories with `.gitkeep` files
- **VALIDATE**: Directories exist

### Task 12: UPDATE `package.json`

- **IMPLEMENT**: Add pipeline script:
  ```json
  "scripts": {
    "pipeline": "npx tsx pipeline/orchestrator.ts",
    "pipeline:validate": "npx tsx scripts/theme-validator.ts"
  }
  ```
- **VALIDATE**: `npm run pipeline -- --help` or similar doesn't crash

### Task 13: CREATE `pipeline/lib/yaml-helpers.ts`

- **IMPLEMENT**: Shared YAML read/write helpers:
  - `readYaml<T>(path: string): T` — read + parse with typed return
  - `writeYaml(path: string, data: unknown): void` — dump + write with consistent options
- **PATTERN**: MIRROR yaml usage in `scripts/build-catalog.ts` (lineWidth: 120, noRefs, quotingType: '"')
- **IMPORTS**: `js-yaml`, `fs`
- **VALIDATE**: Round-trip test: write then read sample data

### Task 14: End-to-End Integration Test

- **IMPLEMENT**: Run full pipeline with `pipeline/input/sample-business-profile.yaml`
  1. Verify pipeline creates run directory
  2. Verify theme.yaml and theme.css are generated
  3. Verify section-plan.yaml has 5-8 sections
  4. Verify block-selections.yaml has one block per section
  5. Verify copy.yaml has copy for each section
  6. Verify output/page.tsx exists and imports all sections
  7. Verify each output/components/*.tsx exists
  8. Verify `npx tsx scripts/theme-validator.ts` passes on all output files
  9. Verify `npm run build` succeeds with output page
- **VALIDATE**: All checks pass

---

## VALIDATION STRATEGY

### Tools to Validate

| Tool | Test Inputs | Expected Behavior | Mock Needed |
|------|-------------|-------------------|-------------|
| Strategist Agent | sample-business-profile.yaml | Produces 5-8 section plan | No |
| Block Selector Agent | Pre-filtered catalog (50 candidates) | Selects 1 block per section | No |
| Copy Writer Agent | Section plan + profile | Copy for each section | No |
| Assembler Agent | Blocks + copy + theme | output/*.tsx files | No |
| Theme Validator | output/components/*.tsx | Zero violations | No |
| shadcn CLI | `add @shadcnblocks/{name}` | Block installed in src/components/ | No (live) |

### PRD Scenario Validation

| Scenario | Test Plan | Pass Criteria |
|---|---|---|
| SC-001 Happy Path | Run pipeline with sample profile | Complete page, 6-8 sections, renders |
| SC-002 Brand Colors | Run with profile with `brand_colors` | Theme uses brand colors, WCAG passes |
| SC-003 Pairing Conflicts | Inspect block-selections.yaml | No `never_after` violations between adjacent |
| SC-005 Vocabulary | Inspect copy.yaml headlines | All terms from vocabulary or business-specific |
| SC-009 Mixed Fonts | Inspect hero component output | `<span>` with italic serif class present |
| SC-010 Bento Grid | Run with 5+ features | Features section uses bento-asymmetric block |

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
npx tsc --noEmit
npm run lint
```

**Expected**: Exit code 0

### Level 2: Unit Tests

```bash
# Catalog filter returns correct subset
npx tsx -e "
  import { filterCatalog } from './pipeline/lib/catalog-filter';
  const results = filterCatalog('hero', [], {});
  console.assert(results.length > 50, 'Expected 50+ hero blocks');
  console.log('✅ Catalog filter test passed');
"

# Theme derivation with brand colors
npx tsx -e "
  import { deriveTheme } from './src/lib/theme/derive-theme';
  import yaml from 'js-yaml';
  import { readFileSync } from 'fs';
  const template = yaml.load(readFileSync('src/lib/theme/theme-template.yaml','utf-8'));
  const profile = { name: 'Test', description: 'Test app', features: [{title:'F1',description:'D1'}], audience: 'devs', brand_colors: { primary: '#FF0000' }};
  const theme = deriveTheme(profile, template);
  console.assert(theme.palette.accent_primary !== '#22C55E', 'Brand color should override default');
  console.log('✅ Theme derivation test passed');
"

# Profile validation
npx tsx scripts/validate-profile.ts pipeline/input/sample-business-profile.yaml
```

**Expected**: All assertions pass, validator reports valid

### Level 3: Live Integration Tests

```bash
# T1-01: MCP server health check
# (Invoke via Claude Code MCP — get_project_registries should return @shadcnblocks)

# T1-02: Block catalog accessible (live MCP call)
# search_items_in_registries with query "hero" should return 10+ results

# T2-01: CLI block installation
npx shadcn@latest add button --yes --overwrite --silent
echo "Exit code: $?"

# T2-02: Premium block installation
npx shadcn@latest add @shadcnblocks/hero125 --yes --overwrite --silent
echo "Exit code: $?"
test -f src/components/hero125.tsx && echo "✅ Block installed" || echo "❌ Block missing"
```

**Expected**: All MCP calls return data, CLI installs succeed with exit 0

### Level 4: Live Integration Validation

```bash
# Full pipeline end-to-end
npx tsx pipeline/orchestrator.ts pipeline/input/sample-business-profile.yaml

# Verify output structure
test -f output/page.tsx && echo "✅ page.tsx exists" || echo "❌ Missing"
ls output/components/*.tsx | wc -l  # Should be 5-8 files

# Theme validation on all output files
for f in output/components/*.tsx; do
  npx tsx scripts/theme-validator.ts "$f"
done

# Build test
npm run build
```

**Expected**: Pipeline completes, 5-8 section files, zero theme violations, build succeeds

---

## ACCEPTANCE CRITERIA

- [ ] Pipeline runs end-to-end from `sample-business-profile.yaml` to output page
- [ ] Theme derivation uses brand colors when provided, WCAG AA enforced
- [ ] Section plan has 5-8 sections with valid controlled vocabulary terms
- [ ] Block Selector respects pairing rules (no `never_after` violations)
- [ ] Copy uses controlled vocabulary, headlines ≤ 10 words
- [ ] Hero headline applies mixed-bold-italic pattern
- [ ] Block Selector + Copy Writer execute in parallel
- [ ] All blocks installed via CLI with `--yes --overwrite --silent`
- [ ] Theme Validator reports zero violations on all output files
- [ ] Output page renders in browser (`npm run dev`)
- [ ] `npm run build` succeeds with zero errors
- [ ] All PRD Phase 2 scenarios (SC-001, SC-002, SC-003, SC-005, SC-009, SC-010) pass

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (1-14)
- [ ] Each task validation passed
- [ ] All validation commands (Level 1-4) executed
- [ ] Full test suite passes (unit + integration)
- [ ] No linting errors (`npm run lint`)
- [ ] No type errors (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] All acceptance criteria met

---

## NOTES

**Decision Log (from Phase 0 Scope Analysis):**

1. **Orchestration**: TypeScript entry point + Claude Code Agent Tool sub-agents. Agent Tool provides isolated context windows per agent — critical for context routing principle.

2. **Context delivery**: Pre-filter catalog to ~50 candidates per section. Full 2,562-block catalog would overflow agent context windows. Filter by `section_purpose` tag.

3. **Block installation**: Serial, pre-assembly. CLI doesn't support concurrent `add` (shared file writes). Install first, then customize — `--overwrite` does full replacement, not merge.

4. **Parallelism**: Block Selector + Copy Writer run simultaneously. Copy Writer needs section purposes and tone, not specific block names. Assembler waits for both.

5. **Approval flow**: One-time human checkpoint via terminal output + AskUserQuestion. Theme summary + section count presented. Only human touch in the pipeline.

6. **Section count**: Dynamic 5-8 based on feature count. SC-001 edge case: 1 feature → 5 sections minimum.

7. **Theme reuse**: Existing `deriveTheme()` + `generateCSS()` from Phase 1. No rebuilding.

8. **Output structure**: Component-per-section enables scoped re-runs in Phase 3 QA loop.

**PRD Gap — Agent timeout handling (SC-007):**
PRD defines a 5-minute timeout for parallel agents. The Claude Code Agent Tool does not expose a native timeout parameter. Assumption: we'll use `Promise.race()` with a timer if needed, but for MVP the agents should complete well within 5 minutes. If this proves wrong, Task 8 (orchestrator) needs a timeout wrapper.

## PIV-Automator-Hooks
plan_status: ready_for_execution
phase_source: Phase 2 from PRD
independent_tasks_count: 5
dependent_chains: 3
technologies_consumed: shadcnblocks-mcp, shadcn-ui-cli
next_suggested_command: execute
next_arg: ".agents/plans/phase-2-agent-pipeline-core-flow.md"
estimated_complexity: high
confidence: 7/10
