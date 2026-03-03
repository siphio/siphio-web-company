import { resolve } from 'path';
import { readYaml } from './yaml-helpers';
import type { BlockEntry, BlockCatalog, PairingRules } from './types';

const PROJECT_ROOT = resolve(__dirname, '../..');
const CATALOG_PATH = resolve(PROJECT_ROOT, 'pipeline/library/block-catalog.yaml');

const MAX_CANDIDATES = 50;

/**
 * Filters the full block catalog down to relevant candidates for a given
 * landing page section. Applies section-purpose matching, pairing rules,
 * and deduplication against already-selected blocks.
 *
 * @param sectionPurpose - The purpose tag to match (e.g. "hero", "features", "cta")
 * @param alreadySelected - Block names already chosen for the page (excluded from results)
 * @param pairingRules - Rules governing which block categories can appear adjacent
 * @param previousSectionPurpose - Purpose of the immediately preceding section, used
 *        to apply never_after exclusions
 * @returns Filtered list of BlockEntry candidates, capped at 50
 */
export function filterCatalog(
  sectionPurpose: string,
  alreadySelected: string[],
  pairingRules: PairingRules,
  previousSectionPurpose?: string,
): BlockEntry[] {
  const catalog = readYaml<BlockCatalog>(CATALOG_PATH);

  const alreadySelectedSet = new Set(alreadySelected);

  // Step 1: Filter by section purpose and landing page relevance
  let candidates = catalog.blocks.filter(
    (block) =>
      block.landing_page_relevant === true &&
      block.tags?.section_purpose === sectionPurpose,
  );

  // Step 2: Apply pairing rules — exclude blocks from categories listed in
  // never_after for the previous section's purpose
  if (previousSectionPurpose) {
    const rule = pairingRules.rules[previousSectionPurpose];
    if (rule && rule.never_after.length > 0) {
      const excludedCategories = new Set(rule.never_after);
      candidates = candidates.filter(
        (block) => !excludedCategories.has(block.category),
      );
    }
  }

  // Step 3: Exclude already-selected blocks (differentiation)
  candidates = candidates.filter(
    (block) => !alreadySelectedSet.has(block.name),
  );

  // Step 4: Cap at MAX_CANDIDATES
  return candidates.slice(0, MAX_CANDIDATES);
}
