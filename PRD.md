# PRD: Siphio — Multi-Agent Landing Page Builder

```
Status Legend: ⚪ Not Started | 🟡 In Progress | 🟢 Complete | 🔴 Blocked
```

---

## 1. Executive Summary

Siphio is a multi-agent system that autonomously builds modern, polished landing pages using pre-built shadcnblocks.com components. The user provides a business profile (company name, features, audience, tone), approves a theme and section plan in ~2 minutes, then walks away. The agents handle everything else — selecting the right block combinations, writing conversion-focused copy, generating on-brand illustrations and icons via Nano Banana 2, assembling the final page, and self-validating through an internal QA loop — all without further human involvement.

The core problem it solves: building a high-quality landing page today requires either expensive design agencies, hours of manual vibe-coding, or generic templates that look like everyone else. Siphio produces agency-quality landing pages by combining a curated component library (1,300+ premium shadcn blocks), AI-generated brand-consistent assets, and structured design reasoning drawn from a curated moodboard of modern SaaS aesthetics.

The previous attempt at this system failed because it tried to use vision-based component analysis, resulting in context bloat and unreliable block selection. This version uses text-based structured descriptions with controlled vocabulary — compact, precise, and reliable.

**MVP Goal:** Given a business profile, autonomously produce a deployable Next.js landing page with 5-8 sections, brand-consistent copy, AI-generated illustrations/icons, and a cohesive theme — passing internal QA validation without human intervention.

**Agent Classification:** Semi-autonomous (human approves theme + plan upfront, then fully autonomous execution).

---

## 2. Agent Identity

**Purpose:** Orchestrate a team of specialized sub-agents to transform a business profile into a production-ready landing page that matches a curated design aesthetic.

**Personality & Tone:** The orchestrator communicates with the user in concise, confident language. It presents the theme and section plan for approval without over-explaining. During autonomous execution, it is silent. On completion, it delivers results with a brief summary of what was built.

**Decision Philosophy:**
- Design consistency over individual section perfection — a cohesive 7/10 page beats a page with one 10/10 section and three 5/10 sections
- Controlled vocabulary over free-form reasoning — agents use precise taxonomy, not prose
- File-based state over context stuffing — each agent reads/writes files, never holds the full picture
- Scoped re-runs over full restarts — fix only what's broken in the QA loop

**Autonomy Level:**
- *Requires human approval:* Theme palette + section plan (one-time, upfront)
- *Fully autonomous:* Block selection, copy writing, asset generation, assembly, QA iteration, error recovery
- *Escalates to human:* Only if QA fails to converge after 3 iterations (rare)

**Core Competencies:**
1. Context routing — delivering minimal, purpose-built context slices to each sub-agent
2. Design reasoning — selecting and combining blocks using structured pairing rules
3. Theme enforcement — maintaining color, typography, and spacing consistency across all outputs
4. Autonomous iteration — self-correcting through agent-to-agent QA feedback loops
5. Parallel execution — running independent agents simultaneously for performance

---

## 3. Technology Decisions

#### Shadcnblocks.com (Premium Tier)

**What:** Library of 1,300+ pre-built, production-ready UI blocks for Next.js/shadcn-ui.
**Why chosen:** Blocks are well-structured, customizable, and designed for marketing/landing pages. Premium tier provides the full catalog. Eliminates the need to build components from scratch.
**Agent needs:** Block enumeration, metadata retrieval, code installation.
- CLI install: `npx shadcn add @shadcnblocks/{block-name}`
- MCP Server: 7 tools for search, listing, and viewing blocks
- CDN screenshots: `https://deifkwefumgah.cloudfront.net/shadcnblocks/screenshots/block/{name}-4x3.webp`
**Integration:** Shadcn MCP server configured in `.mcp.json` + CLI for code installation.
**Constraints:** Premium subscription required. MCP server must be configured per-project.

#### Nano Banana 2 (via Gemini API)

**What:** Google's image generation model for creating illustrations, icons, and background graphics.
**Why chosen:** Supports up to 14 reference images per request for style consistency. Produces high-quality illustrations matching the friendly-modern-SaaS aesthetic from the moodboard.
**Agent needs:** Image generation with style-consistent outputs.
- Cascading prompt architecture: base theme prompt + category suffix + specific prompt
- Reference image passing: 2-3 moodboard images for aesthetic anchoring
- Output formats: PNG for illustrations, SVG-compatible for icons
**Integration:** Gemini API (REST).
**Constraints:** API rate limits, generation latency (~10-30s per image), occasional style drift requiring regeneration.

#### Claude Code Agent Tool

**What:** Sub-agent spawning mechanism within Claude Code CLI.
**Why chosen:** Native to the development environment. Enables parallel agent execution, isolated context windows, and file-based state passing without external orchestration frameworks.
**Agent needs:** Spawn 6 specialized sub-agents with tailored prompts and context.
**Integration:** Built-in Agent tool with `subagent_type: "general-purpose"`.
**Constraints:** Context window limits per agent. No persistent memory between agent invocations.

#### Next.js + shadcn/ui + Tailwind CSS

**What:** The output technology stack for generated landing pages.
**Why chosen:** shadcnblocks are built for this stack. Industry standard for modern web apps. Tailwind enables theme token application via CSS variables and utility classes.
**Agent needs:** Valid `.tsx` page output, proper imports, CSS variable injection for theming.
**Integration:** Output target — agents generate code for this stack.
**Constraints:** Must be compatible with the user's existing Next.js project structure.

---

## 4. Agent Behavior Specification

### 4.1 Tool Orchestration

| Agent | Purpose | Trigger | Fallback |
|-------|---------|---------|----------|
| Strategist | Plan section flow from business profile + style profile | Pipeline start | N/A (required) |
| Block Selector | Pick optimal blocks per section from filtered library | After Strategist | Fall back to top-rated block per category |
| Copy Writer | Generate section copy matching brand voice | After Strategist (parallel) | Use business profile text verbatim |
| Asset Generator | Create illustrations/icons via Nano Banana 2 | After Strategist (parallel) | Use placeholder SVGs with theme colors |
| Assembler | Combine blocks + copy + assets + theme | After parallel agents complete | N/A (required) |
| Theme Validator | Lint assembled code against theme.yaml | After Assembler (script, not AI) | Skip — QA agent covers it |
| QA Agent | Evaluate design quality + theme compliance | After Theme Validator | Ship with warnings after 3 failures |

### 4.2 Decision Trees

**Decision: Block Selection (per section)**
- IF section has `must_contain` elements AND only 1 block matches functionally → select it
- ELSE IF multiple functional matches → score by aesthetic fit (mood + density tags)
- ELSE IF tied on aesthetic → score by compositional fit (pairing rules with adjacent sections)
- ELSE IF still tied → prefer the block that differs most from already-selected blocks (differentiation)
- ON FAILURE (no functional match) → escalate to Strategist to revise section requirements

**Decision: QA Issue Routing**
- IF issue is `theme_violation` (wrong color/font/spacing) → route to Assembler for direct fix
- ELSE IF issue is `visual_monotony` (sections too similar) → route to Block Selector for re-pick
- ELSE IF issue is `copy_mismatch` (tone/vocabulary violation) → route to Copy Writer for section re-run
- ELSE IF issue is `asset_quality` (illustration off-brand) → route to Asset Generator with tighter constraints
- ELSE IF issue is `structural` (code doesn't compile) → route to Assembler
- ON FAILURE (same issue persists after fix) → increment iteration counter, try alternative approach

**Decision: Theme Derivation**
- IF business profile includes brand colors → use those as accent, derive rest from style profile
- ELSE IF industry is specified → apply industry-conventional accent from style profile mappings
- ELSE → use style profile default (fresh-green accent, dark-navy CTA)
- ON FAILURE → present 2-3 theme options to user for selection

**Decision: Convergence Check**
- IF QA passes all three levels (technical, theme, design quality) → ship
- ELSE IF iteration count < 3 AND issues are decreasing → route fixes and re-run
- ELSE IF iteration count < 3 AND issues are increasing → structural problem, try alternative block combination
- ELSE (iteration >= 3) → ship with remaining issues documented, escalate to user

### 4.3 Scenario Definitions

**SC-001: Happy Path — Full Pipeline Success**
- Given: Valid business profile with name, description, 3 features, and industry
- When: User approves generated theme and section plan
- Then: Pipeline produces a complete landing page with 6-8 sections, all passing QA
- Error: N/A
- Edge: Business profile has only 1 feature — Strategist reduces feature sections accordingly

**SC-002: Theme Derivation from Brand Colors**
- Given: Business profile includes hex codes for brand primary and secondary colors
- When: Theme Derivation runs
- Then: Generated theme uses provided colors as accent, derives complementary palette
- Error: Provided colors fail WCAG AA contrast check → auto-adjust lightness, notify user
- Edge: Brand colors clash with style profile aesthetic → blend toward style profile with brand as accent only

**SC-003: Block Selection with Pairing Conflicts**
- Given: Section plan has 7 sections, optimal block for section 4 has `never_after` rule against section 3's selected block
- When: Block Selector processes section 4
- Then: Block Selector skips the optimal block, selects next-best that satisfies pairing rules
- Error: No blocks satisfy both functional fit AND pairing rules → relax pairing rules, log warning
- Edge: All remaining blocks have been used already → allow block reuse with different customization

**SC-004: Asset Generation Failure**
- Given: Nano Banana 2 API call for hero illustration
- When: API returns error or image fails quality check
- Then: Retry with simplified prompt (drop specific details, keep base + category prompt)
- Error: 3 consecutive API failures → use placeholder SVG illustration with theme colors
- Edge: API returns image but style doesn't match moodboard → Asset Generator re-runs with additional reference image

**SC-005: Copy Writer Vocabulary Violation**
- Given: Copy Writer generates headline for hero section
- When: QA Agent checks against controlled vocabulary
- Then: All terms match word pools, tone is consistent with business profile
- Error: Headline uses terms outside word pools → Copy Writer re-runs with explicit vocabulary constraint reminder
- Edge: Business profile uses industry jargon not in vocabulary → Copy Writer may include domain terms but flags them

**SC-006: QA Convergence Failure**
- Given: Pipeline has completed 3 QA iterations
- When: QA Agent still reports critical issues
- Then: Orchestrator ships current best version with issue report, escalates to user
- Error: N/A — this IS the error recovery path
- Edge: Issues flip-flop between iterations (fixing A breaks B) → Orchestrator locks section A, re-runs only B

**SC-007: Parallel Agent Timeout**
- Given: Block Selector, Copy Writer, and Asset Generator launched in parallel
- When: One agent takes significantly longer than others (>5 min)
- Then: Orchestrator waits up to timeout, then proceeds with available outputs
- Error: Critical agent (Block Selector) times out → retry once, then use fallback blocks
- Edge: Asset Generator times out → Assembler uses placeholders, Asset Generator re-runs async

**SC-008: Component Library Missing Block Category**
- Given: Strategist plans a "pricing" section
- When: Block Selector queries filtered library for pricing blocks
- Then: Library returns 0 matches (category not yet cataloged)
- Error: Block Selector reports missing category → Strategist revises plan to skip or substitute
- Edge: Category exists but all blocks are poor aesthetic fit → select closest match with heavy customization

**SC-009: Mixed-Font Headline Application**
- Given: Style profile specifies `headline_pattern: mixed-bold-italic`
- When: Assembler applies typography to hero headline
- Then: Headline renders with bold sans-serif base + italic serif accent on key phrase
- Error: Selected block's headline structure doesn't support mixed fonts → Assembler modifies JSX
- Edge: Headline is too short for meaningful font mixing → use all-bold fallback

**SC-010: Bento Grid Layout Selection**
- Given: Section plan requests `layout_preference: bento-asymmetric` for features
- When: Block Selector evaluates feature grid blocks
- Then: Selects a block with asymmetric card sizes (3+2, 2x3 mixed) over uniform grids
- Error: No bento blocks available → select 3-column uniform with visual differentiation via card content
- Edge: Business has 5 features (doesn't fit 3+2 cleanly) → Block Selector adjusts grid or splits across 2 sections

### 4.4 Error Recovery Patterns

| Error Type | Detection | Recovery | User Sees |
|-----------|-----------|----------|-----------|
| Nano Banana 2 API down | HTTP 5xx or timeout | Retry 2x → placeholder SVGs | Final page with placeholder note |
| Block install fails | CLI exit code != 0 | Try alternative block from same category | Nothing (handled internally) |
| Theme contrast violation | WCAG AA check in Theme Validator | Auto-adjust lightness values | Nothing (auto-fixed) |
| QA infinite loop | Issue count increasing across iterations | Lock stable sections, isolate problem | Issue report if unresolved after 3 |
| Copy exceeds character limit | Assembler detects overflow | Truncate with ellipsis, flag for Copy Writer re-run | Nothing (handled internally) |
| Missing business profile field | Validation at pipeline start | Prompt user for missing required fields | "Please provide: [field]" |

---

## 5. User Stories

### US-001: Generate Landing Page from Business Profile
**As a** founder/marketer
**I want to** provide my company details and receive a complete landing page
**So that** I get a professional web presence without hiring a design agency

**Acceptance Criteria:**
- [ ] User provides business profile (name, description, features, audience, tone)
- [ ] System generates theme + section plan for approval
- [ ] System autonomously builds complete page after approval
- [ ] Output is a deployable Next.js page with 5-8 sections
**Scenarios:** SC-001, SC-006
**Phase:** 1-3
**Status:** ⚪ Not Started

### US-002: Consistent Visual Theme
**As a** user
**I want** every section of my landing page to share the same colors, fonts, and spacing
**So that** the page looks professionally designed, not cobbled together

**Acceptance Criteria:**
- [ ] All sections use colors from a single theme palette
- [ ] Typography follows the mixed-font headline pattern from style profile
- [ ] Spacing is consistent across all section boundaries
- [ ] Theme Validator passes with zero violations
**Scenarios:** SC-002, SC-009
**Phase:** 2
**Status:** ⚪ Not Started

### US-003: AI-Generated Brand Assets
**As a** user
**I want** custom illustrations and icons generated for my landing page
**So that** visuals match my brand rather than using generic stock imagery

**Acceptance Criteria:**
- [ ] Hero illustration generated matching style profile aesthetic
- [ ] Feature icons share consistent stroke weight and color palette
- [ ] All assets use the theme's accent colors
- [ ] Fallback to themed SVG placeholders if generation fails
**Scenarios:** SC-004
**Phase:** 3
**Status:** ⚪ Not Started

### US-004: Intelligent Block Selection
**As a** user
**I want** the system to pick the best component combinations
**So that** sections flow naturally and avoid visual repetition

**Acceptance Criteria:**
- [ ] Block Selector uses 4-layer reasoning (functional → aesthetic → compositional → differentiation)
- [ ] No two adjacent sections use the same layout pattern
- [ ] Pairing rules prevent known visual clashes
- [ ] Selection includes customization instructions for the Assembler
**Scenarios:** SC-003, SC-008, SC-010
**Phase:** 2
**Status:** ⚪ Not Started

### US-005: Autonomous QA and Self-Correction
**As a** user
**I want** the system to catch and fix its own mistakes
**So that** I receive a polished result without manual iteration

**Acceptance Criteria:**
- [ ] QA Agent evaluates technical validity, theme compliance, and design quality
- [ ] Issues are routed back to the specific agent that can fix them
- [ ] Max 3 internal iterations before shipping or escalating
- [ ] Remaining issues (if any) are documented in the output
**Scenarios:** SC-005, SC-006, SC-007
**Phase:** 3
**Status:** ⚪ Not Started

### US-006: Conversion-Focused Copy
**As a** user
**I want** section copy written for my specific business and audience
**So that** the landing page drives conversions, not just looks good

**Acceptance Criteria:**
- [ ] Headlines use controlled vocabulary and match brand tone
- [ ] Subtext is concise (max 2 lines) and benefit-focused
- [ ] CTA text is action-oriented and specific to the business
- [ ] Copy passes vocabulary validation in QA
**Scenarios:** SC-005
**Phase:** 2
**Status:** ⚪ Not Started

---

## 6. Architecture & Patterns

**High-level architecture:** A central orchestrator (the main Claude Code session) manages a pipeline of 6 specialized sub-agents. Each agent receives a minimal context slice via file-based state passing. Three agents run in parallel where their inputs are independent. A QA loop provides autonomous iteration.

**Pipeline flow:**
1. User provides business profile → Orchestrator validates
2. Theme Derivation generates `theme.yaml` from business profile + style profile
3. Orchestrator presents theme + section plan for user approval
4. Strategist agent plans section flow → writes `section-plan.yaml`
5. Orchestrator pre-filters component library by section categories + style tags
6. Block Selector + Copy Writer + Asset Generator run in parallel → write outputs to pipeline files
7. Assembler combines all outputs → writes `page.tsx` + component files
8. Theme Validator script checks color/font/spacing compliance (instant, non-AI)
9. QA Agent evaluates design quality → passes or routes fixes back to specific agents
10. On QA pass → deliver final output to user

**Directory structure:**
```
pipeline/
  input/           # business-profile.yaml, style-profile.yaml
  library/         # component-library index + block details
  run-{id}/        # Per-run pipeline state (01-strategy/ through 06-qa/)
output/            # Final deliverable (page.tsx, components/, assets/, theme.css)
context/           # Moodboard images, style profile
```

**Key patterns:**
- **Context routing:** Each agent gets a purpose-built context slice, not the full state
- **Controlled vocabulary:** Agents reason with fixed taxonomy terms, not free prose
- **File-based state:** Pipeline state lives in files, not agent memory
- **Scoped re-runs:** QA fixes target specific agents/sections, not the full pipeline

---

## 7. Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 20+ | Next.js execution |
| UI Framework | Next.js 14+ / React 18+ | Page structure and routing |
| Component Library | shadcn/ui + shadcnblocks.com | Pre-built block components |
| Styling | Tailwind CSS 3.4+ | Theme token application via utilities |
| Orchestration | Claude Code Agent Tool | Sub-agent spawning and management |
| Image Generation | Nano Banana 2 (Gemini API) | Illustrations, icons, backgrounds |
| Validation | Custom theme validator script | CSS variable / class compliance checking |

**External Services:**

| Service | API Type | Auth | Purpose |
|---------|----------|------|---------|
| shadcnblocks.com | MCP Server + CLI | Premium subscription | Block catalog + code install |
| Gemini API (Nano Banana 2) | REST | API key | Asset generation |

---

## 8. MVP Scope

**In Scope:**
- ✅ **Agent Core:** Orchestrator, Strategist, Block Selector, Copy Writer, Assembler, QA Agent
- ✅ **Component Library:** Catalog of shadcnblocks with controlled vocabulary tags, screenshots, pairing rules
- ✅ **Theme Engine:** Derivation from business + style profile, CSS variable injection, Theme Validator script
- ✅ **Asset Generation:** Nano Banana 2 integration for hero illustrations and feature icons
- ✅ **Controlled Vocabulary:** Full word pool definitions for mood, density, layout, section purpose, visual type, headline pattern, CTA style
- ✅ **QA Loop:** 3-level validation (technical, theme, design quality) with scoped re-runs
- ✅ **Output:** Next.js route structure (page + components + assets + theme CSS)

**Out of Scope (v2):**
- ❌ Figma MCP integration — deferred to reduce pipeline complexity and avoid rate limit constraints
- ❌ Advanced animations (Aceternity/Magic UI) — v1 uses basic fade-in-up + hover transitions only
- ❌ Multi-page sites — v1 produces single landing pages only
- ❌ User-facing dashboard/UI — v1 runs via Claude Code CLI
- ❌ Deployment automation — v1 outputs code, user deploys
- ❌ A/B variant generation — v1 produces one optimized version

---

## 9. Implementation Phases

---

### Phase 1: Component Library & Foundation

**Status:** ⚪ Not Started

**User Stories Addressed:** US-004 (partial — library only, not selection logic)
**Scenarios Validated:** SC-008

**What This Phase Delivers:**
A structured, searchable catalog of all shadcnblocks.com premium blocks tagged with controlled vocabulary terms, CDN screenshot URLs, and basic metadata. Also establishes the project structure, theme engine configuration files, and controlled vocabulary definitions.

**Prerequisites:**
- shadcnblocks.com premium subscription active
- Shadcn MCP server configured in `.mcp.json`
- Node.js 20+ installed

**Scope — Included:**
- ✅ Enumerate all blocks via shadcn MCP server (`list_items_in_registries`)
- ✅ For each block: capture name, category, description, CDN screenshot URL
- ✅ Tag each block with controlled vocabulary terms (mood, density, layout, section_purpose)
- ✅ Define pairing rules for high-usage block categories (hero, features, CTA, testimonials)
- ✅ Write full controlled vocabulary definitions (all word pools)
- ✅ Create business profile input schema with validation
- ✅ Create theme.yaml template and derivation logic
- ✅ Establish pipeline directory structure

**Scope — NOT Included:**
- ❌ Agent orchestration logic (Phase 2)
- ❌ AI-enriched block descriptions (Phase 2)
- ❌ Nano Banana 2 integration (Phase 3)

**Technologies Used:**
- shadcnblocks MCP Server: `list_items_in_registries`, `search_items_in_registries`, `view_items_in_registries`
- CDN: Screenshot retrieval from CloudFront

**Key Technical Decisions:**
- Library stored as YAML index + individual block detail files (not one massive file) to enable selective loading by agents
- Controlled vocabulary terms are the primary filter mechanism — agents never search by free text
- Pairing rules are manually defined for top ~50 blocks, algorithmically inferred for the rest based on shared tags

**Done When:**
- Component library index contains all available premium blocks with tags
- Every block has at least: name, category, mood tag, density tag, layout tag, screenshot URL
- Controlled vocabulary YAML is complete with all word pools
- Theme template generates valid CSS from a sample business profile
- SC-008 passes (missing category handled gracefully)

---

### Phase 2: Agent Pipeline — Core Flow

**Status:** ⚪ Not Started

**User Stories Addressed:** US-001, US-002, US-004, US-006
**Scenarios Validated:** SC-001, SC-002, SC-003, SC-005, SC-009, SC-010

**What This Phase Delivers:**
The complete agent orchestration pipeline from business profile input to assembled landing page output. All 6 agents operational, parallel execution working, theme enforcement active, but without AI-generated assets (placeholders used) and without the QA iteration loop.

**Prerequisites:**
- Phase 1 complete (component library, vocabulary, theme engine)
- Gemini API key for Nano Banana 2 (can use placeholder mode if not yet available)

**Scope — Included:**
- ✅ Orchestrator: pipeline management, context routing, parallel agent spawning
- ✅ Strategist agent: business profile + style profile → section plan
- ✅ Block Selector agent: 4-layer reasoning, pairing rules, customization instructions
- ✅ Copy Writer agent: vocabulary-constrained, tone-matched section copy
- ✅ Assembler agent: block code + copy + theme tokens → assembled page
- ✅ Theme Validator script: automated lint pass for color/font/spacing compliance
- ✅ Theme Derivation: business profile + style profile → concrete theme.yaml
- ✅ Front-loaded approval flow: present theme + plan, wait for user "go"
- ✅ Output structure: page.tsx + components/ + theme.css

**Scope — NOT Included:**
- ❌ QA Agent iteration loop (Phase 3)
- ❌ AI-generated assets — uses themed SVG placeholders (Phase 3)
- ❌ Asset Generator agent (Phase 3)

**Technologies Used:**
- Claude Code Agent Tool: spawning Strategist, Block Selector, Copy Writer, Assembler
- shadcnblocks CLI: `npx shadcn add` for block code installation
- Tailwind CSS: theme token mapping via `tailwind.config` and CSS variables

**Key Technical Decisions:**
- Strategist runs first (sequential), then Block Selector + Copy Writer run in parallel — Copy Writer doesn't need to know which blocks were selected, only the section purposes
- Block Selector receives pre-filtered library (max ~40 candidates per section) not the full 1,300+ catalog
- Assembler is a hybrid agent: mostly mechanical code assembly with light reasoning for transitions and responsive adjustments
- Theme Validator is a non-AI script for speed — catches 80% of theme violations before expensive QA

**Done When:**
- Full pipeline runs end-to-end from business profile to assembled page.tsx
- Parallel agents (Block Selector + Copy Writer) execute simultaneously
- Output page renders in browser with correct theme colors, fonts, spacing
- Theme Validator reports zero violations on generated output
- All Phase 2 scenarios pass

---

### Phase 3: Asset Generation & QA Loop

**Status:** ⚪ Not Started

**User Stories Addressed:** US-003, US-005
**Scenarios Validated:** SC-004, SC-005, SC-006, SC-007

**What This Phase Delivers:**
AI-generated visual assets (hero illustrations, feature icons, decorative elements) via Nano Banana 2, replacing the placeholder SVGs from Phase 2. Also implements the autonomous QA iteration loop with scoped re-runs, completing the full autonomous pipeline.

**Prerequisites:**
- Phase 2 complete (core pipeline operational)
- Gemini API key with Nano Banana 2 access
- Moodboard reference images accessible (already in `context/`)

**Scope — Included:**
- ✅ Asset Generator agent: cascading prompt architecture (base + category + specific)
- ✅ Nano Banana 2 API integration: generation, retry logic, quality validation
- ✅ Reference image passing: 2-3 moodboard images per generation request
- ✅ Asset categories: hero illustration, icon set, bento card graphic, background texture, decorative element
- ✅ QA Agent: 3-level evaluation (technical, theme, design quality)
- ✅ Issue routing: QA → specific agent for scoped re-run
- ✅ Convergence logic: max 3 iterations, escalation on failure
- ✅ Basic scroll animations: fade-in-up, hover lift, staggered reveal (fixed recipes, not AI-generated)

**Scope — NOT Included:**
- ❌ Advanced Aceternity/Magic UI animations (v2)
- ❌ Figma MCP integration (v2)

**Technologies Used:**
- Gemini API: Nano Banana 2 image generation with reference images
- Framer Motion (lightweight): basic scroll-triggered animations

**Key Technical Decisions:**
- Asset Generator receives moodboard reference images directly (the one agent where visual context improves output)
- Cascading prompts: base prompt (from style profile) + category prompt (hero/icon/bento/etc) + specific prompt (from section plan's `visual_requirement`)
- QA Agent evaluates against a structured checklist derived from style profile, not vague "does it look good?"
- Scoped re-runs: only the agent + section that failed gets re-invoked, not the whole pipeline
- Animation layer is a fixed recipe applied by Assembler based on section type — no additional agent needed

**Done When:**
- Asset Generator produces hero illustrations that visually align with moodboard aesthetic
- Feature icons share consistent stroke weight, size, and color across a page
- QA loop catches and resolves theme violations, visual monotony, and copy mismatches autonomously
- Full pipeline (including QA loop) completes without human intervention for a standard business profile
- All Phase 3 scenarios pass
- End-to-end: business profile in → polished, asset-rich landing page out

---

### Phase 4: Polish & Hardening

**Status:** ⚪ Not Started

**User Stories Addressed:** US-001 (refinement), US-002 (refinement)
**Scenarios Validated:** All scenarios regression-tested

**What This Phase Delivers:**
Production hardening: multiple business profile test runs across different industries, edge case handling, performance optimization, and documentation for running the pipeline.

**Prerequisites:**
- Phase 3 complete (full pipeline with assets + QA)

**Scope — Included:**
- ✅ Test with 5+ diverse business profiles (fintech, SaaS, agency, ecommerce, education)
- ✅ Edge case hardening: minimal profiles, maximum features, unusual industries
- ✅ Performance optimization: reduce total pipeline runtime
- ✅ Error recovery for all documented failure modes
- ✅ User-facing documentation: how to run, how to customize, how to extend

**Scope — NOT Included:**
- ❌ New features — this phase is polish only

**Done When:**
- Pipeline produces acceptable results for 5+ different industries without manual intervention
- All 10 scenarios pass consistently
- Average pipeline runtime documented
- README with usage instructions complete

---

## 10. Current Focus

**Active Phase:** Phase 1 — Component Library & Foundation
**Active Stories:** US-004 (partial)
**Status:** ⚪ Not Started
**Research Status:** Pending — run `/research-stack` for shadcn MCP and Gemini API profiles

**Blockers:**
- None

**Session Context:**
- Style profile complete at `context/style-profile.yaml`
- Moodboard images scraped and analyzed (6 websites, 6 widgets)
- Architecture and agent orchestration design finalized in conversation
- All design decisions documented in this PRD

**Last Updated:** 2026-03-02

---

## 11. Success Criteria

**MVP is successful when:**
1. Pipeline produces a complete, renderable landing page from a business profile with zero human intervention after approval
2. All 10 scenarios from Section 4.3 pass validation
3. Generated pages visually align with the moodboard aesthetic (verified by style checklist)
4. Theme consistency: zero violations from Theme Validator on final output
5. Total pipeline time under 10 minutes for a standard 7-section page

**Validation Commands:**
```bash
# Render test — page builds and displays correctly
npm run dev
# Theme validation — zero violations
node scripts/theme-validator.js output/page.tsx
# Visual regression — compare against style checklist
# (Manual review for MVP, automated in v2)
```

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Nano Banana 2 API rate limits or downtime | High | Placeholder SVG fallback system; retry with backoff |
| shadcnblocks.com changes block naming/API | Med | Pin block versions; library catalog as local cache |
| Context window overflow in sub-agents | High | Strict pre-filtering; controlled vocabulary compression; file-based state |
| QA loop fails to converge | Med | Max 3 iterations with escalation; lock stable sections |
| Block pairing rules incomplete for new blocks | Low | Algorithmic inference from shared tags as fallback |
| Style drift across parallel agents | Med | Theme object shared to all agents; Theme Validator catches violations |
| Generated copy too generic | Med | Controlled vocabulary + business-specific word pools; QA checks tone |

---

## 13. Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-02 | 1.0 | Initial PRD — full system design from conversation analysis |

---

## PIV-Automator-Hooks
prd_status: complete
technologies_to_research: shadcnblocks-mcp, nano-banana-2-gemini-api, shadcn-ui-cli, framer-motion
scenarios_count: 10
phases_count: 4
next_suggested_command: research-stack
next_arg: "PRD.md"
confidence: high
