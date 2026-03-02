/**
 * tag-blocks.ts — Assigns controlled vocabulary tags to every block in the catalog.
 *
 * Usage:  npx tsx scripts/tag-blocks.ts
 *
 * Reads:
 *   pipeline/library/block-catalog.yaml       (produced by build-catalog.ts)
 *   pipeline/vocabulary/controlled-vocabulary.yaml
 *
 * Writes:
 *   pipeline/library/block-catalog.yaml       (in-place; adds `tags` to each block)
 *
 * Reference: PRD Phase 1 — Component Library & Foundation
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(__dirname, '..');
const CATALOG_PATH = resolve(PROJECT_ROOT, 'pipeline/library/block-catalog.yaml');
const VOCAB_PATH = resolve(PROJECT_ROOT, 'pipeline/vocabulary/controlled-vocabulary.yaml');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockTags {
  section_purpose: string;
  mood: string;
  density: string;
  layout: string;
}

interface BlockEntry {
  name: string;
  category: string;
  screenshot_url: string;
  landing_page_relevant: boolean;
  tags?: BlockTags;
}

interface CatalogFile {
  generated_at: string;
  total_count: number;
  landing_page_relevant_count: number;
  categories: Record<string, number>;
  blocks: BlockEntry[];
  [key: string]: unknown;
}

interface ControlledVocabulary {
  mood: string[];
  density: string[];
  layout: string[];
  section_purpose: string[];
  [key: string]: string[];
}

// ---------------------------------------------------------------------------
// Mapping tables
// ---------------------------------------------------------------------------

/**
 * Maps a raw catalog category to a section_purpose vocabulary term.
 *
 * Rules (from task spec):
 *   header/navbar    → navbar
 *   testimonial      → testimonials
 *   integration/logos → logos
 *   newsletter       → cta
 *   banner           → hero
 *   about            → features
 *   comparison       → pricing
 *   signup/login     → contact
 *   content          → blog
 *   case-study       → blog
 */
const SECTION_PURPOSE_MAP: Record<string, string> = {
  // Direct matches
  hero: 'hero',
  features: 'features',
  feature: 'features',
  bento: 'features',
  about: 'features',
  pricing: 'pricing',
  comparison: 'pricing',
  testimonial: 'testimonials',
  testimonials: 'testimonials',
  footer: 'footer',
  faq: 'faq',
  stats: 'stats',
  stat: 'stats',
  team: 'team',
  gallery: 'gallery',
  contact: 'contact',
  signup: 'contact',
  login: 'contact',
  blog: 'blog',
  content: 'blog',
  'case-study': 'blog',
  'case-studies': 'blog',
  // Aliased categories
  header: 'navbar',
  navbar: 'navbar',
  logos: 'logos',
  logo: 'logos',
  integration: 'logos',
  integrations: 'logos',
  newsletter: 'cta',
  cta: 'cta',
  banner: 'hero',
};

/**
 * Maps a category to a mood vocabulary term.
 *
 * Heuristics:
 *   header/navbar → clean
 *   hero          → friendly
 *   testimonial   → elegant
 *   pricing       → professional
 *   footer        → clean
 *   cta           → bold
 *   features/bento → friendly
 *   stats         → professional
 *   faq           → clean
 *   team          → friendly
 *   gallery       → playful
 *   blog          → clean
 *   contact       → professional
 *   logos         → clean
 */
const MOOD_MAP: Record<string, string> = {
  hero: 'friendly',
  banner: 'friendly',
  features: 'friendly',
  feature: 'friendly',
  bento: 'friendly',
  about: 'friendly',
  team: 'friendly',
  testimonial: 'elegant',
  testimonials: 'elegant',
  pricing: 'professional',
  comparison: 'professional',
  stats: 'professional',
  stat: 'professional',
  contact: 'professional',
  signup: 'professional',
  login: 'professional',
  'case-study': 'professional',
  'case-studies': 'professional',
  cta: 'bold',
  newsletter: 'bold',
  gallery: 'playful',
  header: 'clean',
  navbar: 'clean',
  footer: 'clean',
  faq: 'clean',
  logos: 'clean',
  logo: 'clean',
  integration: 'clean',
  integrations: 'clean',
  blog: 'clean',
  content: 'clean',
};

/**
 * Maps a category to a density vocabulary term.
 *
 * Heuristics:
 *   hero              → sparse
 *   features/bento    → balanced
 *   pricing           → balanced
 *   stats             → dense
 *   faq               → balanced
 *   logos             → dense
 *   testimonial       → sparse
 *   team              → balanced
 *   blog              → balanced
 *   gallery           → dense
 *   cta               → sparse
 */
const DENSITY_MAP: Record<string, string> = {
  hero: 'sparse',
  banner: 'sparse',
  testimonial: 'sparse',
  testimonials: 'sparse',
  cta: 'sparse',
  newsletter: 'sparse',
  header: 'sparse',
  navbar: 'sparse',
  features: 'balanced',
  feature: 'balanced',
  bento: 'balanced',
  pricing: 'balanced',
  comparison: 'balanced',
  faq: 'balanced',
  team: 'balanced',
  blog: 'balanced',
  content: 'balanced',
  'case-study': 'balanced',
  'case-studies': 'balanced',
  footer: 'balanced',
  contact: 'balanced',
  signup: 'balanced',
  login: 'balanced',
  about: 'balanced',
  stats: 'dense',
  stat: 'dense',
  logos: 'dense',
  logo: 'dense',
  integration: 'dense',
  integrations: 'dense',
  gallery: 'dense',
};

/**
 * Maps a category to a layout vocabulary term.
 *
 * Heuristics:
 *   hero           → centered-stack
 *   features       → bento-asymmetric
 *   pricing        → grid-uniform
 *   testimonials   → grid-uniform
 *   cta            → centered-stack
 *   footer         → grid-uniform
 *   navbar         → single-column
 *   faq            → single-column
 *   stats          → grid-uniform
 *   team           → grid-uniform
 *   logos          → single-column
 *   contact        → split-horizontal
 *   gallery        → masonry
 *   blog           → grid-uniform
 *   bento          → bento-asymmetric
 */
const LAYOUT_MAP: Record<string, string> = {
  hero: 'centered-stack',
  banner: 'centered-stack',
  cta: 'centered-stack',
  newsletter: 'centered-stack',
  features: 'bento-asymmetric',
  feature: 'bento-asymmetric',
  bento: 'bento-asymmetric',
  about: 'bento-asymmetric',
  pricing: 'grid-uniform',
  comparison: 'grid-uniform',
  testimonial: 'grid-uniform',
  testimonials: 'grid-uniform',
  footer: 'grid-uniform',
  stats: 'grid-uniform',
  stat: 'grid-uniform',
  team: 'grid-uniform',
  blog: 'grid-uniform',
  content: 'grid-uniform',
  'case-study': 'grid-uniform',
  'case-studies': 'grid-uniform',
  navbar: 'single-column',
  header: 'single-column',
  faq: 'single-column',
  logos: 'single-column',
  logo: 'single-column',
  integration: 'single-column',
  integrations: 'single-column',
  contact: 'split-horizontal',
  signup: 'split-horizontal',
  login: 'split-horizontal',
  gallery: 'masonry',
};

// ---------------------------------------------------------------------------
// Tagging
// ---------------------------------------------------------------------------

/**
 * Derive the four controlled-vocabulary tags for a block based on its category.
 *
 * Defaults when the category has no explicit mapping entry:
 *   section_purpose → features      (broad catch-all)
 *   mood            → clean         (neutral, spec default)
 *   density         → balanced      (neutral, spec default)
 *   layout          → single-column (safest layout, spec default)
 */
function deriveTags(category: string): BlockTags {
  return {
    section_purpose: SECTION_PURPOSE_MAP[category] ?? 'features',
    mood: MOOD_MAP[category] ?? 'clean',
    density: DENSITY_MAP[category] ?? 'balanced',
    layout: LAYOUT_MAP[category] ?? 'single-column',
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check that every tag value is a term present in the controlled vocabulary.
 * Returns a list of human-readable error strings (empty = all valid).
 */
function validateTags(
  block: BlockEntry,
  tags: BlockTags,
  vocab: ControlledVocabulary,
): string[] {
  const errors: string[] = [];
  const dimensions: Array<keyof BlockTags> = ['section_purpose', 'mood', 'density', 'layout'];

  for (const dim of dimensions) {
    const allowed = new Set(vocab[dim] ?? []);
    if (!allowed.has(tags[dim])) {
      errors.push(
        `Block "${block.name}" (category: ${block.category}): ` +
          `${dim}="${tags[dim]}" is not in vocab [${[...allowed].join(', ')}]`,
      );
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Print a count-per-term breakdown for each of the four tag dimensions.
 */
function printDistribution(blocks: BlockEntry[]): void {
  const dims: Array<keyof BlockTags> = ['section_purpose', 'mood', 'density', 'layout'];

  for (const dim of dims) {
    const counts: Record<string, number> = {};
    for (const block of blocks) {
      const val = block.tags?.[dim] ?? '(untagged)';
      counts[val] = (counts[val] || 0) + 1;
    }

    console.log(`\n  ${dim}:`);
    for (const [term, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      const bar = '█'.repeat(Math.min(Math.ceil(count / 2), 40));
      console.log(`    ${term.padEnd(22)} ${String(count).padStart(4)}  ${bar}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // 1. Load the catalog
  console.log(`\n🟡 Loading catalog from ${CATALOG_PATH} ...`);
  let catalogRaw: string;
  try {
    catalogRaw = readFileSync(CATALOG_PATH, 'utf-8');
  } catch (err: any) {
    console.error(
      `❌ Cannot read block-catalog.yaml.\n` +
        `   Run "npx tsx scripts/build-catalog.ts" first to generate it.\n` +
        `   (${err.message})`,
    );
    process.exit(1);
  }

  let catalog: CatalogFile;
  try {
    catalog = yaml.load(catalogRaw) as CatalogFile;
  } catch (err: any) {
    console.error(`❌ Failed to parse block-catalog.yaml as YAML: ${err.message}`);
    process.exit(1);
  }

  if (!catalog || !Array.isArray(catalog.blocks)) {
    console.error('❌ block-catalog.yaml has no "blocks" array. Is the file corrupted?');
    process.exit(1);
  }

  // 2. Load the controlled vocabulary
  console.log(`🟡 Loading vocabulary from ${VOCAB_PATH} ...`);
  let vocabRaw: string;
  try {
    vocabRaw = readFileSync(VOCAB_PATH, 'utf-8');
  } catch (err: any) {
    console.error(`❌ Cannot read controlled-vocabulary.yaml: ${err.message}`);
    process.exit(1);
  }

  let vocab: ControlledVocabulary;
  try {
    vocab = yaml.load(vocabRaw) as ControlledVocabulary;
  } catch (err: any) {
    console.error(`❌ Failed to parse controlled-vocabulary.yaml as YAML: ${err.message}`);
    process.exit(1);
  }

  console.log(`🟢 Loaded ${catalog.blocks.length} blocks from catalog, vocabulary ready.\n`);

  // 3. Tag every block
  const validationErrors: string[] = [];
  let taggedCount = 0;
  let untaggedCount = 0;

  for (const block of catalog.blocks) {
    if (!block.category) {
      // Should never happen given build-catalog.ts guarantees, but guard anyway
      untaggedCount++;
      console.warn(`⚠️  Block "${block.name}" has no category — skipping tag assignment.`);
      continue;
    }

    const tags = deriveTags(block.category);

    // Validate before writing
    const errors = validateTags(block, tags, vocab);
    validationErrors.push(...errors);

    block.tags = tags;
    taggedCount++;
  }

  // 4. Surface vocabulary mismatches
  if (validationErrors.length > 0) {
    console.warn(`⚠️  ${validationErrors.length} vocabulary mismatch(es) — review mapping tables:`);
    for (const e of validationErrors) {
      console.warn(`   ${e}`);
    }
    console.warn('');
  }

  // 5. Write catalog back in-place
  const header =
    '# Block catalog — auto-generated by build-catalog.ts, tagged by tag-blocks.ts\n';
  const yamlContent = yaml.dump(catalog, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });

  writeFileSync(CATALOG_PATH, header + yamlContent, 'utf-8');
  console.log(`✅ Catalog written back to ${CATALOG_PATH}\n`);

  // 6. Summary
  console.log('## Tagging Summary');
  console.log(`   Total blocks:    ${catalog.blocks.length}`);
  console.log(`   Tagged:          ${taggedCount}  ${taggedCount === catalog.blocks.length ? '🟢' : '🟡'}`);
  console.log(`   Untagged:        ${untaggedCount}  ${untaggedCount === 0 ? '🟢' : '🔴'}`);
  console.log(`   Vocab errors:    ${validationErrors.length}  ${validationErrors.length === 0 ? '🟢' : '🔴'}`);

  // 7. Distribution per tag dimension
  console.log('\n## Tag Distribution');
  printDistribution(catalog.blocks);

  console.log('\n✅ Done.');
}

main();
