# Technology Profile: shadcn/ui CLI

**Generated**: 2026-03-02
**PRD Reference**: Section 3 — Shadcnblocks.com (Premium Tier) + Section 7 — Technology Stack
**Agent Use Case**: Programmatic installation of shadcnblocks premium components into the Next.js project during the assembly phase

---

## 1. Authentication & Setup

### Project Initialization

Before any block installation, the project must be initialized with `shadcn init`. This creates a `components.json` config file that governs all subsequent CLI behavior.

```bash
npx shadcn@latest init --yes --silent
```

The CLI auto-detects the framework (Next.js App Router in our case), package manager, TypeScript, Tailwind version (v4 CSS-first or v3 config-based), and `src/` directory structure. No interactive prompts when `--yes` is passed.

### Premium Registry Configuration

The `components.json` file must include the `@shadcnblocks` registry with Bearer token authentication. The CLI expands environment variables in `${VAR_NAME}` format automatically:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {
    "@shadcnblocks": {
      "url": "https://shadcnblocks.com/r/{name}",
      "headers": {
        "Authorization": "Bearer ${SHADCNBLOCKS_API_KEY}"
      }
    }
  }
}
```

### Environment Variable

The `SHADCNBLOCKS_API_KEY` must be set in the shell environment (not `.env` alone — the CLI reads the shell environment, not dotenv files, unless a framework-level dotenv loader runs first). Keys use the format `sk_live_...` and are generated from the shadcnblocks.com dashboard under API Keys.

**Important**: The CLI does NOT load `.env` files itself. The orchestrator must ensure `SHADCNBLOCKS_API_KEY` is exported to the shell environment before spawning any agent that calls the CLI.

---

## 2. Core Data Models

### components.json Schema

| Field | Type | Description | Mutable After Init |
|-------|------|-------------|--------------------|
| `$schema` | string | JSON schema URL for validation | Yes |
| `style` | string | Design system style (`new-york`) | No |
| `rsc` | boolean | React Server Components support | Yes |
| `tsx` | boolean | TypeScript vs JavaScript output | Yes |
| `tailwind.config` | string | Path to tailwind.config (blank for v4) | Yes |
| `tailwind.css` | string | Path to global CSS file | Yes |
| `tailwind.baseColor` | string | Color palette (neutral, gray, zinc, stone, slate) | No |
| `tailwind.cssVariables` | boolean | CSS variables vs utility classes | No |
| `tailwind.prefix` | string | Utility class prefix (e.g., "tw-") | Yes |
| `aliases.*` | string | Path aliases matching tsconfig.json | Yes |
| `registries` | object | Named registries with URL templates | Yes |

### Block Naming Convention

Shadcnblocks uses the format `{category}-{number}`:
- `hero-125`, `pricing-3`, `features-8`, `cta-12`, `footer-7`
- Categories include: hero, features, pricing, cta, footer, header, testimonials, faq, stats, team, blog, contact, newsletter, logos

When installed via CLI, the namespace prefix is `@shadcnblocks`:
- Full reference: `@shadcnblocks/hero-125`

### Registry Item Schema

Each block fetched from the registry is a JSON object containing:
- `name`: Block identifier
- `type`: Resource type (component, block, theme, lib, hook)
- `files`: Array of file objects with `path`, `content`, `type`, and `target`
- `dependencies`: npm packages required
- `registryDependencies`: Other shadcn components this block depends on
- `cssVars`: CSS variable definitions
- `meta`: Optional metadata

---

## 3. Key Endpoints (CLI Commands)

### 3.1 `shadcn init` — Project Setup

Initializes the project configuration. Run once during Phase 1 setup.

```bash
npx shadcn@latest init --yes --silent
```

Key flags: `--yes` (skip prompts, default true), `--force` (overwrite existing config), `--silent` (mute output), `--cwd <path>` (working directory), `--src-dir` (use src/), `--css-variables` (default true), `--base-color <color>`, `--template <name>` (next, vite), `--no-base-style`.

### 3.2 `shadcn add` — Block Installation (Primary Command)

This is the command the Assembler agent calls most frequently. Installs block source code, resolves dependencies, and transforms code to match project configuration.

```bash
# Install a single premium block (automation mode)
npx shadcn@latest add @shadcnblocks/hero-125 --yes --overwrite --silent --cwd /path/to/project

# Install multiple blocks in one command
npx shadcn@latest add @shadcnblocks/hero-125 @shadcnblocks/features-8 @shadcnblocks/pricing-3 --yes --overwrite --silent

# Install a base shadcn/ui component (from default registry)
npx shadcn@latest add button card dialog --yes --overwrite --silent
```

| Flag | Short | Default | Purpose |
|------|-------|---------|---------|
| `--yes` | `-y` | `false` | Skip confirmation prompts |
| `--overwrite` | `-o` | `false` | Overwrite existing files |
| `--silent` | `-s` | `false` | Mute output |
| `--cwd <path>` | `-c` | `.` | Working directory |
| `--all` | `-a` | `false` | Install all available components |
| `--path <path>` | `-p` | — | Custom installation path |
| `--src-dir` | — | `false` | Use src/ directory |

**Automation-critical flag combination**: `--yes --overwrite --silent`

This triple-flag combination is the non-interactive automation recipe:
- `--yes` prevents the "Which components?" confirmation prompt from blocking
- `--overwrite` prevents the "File already exists, overwrite?" prompt from blocking
- `--silent` suppresses stdout noise; errors still go to stderr

### 3.3 `shadcn list` — Registry Enumeration

```bash
npx shadcn@latest list @shadcnblocks --cwd /path/to/project
```

### 3.4 `shadcn search` — Registry Search

```bash
npx shadcn@latest search @shadcnblocks -q "hero" --limit 20 --cwd /path/to/project
```

Flags: `-q <query>` (search term), `-l <N>` (max results, default 100), `-o <N>` (offset, default 0).

### 3.5 `shadcn view` — Inspect Before Installing

```bash
npx shadcn@latest view @shadcnblocks/hero-125 --cwd /path/to/project
```

Pre-flight validation: confirms a block exists and shows its structure without writing files.

### 3.6 `shadcn diff` — Check for Updates

```bash
npx shadcn@latest diff --cwd /path/to/project
```

Not needed during pipeline runs; useful for maintenance only.

---

## 4. Rate Limits & Throttling

### Registry Rate Limits

Shadcnblocks.com is a third-party premium registry. No official rate limit documentation exists, but practical considerations apply:

- **Sequential installation is safest**: Install blocks one at a time or in small batches (3-5 per command invocation) rather than requesting the entire catalog at once.
- **npm registry**: The CLI installs npm dependencies for each block. npm has rate limits (~200 requests/minute for unauthenticated, higher for authenticated). If many blocks share dependencies, the CLI deduplicates automatically.
- **Retry strategy**: If a registry fetch fails with HTTP 429, wait 5 seconds and retry. Max 3 retries (aligns with PRD `integration_rate_limit` error category).

### Concurrent Installation

Do NOT run multiple `shadcn add` processes against the same project directory simultaneously. The CLI writes to shared files (`package.json`, CSS files, component directories) without file-level locking. Serialize all `add` calls within a single project.

---

## 5. Error Handling

### CLI Error Constants

The shadcn CLI uses internal error constants that map to exit code 1. The error message text reveals the category:

| Error Constant | Code | Trigger | Agent Recovery |
|---------------|------|---------|----------------|
| `MISSING_DIR_OR_EMPTY_PROJECT` | 1 | CWD doesn't exist or is empty | Verify project path, run `init` |
| `EXISTING_CONFIG` | 2 | `components.json` already exists (during init) | Use `--force` flag |
| `MISSING_CONFIG` | 3 | No `components.json` found (during add) | Run `init` first |
| `FAILED_CONFIG_READ` | 4 | `components.json` is malformed | Regenerate config |
| `TAILWIND_NOT_CONFIGURED` | 5 | No Tailwind CSS setup detected | Install Tailwind first |
| `IMPORT_ALIAS_MISSING` | 6 | tsconfig aliases don't match | Fix tsconfig.json paths |
| `UNSUPPORTED_FRAMEWORK` | 7 | Unrecognized project framework | Ensure Next.js is properly configured |
| `COMPONENT_URL_NOT_FOUND` | 8 | Block doesn't exist in registry | Try alternative block (PRD pattern) |
| `COMPONENT_URL_UNAUTHORIZED` | 9 | Invalid or missing API key | Check `SHADCNBLOCKS_API_KEY` |
| `COMPONENT_URL_FORBIDDEN` | 10 | API key lacks permission (plan tier) | Escalate as `integration_auth` |
| `COMPONENT_URL_BAD_REQUEST` | 11 | Malformed block name or URL | Validate block name format |
| `COMPONENT_URL_INTERNAL_SERVER_ERROR` | 12 | Registry server error | Retry with backoff |

### Exit Code Detection

All CLI commands return exit code 0 on success, 1 on failure. The Assembler agent should:

```bash
npx shadcn@latest add @shadcnblocks/hero-125 --yes --overwrite --silent 2>&1
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  # Parse stderr for error constant keywords
  # Route to appropriate recovery action
fi
```

### Common Failure Scenarios for Automation

1. **Block not found (code 8)**: The block name is wrong or the block was renamed/deprecated. Recovery: try the next candidate from the same category.
2. **Auth failure (code 9/10)**: API key missing from environment or expired. Recovery: escalate immediately as `integration_auth` — this is a human problem.
3. **Dependency conflict**: npm `ERESOLVE` error during package installation. Recovery: run `npm install --legacy-peer-deps` then retry the `shadcn add`.
4. **Stale config (code 4)**: The `components.json` was corrupted by a previous failed run. Recovery: regenerate from template and retry.

---

## 6. SDK / Library Recommendation

### Direct CLI Invocation via child_process

There is no JavaScript SDK for shadcn — it is a CLI-only tool. Invoke it via Node.js `child_process` or `execa`:

```typescript
import { execSync } from 'child_process';

function installBlock(blockName: string, projectDir: string): { success: boolean; stderr: string } {
  try {
    execSync(
      `npx shadcn@latest add @shadcnblocks/${blockName} --yes --overwrite --silent`,
      {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120_000, // 2 minute timeout per block
        env: { ...process.env }, // Inherit SHADCNBLOCKS_API_KEY from environment
      }
    );
    return { success: true, stderr: '' };
  } catch (error: any) {
    return { success: false, stderr: error.stderr?.toString() || error.message };
  }
}
```

### Key Considerations for Agent Invocation

- **Timeout**: Set a 120-second timeout per `add` command. Block installation includes npm dependency resolution which can be slow on first install.
- **Environment inheritance**: Always pass `process.env` so `SHADCNBLOCKS_API_KEY` and `PATH` (for npm/node) are available.
- **stdio**: Use `'pipe'` for all streams. Do not use `'inherit'` — agents must capture stderr for error classification.
- **Serialization**: Queue block installations sequentially within a project. Never run concurrent `add` commands against the same directory.

---

## 7. Integration Gotchas

### 7.1 Non-Interactive Mode is Mandatory

The CLI has interactive prompts by default. Without `--yes`, the process will hang indefinitely waiting for stdin input. The Assembler agent must ALWAYS include `--yes` and `--overwrite` flags. This is the single most common cause of agent hangs with shadcn.

### 7.2 `components.json` Must Exist Before `add`

If `components.json` is missing, the CLI prompts to run `init` interactively — even with `--yes`. The project initialization (Phase 1) must complete `shadcn init` before any `add` commands run.

### 7.3 Environment Variable Expansion Requires Shell-Level Export

The `${SHADCNBLOCKS_API_KEY}` in `components.json` is expanded by the CLI at runtime. The variable must be in the process environment, not just in a `.env` file. Ensure the orchestrator exports it:

```bash
export SHADCNBLOCKS_API_KEY=sk_live_...
npx shadcn@latest add @shadcnblocks/hero-125 --yes --overwrite --silent
```

### 7.4 Dependency Resolution Cascades

When installing a premium block, the CLI recursively resolves `registryDependencies`. A block like `hero-125` may depend on base components (`button`, `badge`, `separator`). These are fetched from the default `@shadcn` registry automatically. This means:
- First block installation is slower (many base components get pulled in)
- Subsequent installations are faster (shared dependencies already exist)
- The `--overwrite` flag ensures base component updates don't prompt

### 7.5 File Output Locations

Installed blocks land in the directory specified by `aliases.components` in `components.json` (default: `@/components`). Base UI components go to `aliases.ui` (default: `@/components/ui`). The Assembler agent should know these paths to reference installed components in `page.tsx`.

### 7.6 Package Manager Detection

The CLI uses `@antfu/ni` to detect the package manager (npm, pnpm, yarn, bun) from lockfile presence. If the project uses pnpm, the CLI will use `pnpm add` for dependencies. Ensure the project has a consistent lockfile before running block installations.

### 7.7 Tailwind v4 Compatibility

With Tailwind CSS v4, `tailwind.config` in `components.json` should be blank (empty string). The CLI adapts its code transformations accordingly. If the config is set incorrectly, installed components may have broken styling.

### 7.8 `--overwrite` Does Not Merge

The `--overwrite` flag performs a full file replacement, not a merge. If the Assembler has already modified an installed component and re-runs `add`, the modifications are lost. Strategy: install blocks first, then apply customizations.

---

## 8. PRD Capability Mapping

| PRD Need | CLI Command | Flags | Notes |
|----------|------------|-------|-------|
| Initialize project for shadcn (Phase 1) | `shadcn init` | `--yes --silent` | Run once; creates `components.json` |
| Install premium block by name (Phase 2) | `shadcn add @shadcnblocks/{name}` | `--yes --overwrite --silent` | Primary automation command |
| Install base shadcn/ui component | `shadcn add {name}` | `--yes --overwrite --silent` | For base components like button, card |
| Verify block exists before install | `shadcn view @shadcnblocks/{name}` | `--cwd` | Pre-flight check |
| List all available blocks | `shadcn list @shadcnblocks` | `--cwd` | Block Selector discovery |
| Search blocks by category | `shadcn search @shadcnblocks -q "{query}"` | `--limit` | Category-based search |
| Handle block install failure (SC-003, SC-008) | Detect exit code != 0 | — | Try alternative block from same category |
| Handle missing category (SC-008) | `shadcn search` + fallback logic | — | Search for generic alternatives |

### Scenario Coverage

**SC-003 (Block Selection with Pairing Conflicts)**: When the Block Selector picks blocks that conflict, the Assembler installs them sequentially with `--overwrite`. If a block's dependencies conflict with another block's, the second install overwrites shared components — the last-installed version wins. Pairing validation should happen before installation.

**SC-008 (Missing Block Category)**: If `shadcn add` returns error code 8 (COMPONENT_URL_NOT_FOUND), the agent should:
1. Log the missing block name
2. Use `shadcn search` with the category keyword to find alternatives
3. Select the highest-rated alternative
4. Retry installation with the alternative block name

---

## 9. Live Integration Testing Specification

### 9.1 Testing Tier Classification

| Tier | Tests | Rationale |
|------|-------|-----------|
| Tier 1 (Auto-Live) | CLI version check, list default registry | Zero side effects, confirms CLI is installed |
| Tier 2 (Auto-Live with Test Data) | Install a test component, verify files, clean up | Creates files but in a temp directory |
| Tier 3 | N/A | No external API calls beyond registry fetch |
| Tier 4 | N/A | No destructive operations |

### 9.2 Test Environment Configuration

Prerequisites: Node.js >= 18, npm/pnpm, `SHADCNBLOCKS_API_KEY` exported.

Setup: Create temp Next.js project (`npx create-next-app@latest test-shadcn --ts --tailwind --eslint --app --src-dir --no-import-alias --yes`), init shadcn (`npx shadcn@latest init --yes --silent --cwd test-shadcn`), add `@shadcnblocks` registry to `components.json`. Teardown: `rm -rf test-shadcn`.

### 9.3 Testing Sequence

| ID | Command | Pass Criteria |
|----|---------|---------------|
| T1-01 | `npx shadcn@latest --version` | Exit 0, non-empty version string |
| T1-02 | `npx shadcn@latest list @shadcn --cwd test-shadcn` | Exit 0, stdout contains "button" |
| T2-01 | `npx shadcn@latest add button --yes --overwrite --silent --cwd test-shadcn` | Exit 0, `button.tsx` exists in `src/components/ui/` |
| T2-02 | `npx shadcn@latest add @shadcnblocks/hero-125 --yes --overwrite --silent --cwd test-shadcn` | Exit 0, new files in `src/components/` |
| T2-03 | `npx shadcn@latest add @shadcnblocks/nonexistent-999 --yes --overwrite --silent --cwd test-shadcn` | Exit 1, stderr indicates not found |
| T2-04 | `npx shadcn@latest add button --yes --silent --cwd empty-project` | Exit 1, stderr indicates missing config |

---

## PIV-Automator-Hooks
tech_name: shadcn-ui-cli
research_status: complete
endpoints_documented: 6
tier_1_count: 2
tier_2_count: 4
tier_3_count: 0
tier_4_count: 0
gotchas_count: 8
confidence: high
