/**
 * build-catalog.ts — Enumerates all shadcnblocks premium blocks via the CLI
 * and writes a YAML catalog to pipeline/library/block-catalog.yaml.
 *
 * Usage:  npx tsx scripts/build-catalog.ts
 *
 * Prerequisites:
 *   - components.json must have @shadcnblocks registry configured
 *   - SHADCNBLOCKS_API_KEY must be set in the shell environment
 *   - js-yaml installed (npm install js-yaml)
 *
 * Reference: PRD Phase 1 — Component Library & Foundation
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import * as yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(__dirname, '..');
const OUTPUT_PATH = resolve(PROJECT_ROOT, 'pipeline/library/block-catalog.yaml');
const CDN_BASE = 'https://deifkwefumgah.cloudfront.net/shadcnblocks/screenshots/block';

/**
 * Block categories that are directly useful for building landing pages.
 * Anything outside this set is still cataloged but flagged as non-landing-page.
 */
const LANDING_PAGE_CATEGORIES = new Set([
  'hero',
  'feature',
  'features',
  'cta',
  'pricing',
  'testimonial',
  'testimonials',
  'footer',
  'header',
  'navbar',
  'faq',
  'stats',
  'stat',
  'logos',
  'logo',
  'logo-cloud',
  'newsletter',
  'contact',
  'blog',
  'team',
  'banner',
  'about',
  'comparison',
  'gallery',
  'integration',
  'integrations',
  'signup',
  'login',
  'content',
  'case-study',
  'case-studies',
  'bento',
  'services',
  'service',
  'trust-strip',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockEntry {
  name: string;
  category: string;
  description: string;
  screenshot_url: string;
  landing_page_relevant: boolean;
}

interface CatalogOutput {
  generated_at: string;
  total_count: number;
  landing_page_relevant_count: number;
  categories: Record<string, number>;
  blocks: BlockEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Infer the category from a block name.
 * Handles multiple naming conventions:
 *   hero125           → hero        (no separator)
 *   hero-125          → hero        (hyphen separator)
 *   about1            → about
 *   case-study-4      → case-study
 *   pricing3          → pricing
 *   accordion-accordion-form → accordion  (compound names: take first segment)
 *   background-pattern3     → background-pattern
 *
 * Strategy: strip trailing digits to get the category base. If the result
 * ends with a hyphen, strip that too.
 */
function inferCategory(blockName: string): string {
  // Strip trailing digits (with optional preceding hyphen)
  const match = blockName.match(/^(.+?)-?(\d+)$/);
  if (match) {
    return match[1];
  }
  // No trailing number — use full name
  return blockName;
}

/**
 * Construct the CDN screenshot URL for a given block name.
 */
function screenshotUrl(blockName: string): string {
  return `${CDN_BASE}/${blockName}-4x3.webp`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Parse JSON output from the CLI. The CLI returns paginated JSON:
 * { pagination: { total, offset, limit, hasMore }, items: [...] }
 */
interface CLIItem {
  name: string;
  type: string;
  description: string;
  registry: string;
  addCommandArgument: string;
}

interface CLIResponse {
  pagination: { total: number; offset: number; limit: number; hasMore: boolean };
  items: CLIItem[];
}

function fetchPage(offset: number): CLIResponse {
  const cmd = `npx shadcn@latest list @shadcnblocks --offset ${offset}`;
  const stdout = execSync(cmd, {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120_000,
  });
  return JSON.parse(stdout);
}

function main(): void {
  // 1. Validate environment
  if (!process.env.SHADCNBLOCKS_API_KEY) {
    console.error(
      '❌ SHADCNBLOCKS_API_KEY is not set in the shell environment.\n' +
        '   Export it before running: export SHADCNBLOCKS_API_KEY=your_key_here',
    );
    process.exit(1);
  }

  // 2. Fetch all blocks with pagination
  console.log('🟡 Fetching block catalog from @shadcnblocks registry...');

  const allItems: CLIItem[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const page = fetchPage(offset);
      allItems.push(...page.items);
      hasMore = page.pagination.hasMore;
      offset += page.pagination.limit;
      console.log(`   Fetched ${allItems.length} / ${page.pagination.total} blocks...`);
    } catch (err: any) {
      // If pagination fails, try parsing what we got
      console.error(`⚠️ Pagination error at offset ${offset}:`, err.message);
      hasMore = false;
    }
  }

  if (allItems.length === 0) {
    console.error('❌ No blocks found. Is SHADCNBLOCKS_API_KEY valid?');
    process.exit(1);
  }

  console.log(`🟢 Fetched ${allItems.length} total blocks.`);

  // 3. Build block entries from parsed items
  const blocks: BlockEntry[] = allItems
    .filter((item) => item.type === 'registry:block')
    .map((item) => {
      const category = inferCategory(item.name);
      return {
        name: item.name,
        category,
        description: item.description || '',
        screenshot_url: screenshotUrl(item.name),
        landing_page_relevant: LANDING_PAGE_CATEGORIES.has(category),
      };
    });

  // 5. Compute category counts
  const categories: Record<string, number> = {};
  for (const block of blocks) {
    categories[block.category] = (categories[block.category] || 0) + 1;
  }

  // Sort categories alphabetically for deterministic output
  const sortedCategories: Record<string, number> = {};
  for (const key of Object.keys(categories).sort()) {
    sortedCategories[key] = categories[key];
  }

  const landingPageRelevantCount = blocks.filter((b) => b.landing_page_relevant).length;

  // 6. Build catalog object
  const catalog: CatalogOutput = {
    generated_at: new Date().toISOString(),
    total_count: blocks.length,
    landing_page_relevant_count: landingPageRelevantCount,
    categories: sortedCategories,
    blocks,
  };

  // 7. Write YAML
  const header = '# Block catalog — auto-generated by build-catalog.ts\n';
  const yamlContent = yaml.dump(catalog, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });

  // Ensure output directory exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, header + yamlContent, 'utf-8');

  // 8. Report
  console.log(`\n📦 Block Catalog Written → ${OUTPUT_PATH}`);
  console.log(`   Total blocks:               ${catalog.total_count}`);
  console.log(`   Landing-page-relevant:       ${landingPageRelevantCount}`);
  console.log(`   Categories (${Object.keys(sortedCategories).length}):`);

  for (const [cat, count] of Object.entries(sortedCategories)) {
    const marker = LANDING_PAGE_CATEGORIES.has(cat) ? '🟢' : '⚪';
    console.log(`     ${marker} ${cat}: ${count}`);
  }

  console.log('\n✅ Done.');
}

main();
