# Feature: Phase 4 — Polish & Hardening

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Production hardening of the Siphio multi-agent landing page pipeline. Test across 5+ diverse industries, harden edge cases, ensure all 10 PRD scenarios pass consistently, measure and document runtime, and create user-facing documentation. No new features — polish only.

## User Story

As a founder/marketer
I want the Siphio pipeline to reliably produce quality landing pages for any industry
So that I can trust it to handle my business without manual intervention

## Problem Statement

The pipeline works end-to-end for a single sample profile (CloudMetrics/fintech). It has not been exercised against diverse industries, edge case inputs, or sustained error conditions. Undiscovered failure modes may exist in section count logic, block selection with sparse catalogs, or QA convergence with real issues.

## Solution Statement

Create diverse test profiles, build an automated test runner, harden all documented error recovery paths, add performance instrumentation, and write comprehensive user documentation. Validate all 10 PRD scenarios pass consistently across all profiles.

## Feature Metadata

**Feature Type**: Enhancement (hardening, not new capability)
**Estimated Complexity**: Medium
**Primary Systems Affected**: `pipeline/orchestrator.ts`, `scripts/`, `pipeline/input/`, `README.md`
**Dependencies**: All existing pipeline agents, Gemini API, shadcn CLI
**Agent Behavior**: No — this phase tests agent behavior, does not implement new decision trees

---

## TECHNOLOGY PROFILES CONSUMED

**Profiles read from `.agents/reference/`:**

- `shadcnblocks-mcp-profile.md` — Used for: validating block install across diverse section plans
  - Key endpoints: `list_items_in_registries`, `search_items_in_registries`
  - Auth method: API key via `SHADCNBLOCKS_API_KEY`
  - Critical constraints: Premium subscription required

- `nano-banana-2-gemini-api-profile.md` — Used for: verifying asset generation retry/fallback paths
  - Key endpoints: `generateContent` with `IMAGE` modality
  - Auth method: API key via `GOOGLE_GEMINI_API_KEY`
  - Critical constraints: Rate limits (15 RPM), 60s cooldown on 429

- `shadcn-ui-cli-profile.md` — Used for: block install failure handling
  - Key endpoints: `npx shadcn@latest add @shadcnblocks/{name} --yes --overwrite --silent`
  - Auth method: Inherits from env
  - Critical constraints: Serial install only (shared project files)

- `framer-motion-profile.md` — Used for: verifying animation wrappers render correctly in built output
  - Key endpoints: `motion` component APIs
  - Critical constraints: SSR-compatible usage required

**Impact on Implementation:**
No new API integrations. Testing exercises existing integration paths and validates error/retry handling under edge conditions.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `pipeline/orchestrator.ts` (full file) — Main pipeline entry. Test runner calls `runPipeline()`. Hardening targets: error paths, timing, reporting
- `pipeline/input/sample-business-profile.yaml` — Existing sample profile. MIRROR this format for new test profiles
- `pipeline/input/business-profile.schema.yaml` — Schema constraints: features 1-8, industry enum, tone enum, brand_colors pattern
- `pipeline/lib/types.ts` — All pipeline state interfaces. Import from here
- `pipeline/lib/catalog-filter.ts` — filterCatalog returns 0 candidates for missing categories → SC-008
- `pipeline/lib/block-installer.ts` — installSingleBlock catches errors → test alternative fallback
- `pipeline/lib/gemini-client.ts` — generateAssetWithRetry has full retry logic → verify under test
- `pipeline/agents/strategist.ts` — determineSectionCount branching: ≤2 → 5, ≤4 → 6-7, ≥5 → 7-8
- `scripts/theme-validator.ts` — Single-file validator. Needs batch mode for test runner
- `src/lib/theme/derive-theme.ts` — deriveTheme + WCAG enforcement. INDUSTRY_ACCENTS map covers: fintech, education, health, saas, devtools, agency, ecommerce, ai, crypto, general
- `src/lib/theme/types.ts` — BusinessProfile, Theme interfaces
- `pipeline/lib/qa-types.ts` — QAConvergenceState, QAIssue types
- `pipeline/lib/asset-types.ts` — ASSET_CATEGORIES config for each asset type

### New Files to Create

- `pipeline/input/profiles/saas-startup.yaml` — SaaS test profile (3 features)
- `pipeline/input/profiles/agency-creative.yaml` — Agency test profile (4 features)
- `pipeline/input/profiles/ecommerce-shop.yaml` — Ecommerce test profile (5 features)
- `pipeline/input/profiles/education-platform.yaml` — Education test profile (3 features)
- `pipeline/input/profiles/edge-minimal.yaml` — Edge: 1 feature, no industry, no brand colors, no tone
- `pipeline/input/profiles/edge-maximal.yaml` — Edge: 8 features, brand colors, every optional field
- `scripts/pipeline-test-runner.ts` — Automated multi-profile test runner
- `README.md` — User-facing documentation

### Patterns to Follow

**Test profile format:** MIRROR `pipeline/input/sample-business-profile.yaml` exactly.

**Script pattern:** MIRROR `scripts/theme-validator.ts` for CLI entry point pattern — process.argv, error handling, exit codes.

**Naming:** kebab-case for YAML files, camelCase for TS functions, PascalCase for interfaces/types.

**Error handling:** Use try/catch with typed errors. Log with emoji status prefixes (✅ ❌ 🟡 ⚠️) per CLAUDE.md terminal output standards.

---

## IMPLEMENTATION PLAN

### Phase 1: Test Profile Creation

Create 6 diverse test profiles covering all industry verticals, tones, and feature count ranges. Each profile must be valid against `business-profile.schema.yaml`.

### Phase 2: Automated Test Runner

Build `scripts/pipeline-test-runner.ts` that:
- Discovers all `.yaml` profiles in `pipeline/input/profiles/`
- Runs `runPipeline()` for each
- Collects results: pass/fail, section count, block install success rate, theme violations, QA convergence status
- Measures per-profile and total runtime
- Outputs aggregate report

### Phase 3: Error Recovery Hardening

Harden the orchestrator for all PRD Section 4.4 error paths:
- SC-007: Agent timeout handling
- SC-008: Missing block category → Strategist fallback
- SC-006: QA flip-flop detection → lock stable sections
- Block install failure → try alternatives from BlockChoice.alternatives

### Phase 4: Performance Instrumentation

Add timing to each pipeline step in orchestrator. Report per-step and total duration.

### Phase 5: Theme Validator Batch Mode

Extend `scripts/theme-validator.ts` to accept glob patterns and output aggregate results.

### Phase 6: User Documentation

Create `README.md` with setup, usage, customization, troubleshooting.

---

## VALIDATION STRATEGY

### PRD Scenario Validation

| Scenario | Test Plan | Pass Criteria |
|---|---|---|
| SC-001: Happy path | Run pipeline against each of 5 industry profiles | Complete page with 5-8 sections, no errors |
| SC-002: Brand colors | Test fintech (has brand_colors) + edge-minimal (no brand_colors) | Theme uses brand colors when present; industry fallback otherwise |
| SC-003: Pairing conflicts | Run with 7-section profile, inspect block-selections.yaml | No never_after violations in adjacent sections |
| SC-004: Asset failure | Run with invalid/missing GOOGLE_GEMINI_API_KEY | Fallback SVGs used, pipeline completes |
| SC-005: Copy vocabulary | Inspect copy.yaml from each run | Headlines use controlled vocabulary terms |
| SC-006: QA convergence | Trigger by creating a qa-result that fails then improves | QA loop converges or ships with issue report |
| SC-007: Agent timeout | Pipeline completes even with slow/missing agent responses | No hangs, graceful handling |
| SC-008: Missing category | Profile requests a section purpose with 0 catalog matches | Orchestrator handles gracefully |
| SC-009: Mixed-font headline | Inspect output components for accent phrase wrapping | `<span>` with accent font present on sections with accent phrases |
| SC-010: Bento grid | Profile with 5+ features → bento-asymmetric layout | Block selector picks bento-appropriate blocks |

### Validation Acceptance Criteria

- [ ] Pipeline completes for all 7 test profiles without crashes
- [ ] `npx tsc --noEmit` passes for all output files
- [ ] Theme validator reports 0 violations per profile run
- [ ] QA convergence state shows `converged: true` for standard profiles
- [ ] Runtime metrics logged for every profile
- [ ] All 10 PRD scenarios exercised across the test suite
- [ ] README renders correctly and covers setup → first run flow

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: CREATE `pipeline/input/profiles/` directory

- **IMPLEMENT**: Create the profiles subdirectory for test business profiles
- **VALIDATE**: `ls pipeline/input/profiles/`

### Task 2: CREATE `pipeline/input/profiles/saas-startup.yaml`

- **IMPLEMENT**: SaaS test profile — 3 features, tone "friendly", industry "saas"
  ```yaml
  name: "FlowBoard"
  description: "Collaborative project management for remote-first teams"
  features:
    - title: "Real-time Boards"
      description: "Drag-and-drop task boards that sync instantly across all devices"
    - title: "Smart Workflows"
      description: "Automate repetitive processes with customizable workflow triggers"
    - title: "Team Insights"
      description: "Track productivity trends with visual analytics dashboards"
  audience: "Remote team leads and product managers"
  industry: "saas"
  tone: "friendly"
  ```
- **PATTERN**: MIRROR `pipeline/input/sample-business-profile.yaml` structure exactly
- **VALIDATE**: Confirm YAML parses without error

### Task 3: CREATE `pipeline/input/profiles/agency-creative.yaml`

- **IMPLEMENT**: Agency test profile — 4 features, tone "bold", industry "agency", brand_colors
  ```yaml
  name: "PixelForge"
  description: "Award-winning digital design agency crafting bold brand experiences"
  features:
    - title: "Brand Identity"
      description: "Complete visual identity systems from logo to guidelines"
    - title: "Web Design"
      description: "Conversion-optimized websites that tell your brand story"
    - title: "Motion Graphics"
      description: "Eye-catching animations for social media and product launches"
    - title: "UX Strategy"
      description: "Research-driven design decisions backed by user data"
  audience: "Startups and mid-market companies launching or rebranding"
  industry: "agency"
  tone: "bold"
  brand_colors:
    primary: "#F59E0B"
    secondary: "#7C3AED"
  ```
- **VALIDATE**: Confirm YAML parses; brand_colors match hex pattern `^#[0-9A-Fa-f]{6}$`

### Task 4: CREATE `pipeline/input/profiles/ecommerce-shop.yaml`

- **IMPLEMENT**: Ecommerce profile — 5 features, tone "professional", industry "ecommerce"
  ```yaml
  name: "CrateJoy"
  description: "Curated subscription boxes for lifestyle and wellness enthusiasts"
  features:
    - title: "Curated Collections"
      description: "Hand-picked products from artisan makers worldwide"
    - title: "Flexible Plans"
      description: "Monthly, quarterly, or gift subscriptions that suit your pace"
    - title: "Surprise Themes"
      description: "Each box follows a unique seasonal theme for discovery"
    - title: "Easy Gifting"
      description: "Send a box to anyone with a personalized note"
    - title: "Member Perks"
      description: "Exclusive discounts and early access to limited editions"
  audience: "Women 25-45 interested in lifestyle and wellness products"
  industry: "ecommerce"
  tone: "professional"
  brand_colors:
    primary: "#EC4899"
  ```
- **VALIDATE**: Confirm 5 features trigger 7-8 section logic in strategist

### Task 5: CREATE `pipeline/input/profiles/education-platform.yaml`

- **IMPLEMENT**: Education profile — 3 features, tone "minimal", industry "education"
  ```yaml
  name: "LearnPath"
  description: "Adaptive learning platform that personalizes education for every student"
  features:
    - title: "Adaptive Lessons"
      description: "AI adjusts difficulty based on student performance in real time"
    - title: "Progress Tracking"
      description: "Visual dashboards for students, parents, and teachers"
    - title: "Peer Collaboration"
      description: "Study groups and shared notes within a safe environment"
  audience: "K-12 students, parents, and educators"
  industry: "education"
  tone: "minimal"
  ```
- **VALIDATE**: Confirm YAML parses; tone "minimal" is valid per schema

### Task 6: CREATE `pipeline/input/profiles/edge-minimal.yaml`

- **IMPLEMENT**: Minimal edge case — 1 feature, no optional fields
  ```yaml
  name: "OneThingApp"
  description: "The simplest task manager that does exactly one thing well"
  features:
    - title: "Focus Mode"
      description: "One task at a time, zero distractions, pure productivity"
  audience: "Minimalist productivity enthusiasts"
  ```
- **GOTCHA**: No industry, no brand_colors, no tone. Pipeline must use defaults. `determineSectionCount(1)` → exactly 5 sections
- **VALIDATE**: Confirm profile passes `validateProfile()` in orchestrator

### Task 7: CREATE `pipeline/input/profiles/edge-maximal.yaml`

- **IMPLEMENT**: Maximal edge case — 8 features, all optional fields, brand_colors with secondary
  ```yaml
  name: "OmniSuite Enterprise"
  description: "All-in-one business platform combining CRM, HR, finance, analytics, communication, and project management for growing enterprises"
  features:
    - title: "Smart CRM"
      description: "AI-powered customer relationship management with predictive scoring"
    - title: "HR Hub"
      description: "Recruitment, onboarding, and performance reviews in one place"
    - title: "Financial Suite"
      description: "Invoicing, expenses, and real-time financial reporting"
    - title: "Analytics Engine"
      description: "Cross-platform business intelligence with custom dashboards"
    - title: "Team Chat"
      description: "Instant messaging with channels, threads, and video calls"
    - title: "Project Boards"
      description: "Kanban, Gantt, and timeline views for every work style"
    - title: "Document Vault"
      description: "Secure document storage with version control and e-signatures"
    - title: "API Gateway"
      description: "Connect any third-party tool with pre-built integrations"
  audience: "Enterprise operations teams and C-suite executives at companies with 50-500 employees"
  industry: "saas"
  tone: "professional"
  brand_colors:
    primary: "#1E40AF"
    secondary: "#059669"
  ```
- **GOTCHA**: 8 features → `determineSectionCount(8)` returns min 7, max 8. Strategist may produce 2 feature sections. Block catalog must have enough candidates for 8+ sections.
- **VALIDATE**: Confirm YAML parses; features array has exactly 8 entries

### Task 8: CREATE `scripts/pipeline-test-runner.ts`

- **IMPLEMENT**: Automated test runner that:
  1. Discovers all `.yaml` files in `pipeline/input/profiles/`
  2. Also includes the existing `pipeline/input/sample-business-profile.yaml`
  3. For each profile:
     a. Creates an isolated run using `runPipeline(profilePath)`
     b. Wraps in try/catch to capture failures
     c. Records: profile name, section count, block install results, theme violations, QA status, runtime (ms)
  4. Outputs aggregate report table
  5. Exits with code 1 if any profile failed, 0 if all pass
- **PATTERN**: MIRROR `scripts/theme-validator.ts` for CLI structure
- **IMPORTS**: Import `runPipeline` from `../pipeline/orchestrator`; import `readdirSync` from `fs`; import `resolve` from `path`; import `performance` from `perf_hooks`
- **GOTCHA**: `runPipeline` currently calls `process.exit(1)` on validation failure. Refactor to throw instead of exit so the test runner can catch errors (see Task 9).
- **VALIDATE**: `npx tsx scripts/pipeline-test-runner.ts` — should discover 7 profiles

### Task 9: UPDATE `pipeline/orchestrator.ts` — Refactor error handling for testability

- **IMPLEMENT**: Change `process.exit(1)` in `validateProfile` error path to `throw new Error(...)` so callers can catch failures. The CLI entry point at the bottom of the file should wrap `runPipeline` in try/catch and call `process.exit` there.
- **PATTERN**: Current pattern at line 108-112 (process.exit on validation failure). Refactor:
  ```typescript
  // In runPipeline(): throw instead of exit
  if (errors.length > 0) {
    const msg = errors.map(e => `${e.field}: ${e.message}`).join(", ");
    throw new Error(`Profile validation failed: ${msg}`);
  }
  ```
  ```typescript
  // In CLI entry point (bottom of file): catch and exit
  runPipeline(profileArg).catch((err) => {
    console.error("\n❌ Pipeline failed:", err.message);
    process.exit(1);
  });
  ```
- **GOTCHA**: The CLI entry point already has `.catch()` at line 747-749 — just ensure the validation path throws cleanly
- **VALIDATE**: `npx tsx pipeline/orchestrator.ts pipeline/input/sample-business-profile.yaml` still works

### Task 10: UPDATE `pipeline/orchestrator.ts` — Add performance timing

- **IMPLEMENT**: Add timing instrumentation to `runPipeline`:
  1. Record `performance.now()` at start and after each major step
  2. Store timing in a `Map<string, number>` (step name → duration ms)
  3. Add timing output to the final report section
- **IMPORTS**: `import { performance } from "perf_hooks";`
- **PATTERN**: Add timing around existing steps without changing logic:
  ```typescript
  const timings = new Map<string, number>();
  const pipelineStart = performance.now();
  // ... after each step:
  timings.set("theme_derivation", performance.now() - stepStart);
  ```
- **GOTCHA**: Do not wrap async operations that are currently sync — `runPipeline` is async but most internal calls are sync. Only the future agent-mode calls would be truly async.
- **VALIDATE**: Run pipeline, confirm timing appears in output report

### Task 11: UPDATE `pipeline/orchestrator.ts` — Block install alternative fallback

- **IMPLEMENT**: When `installSingleBlock` fails for a block, try alternatives from `BlockChoice.alternatives` before recording failure:
  1. After step 8 (block install), check for failed installs
  2. For each failed block, look up its `alternatives` from `blockSelections`
  3. Try each alternative in order until one succeeds or all fail
  4. Log which alternative was used (if any)
- **PATTERN**: Add after the existing install loop at lines 286-300:
  ```typescript
  // Retry failed blocks with alternatives
  for (let i = 0; i < installResults.length; i++) {
    if (!installResults[i].success) {
      const selection = blockSelections.sections.find(
        s => s.block_name === installResults[i].block_name
      );
      if (selection?.alternatives?.length) {
        for (const alt of selection.alternatives) {
          const altResult = installSingleBlock(alt, PROJECT_ROOT);
          if (altResult.success) {
            installResults[i] = altResult;
            console.log(`  🔄 ${selection.block_name} → fallback ${alt} succeeded`);
            break;
          }
        }
      }
    }
  }
  ```
- **GOTCHA**: `installSingleBlock` is not currently exported. It needs to be exported, or the fallback logic must go inside `installBlocks`. Prefer adding logic inside `pipeline/lib/block-installer.ts` to keep encapsulation.
- **VALIDATE**: Intentionally request a nonexistent block name to confirm fallback is attempted

### Task 12: UPDATE `pipeline/lib/block-installer.ts` — Add alternative fallback support

- **IMPLEMENT**: Modify `installBlocks` to accept a map of alternatives and try them on failure:
  ```typescript
  export function installBlocks(
    blockNames: string[],
    projectDir: string,
    alternatives?: Map<string, string[]>,
  ): InstallResult[] {
    const results: InstallResult[] = [];
    for (const name of blockNames) {
      let result = installSingleBlock(name, projectDir);
      if (!result.success && alternatives?.has(name)) {
        for (const alt of alternatives.get(name)!) {
          const altResult = installSingleBlock(alt, projectDir);
          if (altResult.success) {
            result = { ...altResult, block_name: name }; // preserve original name for tracking
            console.log(`  🔄 ${name} → fallback to ${alt}`);
            break;
          }
        }
      }
      results.push(result);
    }
    return results;
  }
  ```
- **GOTCHA**: Keep backward compatibility — `alternatives` is optional with `?`
- **VALIDATE**: `npx tsc --noEmit` — no type errors

### Task 13: UPDATE `pipeline/orchestrator.ts` — Pass alternatives to installBlocks

- **IMPLEMENT**: Build alternatives map from `blockSelections.sections` and pass to `installBlocks`:
  ```typescript
  const alternativesMap = new Map<string, string[]>();
  for (const s of blockSelections.sections) {
    if (s.alternatives.length > 0) {
      alternativesMap.set(s.block_name, s.alternatives);
    }
  }
  const installResults = installBlocks(blockNames, PROJECT_ROOT, alternativesMap);
  ```
- **PATTERN**: Replace existing `installBlocks(blockNames, PROJECT_ROOT)` call at line 287
- **VALIDATE**: Pipeline still runs correctly with sample profile

### Task 14: UPDATE `pipeline/orchestrator.ts` — SC-008 missing category handling

- **IMPLEMENT**: After catalog filtering (step 6), check for sections with 0 candidates. If found, log a warning and use a generic fallback approach:
  ```typescript
  for (const section of sectionPlan.sections) {
    const candidates = filterCatalog(...);
    if (candidates.length === 0) {
      console.log(`  ⚠️ ${section.id} (${section.purpose}): 0 candidates — will use generic fallback`);
    }
    filteredCatalogs.set(section.id, candidates);
  }
  ```
- **GOTCHA**: The `generateDefaultBlockSelections` already handles 0 candidates (line 598-605) with a generic fallback name. This task adds explicit logging.
- **VALIDATE**: Orchestrator logs warning for any 0-candidate section

### Task 15: UPDATE `pipeline/orchestrator.ts` — SC-006 QA flip-flop detection

- **IMPLEMENT**: In the QA loop, detect if issues are oscillating (same issues reappearing after fix). Add section-locking logic:
  ```typescript
  // After detecting increasing issues (line 423-424):
  if (previousIssues && issueCount > prevCount) {
    console.log(`  ⚠️ Issues INCREASING — locking stable sections`);
    // Identify sections that had no issues in BOTH iterations
    const prevSectionIds = new Set(previousIssues.map(i => i.sectionId));
    const currSectionIds = new Set(qaResult.issues.map(i => i.sectionId));
    const stableSections = sectionPlan.sections
      .filter(s => !prevSectionIds.has(s.id) && !currSectionIds.has(s.id))
      .map(s => s.id);
    console.log(`  🔒 Locked sections: ${stableSections.join(", ") || "none"}`);
  }
  ```
- **GOTCHA**: This is informational for CLI mode — actual section locking requires agent re-invocation which only happens in Claude Code mode. The logging enables debugging.
- **VALIDATE**: QA loop output includes flip-flop detection messaging when issues increase

### Task 16: UPDATE `scripts/theme-validator.ts` — Batch mode with glob support

- **IMPLEMENT**: Allow passing multiple file paths or a glob pattern:
  1. If argv[2] contains `*`, use `globSync` from Node to expand
  2. Validate all matched files
  3. Output per-file results + aggregate summary
  4. Exit 0 only if ALL files pass
- **IMPORTS**: Use `import { globSync } from "fs";` (Node 22+) or `import { sync as globSync } from "glob"` — check which is available. Node built-in `fs.globSync` available in Node 22+. Since project uses Node 20+, use a simple `readdirSync` + filter approach instead:
  ```typescript
  import { readdirSync } from "fs";
  import { resolve, join } from "path";
  ```
- **PATTERN**: If arg ends with `*.tsx`, treat as directory + extension filter. Otherwise treat as single file.
- **VALIDATE**: `npx tsx scripts/theme-validator.ts output/components/*.tsx` — validates all components

### Task 17: CREATE `README.md`

- **IMPLEMENT**: Comprehensive user documentation with these sections:
  1. **Siphio — Multi-Agent Landing Page Builder** (title + 2-sentence description)
  2. **Prerequisites** — Node 20+, shadcnblocks premium subscription, Gemini API key
  3. **Setup** — Clone, npm install, create `.env` with `SHADCNBLOCKS_API_KEY` and `GOOGLE_GEMINI_API_KEY`
  4. **Quick Start** — Create business profile YAML, run `npm run pipeline -- <path>`
  5. **Business Profile Format** — Table of fields, required/optional, examples
  6. **Pipeline Flow** — Numbered steps matching orchestrator (validate → theme → strategist → parallel agents → assembler → QA)
  7. **Output Structure** — What's in `output/` directory
  8. **Customization** — How to modify style profile, controlled vocabulary, pairing rules
  9. **Testing** — How to run test suite: `npx tsx scripts/pipeline-test-runner.ts`
  10. **Troubleshooting** — Common errors: missing API keys, block install failures, QA non-convergence
- **GOTCHA**: Do NOT include `ANTHROPIC_API_KEY` anywhere (CLAUDE.md rule). Only document `SHADCNBLOCKS_API_KEY` and `GOOGLE_GEMINI_API_KEY`.
- **VALIDATE**: README renders as valid markdown

### Task 18: UPDATE `pipeline/orchestrator.ts` — Add summary timing to final report

- **IMPLEMENT**: After all steps complete, add a timing breakdown section to the console output:
  ```
  ## Timing Breakdown
    Theme derivation:  150ms
    Catalog filtering: 45ms
    Block install:     12400ms
    Asset generation:  N/A (agent mode)
    QA loop:           200ms
    Total runtime:     12850ms
  ```
- **PATTERN**: Extend the existing final report section (lines 446-477) with timing data from Task 10
- **VALIDATE**: Timing report appears at end of pipeline run

### Task 19: Run full test suite — All profiles

- **IMPLEMENT**: Execute the test runner against all 7 profiles:
  ```bash
  npx tsx scripts/pipeline-test-runner.ts
  ```
- **VALIDATE**: All 7 profiles complete. Report shows:
  - Profile name, section count, install success rate, QA status, runtime
  - No crashes or unhandled exceptions
  - Exit code 0

### Task 20: Run TypeScript compilation check

- **VALIDATE**: `npx tsc --noEmit` — zero errors across all project files

### Task 21: Run Next.js build

- **VALIDATE**: `npm run build` — build succeeds with no errors

### Task 22: Run lint

- **VALIDATE**: `npm run lint` — no lint errors

---

## TESTING STRATEGY

### Unit Tests

No new test files needed — Phase 4 is integration/E2E focused. The test runner IS the test infrastructure.

Existing validation points:
- `validateProfile()` in orchestrator — already tested via pipeline runs
- `filterCatalog()` — tested implicitly when running diverse profiles
- `deriveTheme()` — tested with brand_colors, industry fallback, and default paths
- Theme validator script — run against all output files

### Integration Tests

The pipeline test runner (`scripts/pipeline-test-runner.ts`) serves as the integration test:
- Runs full pipeline end-to-end for each profile
- Validates output file existence
- Checks theme compliance
- Reports QA convergence status

### Edge Cases

Covered by the 2 edge case profiles:
- **edge-minimal**: 1 feature, no optional fields → 5 sections, default theme, default tone
- **edge-maximal**: 8 features, all fields → 7-8 sections, brand colors applied, potential catalog exhaustion

Additional edge cases tested implicitly:
- Industry with no conventional accent (not in INDUSTRY_ACCENTS map) → template defaults stay
- Brand colors that fail WCAG AA → auto-adjusted by `enforceContrast()`
- 0 block candidates for a category → generic fallback in `generateDefaultBlockSelections`

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
npx tsc --noEmit
npm run lint
```

**Expected**: Both pass with exit code 0

### Level 2: Unit Tests

```bash
npx tsx scripts/theme-validator.ts output/theme.css
```

**Expected**: Zero theme violations in generated CSS

### Level 3: Live Integration Tests

```bash
# Run pipeline against existing sample profile
npx tsx pipeline/orchestrator.ts pipeline/input/sample-business-profile.yaml

# Run pipeline against edge-minimal profile
npx tsx pipeline/orchestrator.ts pipeline/input/profiles/edge-minimal.yaml

# Run pipeline against edge-maximal profile
npx tsx pipeline/orchestrator.ts pipeline/input/profiles/edge-maximal.yaml
```

**Expected**: All three complete without errors. Timing report visible. Edge-minimal produces 5 sections. Edge-maximal produces 7-8 sections.

### Level 4: Live Integration Validation

```bash
# Full test suite across all 7 profiles
npx tsx scripts/pipeline-test-runner.ts

# Build verification
npm run build
```

**Expected**: Test runner reports all 7 profiles pass. Build succeeds. Average runtime documented.

---

## ACCEPTANCE CRITERIA

- [ ] 7 test profiles created: 5 industry verticals + 2 edge cases
- [ ] Pipeline completes for all 7 profiles without crashes
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Theme validator reports 0 violations for all profile outputs
- [ ] QA convergence state shows `converged: true` for standard profiles
- [ ] Block install alternative fallback works when primary block fails
- [ ] SC-008 missing category logged with warning, pipeline continues
- [ ] SC-006 flip-flop detection logs stable section identification
- [ ] Timing breakdown visible in pipeline output
- [ ] Test runner produces aggregate report table
- [ ] README covers setup, usage, customization, troubleshooting
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] All 10 PRD scenarios exercised across test suite

---

## COMPLETION CHECKLIST

- [ ] All 22 tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully
- [ ] Full test suite passes (7/7 profiles)
- [ ] No linting errors (`npm run lint`)
- [ ] No type checking errors (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] README.md exists and renders correctly
- [ ] Performance timing documented in pipeline output

---

## NOTES

**Scope Analysis Decisions (Phase 0):**

1. **7 profiles instead of 5**: PRD requires "5+ diverse profiles." Added 2 edge cases (minimal, maximal) to thoroughly exercise the section-count branching logic and schema boundary conditions.

2. **Test runner over manual testing**: Repeatable automated testing is essential for regression protection. The runner becomes infrastructure for future phases.

3. **Error recovery is logging-only in CLI mode**: The orchestrator runs in CLI testing mode with default generators. Full agent-to-agent error routing (QA → Block Selector for re-pick) only works in Claude Code agent mode. Hardening adds detection + logging that enables debugging in either mode.

4. **No new dependencies**: All hardening uses existing Node APIs. Test runner uses `perf_hooks` (built-in). No external test framework needed — the pipeline IS the test.

5. **README omits ANTHROPIC_API_KEY**: Per CLAUDE.md rule — `ANTHROPIC_API_KEY` must NEVER appear anywhere. Only `SHADCNBLOCKS_API_KEY` and `GOOGLE_GEMINI_API_KEY` documented.

6. **PRD Gap — SC-007 agent timeout**: The PRD describes parallel agent timeout handling, but agents currently run via prompt file generation (CLI mode), not actual Claude Code Agent Tool spawning. Timeout handling is deferred to when the pipeline runs in full agent mode. This is documented as a limitation in the README. Assumed this is acceptable for MVP scope.

## PIV-Automator-Hooks
plan_status: ready_for_execution
phase_source: Phase 4 from PRD
independent_tasks_count: 7
dependent_chains: 3
technologies_consumed: shadcnblocks-mcp,shadcn-ui-cli,nano-banana-2-gemini-api,framer-motion
next_suggested_command: execute
next_arg: ".agents/plans/phase-4-polish-and-hardening.md"
estimated_complexity: medium
confidence: 8/10
