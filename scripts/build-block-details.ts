/**
 * build-block-details.ts — Fetches per-block detail from the shadcnblocks CLI
 * and writes individual YAML files to pipeline/library/blocks/{name}.yaml.
 *
 * Usage:  npx tsx scripts/build-block-details.ts
 *
 * Prerequisites:
 *   - pipeline/library/block-catalog.yaml must exist (run build-catalog.ts first)
 *   - SHADCNBLOCKS_API_KEY must be set in the shell environment
 *   - js-yaml installed (npm install js-yaml)
 *
 * Reference: PRD Phase 1 — Component Library & Foundation, Task 10
 */

import { execSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(__dirname, '..');
const CATALOG_PATH = resolve(PROJECT_ROOT, 'pipeline/library/block-catalog.yaml');
const BLOCKS_OUTPUT_DIR = resolve(PROJECT_ROOT, 'pipeline/library/blocks');

/**
 * Landing-page-relevant categories. Matches the criteria in the task spec plus
 * the aliases used in build-catalog.ts for consistency.
 */
const LANDING_PAGE_CATEGORIES = new Set([
  'hero',
  'features',
  'feature',
  'pricing',
  'testimonial',
  'testimonials',
  'cta',
  'footer',
  'header',
  'navbar',
  'faq',
  'stats',
  'stat',
  'team',
  'logos',
  'logo',
  'bento',
  'contact',
  'gallery',
  'blog',
  'integration',
  'integrations',
]);

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1_000;
const CLI_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogBlock {
  name: string;
  category: string;
  screenshot_url: string;
  landing_page_relevant: boolean;
}

interface CatalogFile {
  generated_at?: string;
  total_count?: number;
  landing_page_relevant_count?: number;
  categories?: Record<string, number>;
  blocks: CatalogBlock[];
}

interface BlockDetail {
  name: string;
  category: string;
  dependencies: string[];
  registryDependencies: string[];
  file_count: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `npx shadcn@latest view @shadcnblocks/{name}` and return the raw stdout.
 * Throws if exit code != 0 or if the command times out.
 */
function fetchBlockInfo(blockName: string): string {
  return execSync(`npx shadcn@latest view @shadcnblocks/${blockName}`, {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: CLI_TIMEOUT_MS,
  });
}

/**
 * Parse the raw CLI output from `shadcn view` into structured fields.
 *
 * The CLI may output JSON, JSON embedded in prose, or plain text.  We attempt
 * progressively looser parsing strategies so that partial data is always
 * better than no data.
 *
 * Extracted fields:
 *   - dependencies       — npm package dependencies
 *   - registryDependencies — shadcn registry component deps (e.g. button, badge)
 *   - file_count         — number of source files in the block
 */
function parseCliOutput(
  raw: string,
  blockName: string,
): Pick<BlockDetail, 'dependencies' | 'registryDependencies' | 'file_count'> {
  const result = {
    dependencies: [] as string[],
    registryDependencies: [] as string[],
    file_count: 0,
  };

  if (!raw || raw.trim().length === 0) {
    return result;
  }

  // Strategy 1: Try to extract a JSON object from the output.
  // The CLI sometimes wraps JSON in ANSI escape codes or prefixes it with text.
  // Strip ANSI codes first.
  const stripped = raw.replace(/\x1B\[[0-9;]*[mGKHF]/g, '').trim();

  // Find the first '{' and last '}' to extract a JSON candidate.
  const jsonStart = stripped.indexOf('{');
  const jsonEnd = stripped.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    const jsonCandidate = stripped.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);

      // Extract dependencies
      if (Array.isArray(parsed.dependencies)) {
        result.dependencies = parsed.dependencies
          .filter((d: unknown) => typeof d === 'string')
          .map((d: string) => d.trim())
          .filter(Boolean);
      }

      // Extract registryDependencies
      if (Array.isArray(parsed.registryDependencies)) {
        result.registryDependencies = parsed.registryDependencies
          .filter((d: unknown) => typeof d === 'string')
          .map((d: string) => d.trim())
          .filter(Boolean);
      }

      // Extract file count — may be under `files` (array) or `file_count` (number)
      if (typeof parsed.file_count === 'number') {
        result.file_count = parsed.file_count;
      } else if (Array.isArray(parsed.files)) {
        result.file_count = parsed.files.length;
      } else if (typeof parsed.files === 'number') {
        result.file_count = parsed.files;
      }

      return result;
    } catch {
      // JSON parse failed — fall through to regex strategies
    }
  }

  // Strategy 2: Regex extraction from plain-text or partial JSON output.

  // dependencies: look for a "dependencies": [...] pattern
  const depsMatch = stripped.match(/"dependencies"\s*:\s*\[([^\]]*)\]/);
  if (depsMatch) {
    result.dependencies = depsMatch[1]
      .split(',')
      .map((s) => s.replace(/['"]/g, '').trim())
      .filter(Boolean);
  }

  // registryDependencies: look for "registryDependencies": [...] pattern
  const regDepsMatch = stripped.match(/"registryDependencies"\s*:\s*\[([^\]]*)\]/);
  if (regDepsMatch) {
    result.registryDependencies = regDepsMatch[1]
      .split(',')
      .map((s) => s.replace(/['"]/g, '').trim())
      .filter(Boolean);
  }

  // file_count: look for "files": [...] or a files count line
  const filesArrayMatch = stripped.match(/"files"\s*:\s*\[([^\]]*)\]/);
  if (filesArrayMatch) {
    // Count comma-separated entries as a rough proxy for file count
    const entries = filesArrayMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    result.file_count = entries.length || 1;
  }

  // Fallback: if the block name appears valid and we got output, assume 1 file
  if (result.file_count === 0 && stripped.length > 0) {
    result.file_count = 1;
  }

  return result;
}

/**
 * Infer the category from a block name using the `{category}-{number}` convention.
 * Matches the logic in build-catalog.ts.
 */
function inferCategory(blockName: string): string {
  const parts = blockName.split('-');
  let numericIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) {
      numericIndex = i;
      break;
    }
  }
  if (numericIndex > 0) {
    return parts.slice(0, numericIndex).join('-');
  }
  return blockName;
}

/**
 * Determine whether a block is landing-page relevant based on catalog data
 * or by falling back to inferring the category from the block name.
 */
function isLandingPageRelevant(block: CatalogBlock): boolean {
  if (block.landing_page_relevant) {
    return true;
  }
  // Also accept blocks whose category (from name inference) matches our set
  const inferredCategory = inferCategory(block.name);
  return LANDING_PAGE_CATEGORIES.has(block.category) || LANDING_PAGE_CATEGORIES.has(inferredCategory);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Validate environment
  if (!process.env.SHADCNBLOCKS_API_KEY) {
    console.error(
      '❌ SHADCNBLOCKS_API_KEY is not set in the shell environment.\n' +
        '   Export it before running: export SHADCNBLOCKS_API_KEY=your_key_here',
    );
    process.exit(1);
  }

  // 2. Read block-catalog.yaml
  console.log(`🟡 Reading catalog: ${CATALOG_PATH}`);

  let catalog: CatalogFile;
  try {
    const raw = readFileSync(CATALOG_PATH, 'utf-8');
    catalog = yaml.load(raw) as CatalogFile;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.error(
        '❌ block-catalog.yaml not found.\n' +
          '   Run `npx tsx scripts/build-catalog.ts` first to generate it.',
      );
    } else {
      console.error(`❌ Failed to read catalog: ${err.message}`);
    }
    process.exit(1);
  }

  if (!catalog || !Array.isArray(catalog.blocks) || catalog.blocks.length === 0) {
    console.error('❌ Catalog is empty or malformed. Re-run build-catalog.ts.');
    process.exit(1);
  }

  // 3. Filter for landing-page relevant blocks
  const allBlocks = catalog.blocks;
  const relevantBlocks = allBlocks.filter(isLandingPageRelevant);

  console.log(
    `🟢 Catalog loaded: ${allBlocks.length} total blocks, ` +
      `${relevantBlocks.length} landing-page relevant.`,
  );

  if (relevantBlocks.length === 0) {
    console.error('❌ No landing-page relevant blocks found in catalog.');
    process.exit(1);
  }

  // 4. Ensure output directory exists
  mkdirSync(BLOCKS_OUTPUT_DIR, { recursive: true });

  // 5. Process blocks in batches
  let successCount = 0;
  let failCount = 0;
  const failedBlocks: string[] = [];

  const totalBatches = Math.ceil(relevantBlocks.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, relevantBlocks.length);
    const batch = relevantBlocks.slice(batchStart, batchEnd);

    console.log(
      `\n🟡 Batch ${batchIndex + 1}/${totalBatches} — ` +
        `blocks ${batchStart + 1}–${batchEnd} of ${relevantBlocks.length}`,
    );

    for (const block of batch) {
      const { name, category } = block;
      process.stdout.write(`   ${name} ... `);

      let rawOutput: string;
      try {
        rawOutput = fetchBlockInfo(name);
      } catch (err: any) {
        // CLI exited non-zero, timed out, or the block doesn't exist
        const reason: string =
          err.status !== undefined
            ? `exit code ${err.status}`
            : err.signal
              ? `signal ${err.signal}`
              : String(err.message ?? err).slice(0, 80);
        console.log(`⚠️  SKIP (${reason})`);
        failCount++;
        failedBlocks.push(name);
        continue;
      }

      // 6. Parse CLI output
      const parsed = parseCliOutput(rawOutput, name);

      // 7. Build block detail object
      const detail: BlockDetail = {
        name,
        category,
        dependencies: parsed.dependencies,
        registryDependencies: parsed.registryDependencies,
        file_count: parsed.file_count,
        description: '',
      };

      // 8. Write individual YAML file
      const outputPath = resolve(BLOCKS_OUTPUT_DIR, `${name}.yaml`);
      const header = `# Block detail — auto-generated by build-block-details.ts\n`;
      const yamlContent = yaml.dump(detail, {
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false,
      });

      try {
        writeFileSync(outputPath, header + yamlContent, 'utf-8');
        console.log('🟢 OK');
        successCount++;
      } catch (writeErr: any) {
        console.log(`🔴 WRITE ERROR (${writeErr.message})`);
        failCount++;
        failedBlocks.push(name);
      }
    }

    // Delay between batches (skip delay after the last batch)
    if (batchIndex < totalBatches - 1) {
      process.stdout.write(`\n   ⏱  Waiting ${BATCH_DELAY_MS}ms before next batch...\n`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  // 9. Final report
  console.log('\n' + '─'.repeat(60));
  console.log('📦 Build Block Details — Complete');
  console.log(`   Blocks processed:  ${relevantBlocks.length}`);
  console.log(`   Successful:        ${successCount}`);
  console.log(`   Failed / Skipped:  ${failCount}`);

  if (failedBlocks.length > 0) {
    console.log('\n⚠️  Failed blocks:');
    for (const name of failedBlocks) {
      console.log(`     - ${name}`);
    }
  }

  console.log(`\n   Output directory: ${BLOCKS_OUTPUT_DIR}`);
  console.log('\n✅ Done.');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
