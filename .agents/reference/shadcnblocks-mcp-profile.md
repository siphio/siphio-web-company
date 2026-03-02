# Technology Profile: shadcnblocks.com MCP Server

**Generated**: 2026-03-02
**PRD Reference**: Section 3 — Shadcnblocks.com (Premium Tier)
**Agent Use Case**: Block enumeration, metadata retrieval, and search for the Block Selector agent to find optimal component combinations from 1,300+ premium blocks

---

## 1. Authentication & Setup

**Auth type:** Two-layer. The MCP server itself requires no separate auth — it reads registry config from `components.json`, which includes the bearer token. The shadcnblocks API key is a JWT (`sk_live_*` format) from the Pro dashboard, stored in `.env.local`:

```bash
# .env.local (NEVER commit this file)
SHADCNBLOCKS_API_KEY=sk_live_your_api_key_here
```

### Setup Steps

**Step 1 — Initialize MCP server for Claude Code:**

```bash
pnpm dlx shadcn@latest mcp init --client claude
```

This creates `.mcp.json` in project root:

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

**Step 2 — Configure shadcnblocks registry in `components.json`:**

```json
{
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

**Step 3 — Generate API key:**

1. Log into shadcnblocks.com with Pro account
2. Navigate to Dashboard > API Keys
3. Click "New API Key", assign name (e.g., "siphio-dev"), optional expiration
4. Copy key (starts with `sk_live_`)
5. Add to `.env.local`

**Step 4 — Restart Claude Code** to pick up MCP configuration changes.

**Prerequisites:** Node.js 20+, `components.json` in project root (via `npx shadcn@latest init`), active shadcnblocks.com Pro subscription, valid `SHADCNBLOCKS_API_KEY` in `.env.local`.

---

## 2. Core Data Models

### Block Model

Each block in the shadcnblocks registry has these properties relevant to our agents:

| Field | Type | Description | Agent Use |
|-------|------|-------------|-----------|
| `name` | string | Unique identifier, e.g., `hero125`, `pricing3` | Primary key for install commands |
| `type` | string | `registry:block` for full blocks | Filter blocks vs primitives |
| `description` | string | Short text describing the block | Input to controlled vocabulary tagging |
| `files` | array | Source code files with content | View block implementation details |
| `dependencies` | array | npm packages required | Pre-install dependencies |
| `registryDependencies` | array | Other shadcn components needed | Resolve transitive installs |

### Block Categories (shadcnblocks.com)

The library organizes 1,373+ blocks into 75+ categories. Categories relevant to landing pages:

| Category | Count | Landing Page Use |
|----------|-------|------------------|
| Hero | ~218 | Above-the-fold section |
| Feature | ~309 | Product/service showcase |
| Pricing | ~36 | Plan comparison |
| Testimonial | ~28 | Social proof |
| CTA | ~27 | Conversion prompts |
| Footer | ~41 | Page footer |
| Navbar | ~28 | Navigation header |
| FAQ | ~18 | Common questions |
| Stats | ~19 | Metrics display |
| Gallery | ~50 | Visual showcase |
| Blog | ~24 | Content preview |
| Contact | ~18 | Lead capture |
| Team | ~19 | People showcase |
| Bento | ~10 | Asymmetric grid layout |
| Integration | ~19 | Partner/tool logos |

### Block Naming Convention

Blocks follow the pattern: `{category}{number}` (e.g., `hero1`, `hero125`, `pricing3`, `features8`).

CDN screenshot URL pattern:
```
https://deifkwefumgah.cloudfront.net/shadcnblocks/screenshots/block/{name}-4x3.webp
```

---

## 3. Key Endpoints (MCP Tools)

The shadcn MCP server exposes 7 tools. All are read-only except `get_add_command_for_items` which generates CLI commands.

### 3.1 `get_project_registries`

**Purpose:** Retrieve configured registry namespaces from `components.json`.

**Parameters:** None

**Returns:** List of registry names configured in the project.

**Agent Use:** Verify `@shadcnblocks` registry is configured before querying. Run at pipeline start as a health check.

**Example prompt to MCP:** "Show me the configured registries"

### 3.2 `list_items_in_registries`

**Purpose:** List all available items (blocks, components, templates) from one or more registries.

**Parameters:** Registry namespace (e.g., `@shadcnblocks`)

**Returns:** Array of items with name, type, and description for each.

**Agent Use:** **Primary tool for Phase 1 block enumeration.** The Block Selector agent uses this to build the complete catalog of available blocks with their categories.

**Example prompt to MCP:** "List all items in the @shadcnblocks registry"

**Expected response:** Complete list of 1,300+ blocks with names and descriptions.

**Important:** This is the most data-heavy call. Response will be large. Cache to YAML index in Phase 1 to avoid repeated calls.

### 3.3 `search_items_in_registries`

**Purpose:** Fuzzy search for blocks by name or description across registries.

**Parameters:** Search query string, optional registry filter

**Returns:** Matching items with name, description, and relevance.

**Agent Use:** **Primary tool for Phase 2 block selection.** The Block Selector agent searches by controlled vocabulary terms to find blocks matching section requirements.

**Example prompt to MCP:** "Search for hero blocks with dark theme in @shadcnblocks"

**Expected response:** Filtered list of matching hero blocks.

**Note:** Uses fuzzy matching — results may include partial matches. Agents should use controlled vocabulary terms for precision, not free-form descriptions.

### 3.4 `view_items_in_registries`

**Purpose:** Get detailed information about specific blocks including name, description, type, and file contents (source code).

**Parameters:** Item name(s), registry namespace

**Returns:** Full block details including source code files, dependencies, and registry dependencies.

**Agent Use:** Inspect block structure before selection. Verify a block's DOM structure matches layout requirements (e.g., asymmetric bento grid for SC-010). Read source to count content slots for copy generation.

**Example prompt to MCP:** "View the details of hero125 from @shadcnblocks"

**Expected response:** Block metadata + full source code of all component files.

### 3.5 `get_item_examples_from_registries`

**Purpose:** Find usage examples and demos with complete code.

**Parameters:** Search pattern (e.g., `hero-demo`, `pricing example`)

**Returns:** Demo implementations with full code and dependencies.

**Agent Use:** Understand how blocks are meant to be used — helps the Assembler agent place blocks correctly in the page layout and pass correct props.

**Example prompt to MCP:** "Find usage examples for hero blocks in @shadcnblocks"

### 3.6 `get_add_command_for_items`

**Purpose:** Generate the `npx shadcn add` CLI command for specific registry items.

**Parameters:** Item name(s), registry namespace

**Returns:** Ready-to-execute CLI command string.

**Agent Use:** **Primary tool for block installation.** After the Block Selector chooses blocks, the Assembler uses this to get install commands. The orchestrator or execute phase runs these commands.

**Example prompt to MCP:** "Get the add command for hero125 from @shadcnblocks"

**Expected response:**
```bash
npx shadcn add @shadcnblocks/hero125
```

### 3.7 `get_audit_checklist`

**Purpose:** After installing or generating components, provides a verification checklist.

**Parameters:** None (uses project context)

**Returns:** Checklist items to verify components are correctly installed and working.

**Agent Use:** Post-installation verification by the QA Agent or Theme Validator. Run after assembling the page to catch missing dependencies or broken imports.

**Example prompt to MCP:** "Run the audit checklist for my project"

## 4. Rate Limits & Throttling

The MCP server runs locally via `npx` — no per-request rate limits on the server itself. The shadcnblocks.com registry endpoint (remote) has these practical limits:

| Scenario | Limit | Notes |
|----------|-------|-------|
| Unauthenticated | ~60 requests/hour | Insufficient for catalog building |
| Authenticated (API key) | ~5,000 requests/hour | Sufficient for all agent operations |
| `list_items_in_registries` | Single call returns full catalog | Cache aggressively |
| `view_items_in_registries` | Per-block detail fetch | Batch where possible |

### Recommended Throttling Strategy

- **Phase 1 (catalog build):** Call `list_items_in_registries` once, cache to YAML. Call `view_items_in_registries` in batches of 10-20 blocks with 1s delay between batches.
- **Phase 2 (runtime selection):** Read from cached YAML catalog. Use `search_items_in_registries` only for real-time refinement. Max ~5 MCP calls per section selection.

---

## 5. Error Handling

### Common Errors and Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| "No components.json found" | Missing project config | Run `npx shadcn@latest init` first |
| "Registry not found: @shadcnblocks" | Missing registry config | Add `@shadcnblocks` to `components.json` registries section |
| "Authorization failed" / 401 | Invalid or expired API key | Regenerate key in dashboard, update `.env.local` |
| "Rate limit exceeded" / 429 | Too many requests | Wait with exponential backoff (30s, 60s, 120s) |
| Empty results from search | No blocks match query | Broaden search terms; fall back to `list_items_in_registries` and filter locally |
| MCP server unresponsive | Process crash or config error | Restart Claude Code; verify `.mcp.json` syntax; clear npx cache with `npx clear-npx-cache` |
| Block install fails | Missing dependencies or write permissions | Check target directories exist; verify `components.json` paths |

### Error Mapping to PIV Taxonomy

| MCP Error | PIV Category | Recovery Action |
|-----------|-------------|-----------------|
| 401 Unauthorized | `integration_auth` | Escalate — human must regenerate API key |
| 429 Rate Limit | `integration_rate_limit` | Backoff + retry (max 3) |
| Empty search results | Maps to SC-008 | Fall back to category listing, log gap |
| MCP server crash | `partial_execution` | Restart MCP, retry once |

---

## 6. SDK / Library Recommendation

No third-party SDK needed. The official shadcn MCP server is the only integration path.

**Required config files:** `.mcp.json` (MCP server declaration), `components.json` (registry + auth), `.env.local` (API key). See Section 1 for complete configuration examples.

**CLI for block installation** (after MCP selects blocks):
```bash
npx shadcn add @shadcnblocks/hero125
npx shadcn add @shadcnblocks/pricing3
npx shadcn add @shadcnblocks/features8
```

This installs block source code + required shadcn/ui primitives + npm dependencies automatically.

---

## 7. Integration Gotchas

### G1: `components.json` Must Exist Before MCP Works

The MCP server reads registry configuration from `components.json`. If this file is missing, all registry-related tools (`list_items_in_registries`, `search_items_in_registries`, etc.) will fail. Run `npx shadcn@latest init` before configuring MCP.

### G2: MCP Server Requires Restart After Config Changes

Changes to `.mcp.json` or `components.json` are NOT hot-reloaded. You must restart Claude Code (or the MCP client) for changes to take effect. This includes adding/updating the `@shadcnblocks` registry or changing the API key.

### G3: Large Catalog Response from `list_items_in_registries`

Listing all 1,300+ blocks returns a substantial payload. Do NOT call this repeatedly. Call once in Phase 1 and cache the result to the YAML catalog. Agents in Phase 2 should read from the cached catalog, not call `list_items_in_registries` at runtime.

### G4: Search Uses Fuzzy Matching, Not Exact Category Filters

`search_items_in_registries` uses fuzzy matching on names and descriptions. Searching for "hero" may also return blocks with "hero" in their description but in a different category. Always verify block category from the cached catalog rather than relying solely on search results.

### G5: Target Directories Must Exist with Write Permissions

Block installation writes files to the paths configured in `components.json` aliases (e.g., `@/components`). These directories must exist and be writable. Create the directory structure before running install commands.

### G6: API Key Expiration Is Silent

Expired `sk_live_*` keys return 401 errors without explicit "expired" messaging. If auth fails unexpectedly, check key expiration in the shadcnblocks dashboard before debugging other causes.

### G7: Free vs Pro Blocks

Free blocks (approximately 200) work without authentication. Pro blocks (1,100+) require the API key. If the key is missing or invalid, searches will return only free blocks — which may silently reduce the catalog without an error. Validate catalog size after initial enumeration.

### G8: CDN Screenshots Are Not MCP-Accessible

Block screenshots at the CloudFront CDN URL are separate from the MCP server. Agents building the catalog must construct the URL manually using the pattern: `https://deifkwefumgah.cloudfront.net/shadcnblocks/screenshots/block/{name}-4x3.webp`. The MCP server does not return screenshot URLs.

---

## 8. PRD Capability Mapping

| PRD Capability | MCP Tool | Phase | Notes |
|---------------|----------|-------|-------|
| Block enumeration | `list_items_in_registries` | 1 | Build full catalog YAML index |
| Metadata retrieval | `view_items_in_registries` | 1 | Get description, dependencies, source for each block |
| Block search by category | `search_items_in_registries` | 2 | Block Selector finds candidates per section |
| Code installation | `get_add_command_for_items` | 2 | Generate CLI install commands for selected blocks |
| Usage pattern lookup | `get_item_examples_from_registries` | 2 | Assembler learns correct prop passing |
| Registry health check | `get_project_registries` | 1, 2 | Verify `@shadcnblocks` is configured |
| Post-install verification | `get_audit_checklist` | 2 | QA Agent validates installed blocks |

### Scenario Mapping

| Scenario | MCP Tools Involved | How It Uses MCP |
|----------|-------------------|-----------------|
| SC-003 (pairing conflicts) | `search_items_in_registries`, `view_items_in_registries` | Search for alternative blocks when pairing rules reject first choice; view source to verify layout compatibility |
| SC-008 (missing category) | `list_items_in_registries`, `search_items_in_registries` | Detect empty category from catalog; search with broader terms for fallback blocks |
| SC-010 (bento grid) | `search_items_in_registries`, `view_items_in_registries` | Search for bento/asymmetric blocks; view source to verify grid structure (3+2, 2x3 mixed layouts) |

---

## 9. Live Integration Testing Specification

### 9.1 Testing Tier Classification

**Tier 1 (Auto-Live): All 7 MCP tools are read-only and safe for automated testing.**

| Test ID | Tool | What It Validates | Pass Criteria |
|---------|------|-------------------|---------------|
| T1-01 | `get_project_registries` | MCP server running, config readable | Returns list including `@shadcnblocks` |
| T1-02 | `list_items_in_registries` | Auth works, catalog accessible | Returns 1,000+ items (Pro tier) |
| T1-03 | `search_items_in_registries` | Search functionality works | Query "hero" returns 10+ results |
| T1-04 | `view_items_in_registries` | Block detail retrieval works | Returns source files for `hero1` |
| T1-05 | `get_item_examples_from_registries` | Examples accessible | Returns at least 1 demo for common blocks |
| T1-06 | `get_add_command_for_items` | Install command generation | Returns valid `npx shadcn add` command |
| T1-07 | `get_audit_checklist` | Audit tool functional | Returns checklist items |

**Tier 2:** N/A — MCP tools are read-only, no mutations.
**Tier 3:** N/A — No external side effects.
**Tier 4:** N/A — No destructive operations.

### 9.2 Test Environment Configuration

**Required:** `.mcp.json` configured, `components.json` with `@shadcnblocks` registry, `.env.local` with `SHADCNBLOCKS_API_KEY`, Node.js 20+, internet connectivity.

**Health Check:**
```bash
npx shadcn@latest mcp 2>&1 | head -5
test -n "$SHADCNBLOCKS_API_KEY" && echo "API key configured" || echo "ERROR: Missing SHADCNBLOCKS_API_KEY"
grep -q "@shadcnblocks" components.json && echo "Registry configured" || echo "ERROR: Missing registry"
```

### 9.3 Testing Sequence

1. **Pre-flight:** Run health check command. If any check fails, classify as `integration_auth` and escalate.
2. **T1-01:** Call `get_project_registries`. Verify `@shadcnblocks` is present.
3. **T1-02:** Call `list_items_in_registries` for `@shadcnblocks`. Verify count > 1,000 (Pro tier should return 1,300+). If count < 200, API key may be invalid (returning only free blocks) — classify as `integration_auth`.
4. **T1-03:** Call `search_items_in_registries` with query "hero". Verify results > 10.
5. **T1-04:** Call `view_items_in_registries` for `hero1`. Verify response includes `files` array with at least one `.tsx` file.
6. **T1-05:** Call `get_item_examples_from_registries` for "hero-demo". Verify response includes code.
7. **T1-06:** Call `get_add_command_for_items` for `hero1`. Verify output contains `npx shadcn add`.
8. **T1-07:** Call `get_audit_checklist`. Verify response is non-empty.

**Schema Validation (T1-04 response):**
```
Required fields in view response:
- name: string (non-empty)
- type: string (contains "block" or "component")
- files: array (length >= 1)
- files[].content: string (non-empty, contains JSX/TSX)
```

## PIV-Automator-Hooks
tech_name: shadcnblocks-mcp
research_status: complete
endpoints_documented: 7
tier_1_count: 7
tier_2_count: 0
tier_3_count: 0
tier_4_count: 0
gotchas_count: 8
confidence: high
