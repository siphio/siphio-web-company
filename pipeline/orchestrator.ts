// Pipeline orchestrator — main entry point
// Reads business profile, derives theme, spawns agents, assembles output.
// Reference: PRD Phase 2 + Phase 3, Section 6 (Architecture)
//
// Usage: npx tsx pipeline/orchestrator.ts <business-profile.yaml>

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { performance } from "perf_hooks";
import yaml from "js-yaml";

import { deriveTheme } from "../src/lib/theme/derive-theme";
import { generateCSS } from "../src/lib/theme/generate-css";
import type { BusinessProfile, Theme } from "../src/lib/theme/types";
import type {
  SectionPlan,
  BlockSelection,
  SectionCopy,
  BlockEntry,
  PairingRules,
  AssetManifest,
  QAConvergenceState,
  QAResult,
} from "./lib/types";
import { readYaml, writeYaml } from "./lib/yaml-helpers";
import { filterCatalog } from "./lib/catalog-filter";
import { installBlocks } from "./lib/block-installer";
import { buildStrategistPrompt } from "./agents/strategist";
import { buildBlockSelectorPrompt } from "./agents/block-selector";
import { buildCopyWriterPrompt } from "./agents/copy-writer";
import { buildAssemblerPrompt } from "./agents/assembler";
import { buildAssetGeneratorPrompt, getMoodboardImagePaths } from "./agents/asset-generator";
import { buildQAAgentPrompt } from "./agents/qa-agent";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(__dirname, "..");
const STYLE_PROFILE_PATH = resolve(PROJECT_ROOT, "context/style-profile.yaml");
const VOCAB_PATH = resolve(
  PROJECT_ROOT,
  "pipeline/vocabulary/controlled-vocabulary.yaml",
);
const PAIRING_RULES_PATH = resolve(
  PROJECT_ROOT,
  "pipeline/vocabulary/pairing-rules.yaml",
);
const THEME_TEMPLATE_PATH = resolve(
  PROJECT_ROOT,
  "src/lib/theme/theme-template.yaml",
);
const OUTPUT_DIR = resolve(PROJECT_ROOT, "output");
const MOODBOARD_DIR = resolve(PROJECT_ROOT, "context/moodboard-websites");
const MAX_QA_ITERATIONS = 3;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationError {
  field: string;
  message: string;
}

function validateProfile(profile: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const p = profile as Record<string, unknown>;

  if (!p.name || typeof p.name !== "string")
    errors.push({ field: "name", message: "Required string field" });
  if (!p.description || typeof p.description !== "string")
    errors.push({ field: "description", message: "Required string field" });
  if (!Array.isArray(p.features) || p.features.length < 1)
    errors.push({ field: "features", message: "At least 1 feature required" });
  if (!p.audience || typeof p.audience !== "string")
    errors.push({ field: "audience", message: "Required string field" });

  return errors;
}

// ---------------------------------------------------------------------------
// Agent execution helpers
// ---------------------------------------------------------------------------

// In a real Claude Code session, these would use the Agent tool.
// For the pipeline entry point, we write the prompts to files so the
// orchestrator can be invoked manually or by the Claude Code session.

function writePromptFile(runDir: string, name: string, prompt: string): string {
  const path = resolve(runDir, `${name}-prompt.md`);
  writeFileSync(path, prompt, "utf-8");
  return path;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runPipeline(profilePath: string): Promise<void> {
  console.log("\n## Siphio Pipeline — Phase 2 + Phase 3\n");

  const timings = new Map<string, number>();
  const pipelineStart = performance.now();
  let stepStart: number;

  // Step 1: Validate input
  console.log("🟡 Step 1: Reading and validating business profile...");
  stepStart = performance.now();
  const profileRaw = readFileSync(resolve(profilePath), "utf-8");
  const profile = yaml.load(profileRaw) as BusinessProfile;

  const errors = validateProfile(profile);
  if (errors.length > 0) {
    const msg = errors.map((e) => `${e.field}: ${e.message}`).join(", ");
    throw new Error(`Profile validation failed: ${msg}`);
  }
  console.log(`  ✅ Profile valid: ${profile.name}`);
  timings.set("validation", performance.now() - stepStart);

  // Step 2: Generate run ID and create run directory
  const runId = `run-${Date.now()}`;
  const runDir = resolve(__dirname, runId);
  mkdirSync(runDir, { recursive: true });
  console.log(`  📁 Run directory: ${runDir}`);

  // Step 3: Derive theme
  console.log("\n🟡 Step 2: Deriving theme...");
  stepStart = performance.now();
  const templateTheme = readYaml<Theme>(THEME_TEMPLATE_PATH);
  const theme = deriveTheme(profile, templateTheme);
  const themeCSS = generateCSS(theme);

  writeYaml(resolve(runDir, "theme.yaml"), theme);
  writeFileSync(resolve(runDir, "theme.css"), themeCSS, "utf-8");
  console.log(`  ✅ Theme derived: "${theme.name}"`);
  console.log(`  Palette: accent=${theme.palette.accent_primary}, cta=${theme.palette.cta_fill}`);
  timings.set("theme_derivation", performance.now() - stepStart);

  // Step 4: Present theme for approval
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("## Theme & Plan Summary (Approval Required)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`  Business: ${profile.name}`);
  console.log(`  Industry: ${profile.industry ?? "general"}`);
  console.log(`  Tone:     ${profile.tone ?? "professional"}`);
  console.log(`  Features: ${profile.features.length}`);
  console.log(`  Theme:    ${theme.name}`);
  console.log(`  Accent:   ${theme.palette.accent_primary}`);
  console.log(`  CTA:      ${theme.palette.cta_fill} on ${theme.palette.cta_text}`);
  console.log(`  Fonts:    ${theme.typography.heading_font} / ${theme.typography.accent_font} / ${theme.typography.body_font}`);

  const sectionCount =
    profile.features.length <= 2
      ? 5
      : profile.features.length <= 4
        ? 6 + Math.min(profile.features.length - 2, 1)
        : 7 + Math.min(profile.features.length - 4, 1);
  console.log(`  Sections: ~${sectionCount} planned`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(
    "  When running in Claude Code, the orchestrator will use AskUserQuestion",
  );
  console.log(
    "  for approval. In CLI mode, proceeding automatically.",
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Step 5: Run Strategist agent
  console.log("🟡 Step 3: Running Strategist agent...");
  const strategistPrompt = buildStrategistPrompt(
    profile,
    STYLE_PROFILE_PATH,
    VOCAB_PATH,
    runDir,
  );
  const strategistPromptPath = writePromptFile(
    runDir,
    "strategist",
    strategistPrompt,
  );
  console.log(`  📝 Strategist prompt written: ${strategistPromptPath}`);
  console.log(
    "  ⏳ In Claude Code session, this spawns an Agent tool call.",
  );
  console.log(
    "     For CLI testing, manually review the prompt and create section-plan.yaml",
  );

  // Check if section plan exists (agent already ran or manual creation)
  const sectionPlanPath = resolve(runDir, "section-plan.yaml");
  if (!existsSync(sectionPlanPath)) {
    // Generate a default section plan for testing
    console.log("  🔧 Generating default section plan for CLI testing...");
    const defaultPlan = generateDefaultSectionPlan(profile);
    writeYaml(sectionPlanPath, defaultPlan);
    console.log(`  ✅ Default section plan written with ${defaultPlan.sections.length} sections`);
  }

  const sectionPlan = readYaml<SectionPlan>(sectionPlanPath);
  console.log(
    `  ✅ Section plan loaded: ${sectionPlan.sections.length} sections`,
  );

  // Step 6: Pre-filter catalog for Block Selector
  console.log("\n🟡 Step 4: Pre-filtering block catalog...");
  stepStart = performance.now();
  const pairingRules = readYaml<PairingRules>(PAIRING_RULES_PATH);
  const alreadySelected: string[] = [];
  const filteredCatalogs = new Map<string, BlockEntry[]>();

  let previousPurpose: string | undefined;
  for (const section of sectionPlan.sections) {
    const candidates = filterCatalog(
      section.purpose,
      alreadySelected,
      pairingRules,
      previousPurpose,
    );
    filteredCatalogs.set(section.id, candidates);
    if (candidates.length === 0) {
      console.log(
        `  ⚠️ ${section.id} (${section.purpose}): 0 candidates — will use generic fallback`,
      );
    } else {
      console.log(
        `  ${section.id} (${section.purpose}): ${candidates.length} candidates`,
      );
    }
    previousPurpose = section.purpose;
  }

  timings.set("catalog_filtering", performance.now() - stepStart);

  // Step 7: Run Block Selector + Copy Writer in parallel
  console.log("\n🟡 Step 5: Running Block Selector + Copy Writer in parallel...");

  const blockSelectorPrompt = buildBlockSelectorPrompt(
    sectionPlan,
    filteredCatalogs,
    PAIRING_RULES_PATH,
    runDir,
  );
  const blockSelectorPromptPath = writePromptFile(
    runDir,
    "block-selector",
    blockSelectorPrompt,
  );

  const copyWriterPrompt = buildCopyWriterPrompt(
    sectionPlan,
    profile.name,
    profile.description,
    profile.audience,
    profile.tone ?? "professional",
    profile.features,
    VOCAB_PATH,
    runDir,
  );
  const copyWriterPromptPath = writePromptFile(
    runDir,
    "copy-writer",
    copyWriterPrompt,
  );

  console.log(`  📝 Block Selector prompt: ${blockSelectorPromptPath}`);
  console.log(`  📝 Copy Writer prompt: ${copyWriterPromptPath}`);
  console.log(
    "  ⏳ In Claude Code, both agents spawn in parallel via Promise.all().",
  );

  // Check for or generate default outputs for CLI testing
  const blockSelectionsPath = resolve(runDir, "block-selections.yaml");
  const copyPath = resolve(runDir, "copy.yaml");

  if (!existsSync(blockSelectionsPath)) {
    console.log("  🔧 Generating default block selections for CLI testing...");
    const defaultSelections = generateDefaultBlockSelections(
      sectionPlan,
      filteredCatalogs,
    );
    writeYaml(blockSelectionsPath, defaultSelections);
    console.log("  ✅ Default block selections written");
  }

  if (!existsSync(copyPath)) {
    console.log("  🔧 Generating default copy for CLI testing...");
    const defaultCopy = generateDefaultCopy(sectionPlan, profile);
    writeYaml(copyPath, defaultCopy);
    console.log("  ✅ Default copy written");
  }

  const blockSelections = readYaml<BlockSelection>(blockSelectionsPath);
  const sectionCopy = readYaml<SectionCopy>(copyPath);

  console.log(
    `  ✅ Block selections loaded: ${blockSelections.sections.length} blocks`,
  );
  console.log(`  ✅ Copy loaded: ${sectionCopy.sections.length} sections`);

  // Step 8: Install blocks via CLI
  console.log("\n🟡 Step 6: Installing blocks via shadcn CLI...");
  stepStart = performance.now();
  const blockNames = blockSelections.sections.map((s) => s.block_name);
  const alternativesMap = new Map<string, string[]>();
  for (const s of blockSelections.sections) {
    if (s.alternatives.length > 0) {
      alternativesMap.set(s.block_name, s.alternatives);
    }
  }
  const installResults = installBlocks(blockNames, PROJECT_ROOT, alternativesMap);

  let installed = 0;
  let failed = 0;
  for (const result of installResults) {
    if (result.success) {
      installed++;
      console.log(`  ✅ ${result.block_name} → ${result.installed_path}`);
    } else {
      failed++;
      console.log(`  ❌ ${result.block_name}: ${result.error}`);
    }
  }
  console.log(`  📊 Installed: ${installed}/${blockNames.length} (${failed} failed)`);
  timings.set("block_install", performance.now() - stepStart);

  // Step 9: Run Assembler agent
  console.log("\n🟡 Step 7: Running Assembler agent...");
  mkdirSync(resolve(OUTPUT_DIR, "components"), { recursive: true });

  const assemblerPrompt = buildAssemblerPrompt(
    blockSelections,
    sectionCopy,
    theme,
    PROJECT_ROOT,
    OUTPUT_DIR,
    undefined, // assetManifest — populated after Phase 3 Asset Generator runs
  );
  const assemblerPromptPath = writePromptFile(
    runDir,
    "assembler",
    assemblerPrompt,
  );
  console.log(`  📝 Assembler prompt: ${assemblerPromptPath}`);
  console.log(
    "  ⏳ In Claude Code, Assembler agent reads block source, applies copy + theme, writes output.",
  );

  // Step 10: Write theme.css to output
  writeFileSync(resolve(OUTPUT_DIR, "theme.css"), themeCSS, "utf-8");
  console.log(`  ✅ Theme CSS written to ${OUTPUT_DIR}/theme.css`);

  // Step 11: Run Theme Validator
  console.log("\n🟡 Step 8: Theme validation...");
  console.log(
    "  ⏳ Run: npx tsx scripts/theme-validator.ts output/components/*.tsx",
  );
  console.log("  (Theme Validator runs post-assembly on actual output files)");

  // ---------------------------------------------------------------------------
  // Phase 3: Asset Generation + QA Loop
  // ---------------------------------------------------------------------------

  // Step 12: Asset Generator
  console.log("\n🟡 Step 9: Running Asset Generator agent...");
  stepStart = performance.now();
  const moodboardPaths = getMoodboardImagePaths(MOODBOARD_DIR);
  const assetsDir = resolve(runDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  mkdirSync(resolve(OUTPUT_DIR, "assets"), { recursive: true });

  const assetGeneratorPrompt = buildAssetGeneratorPrompt(
    sectionPlan,
    theme,
    runDir,
    moodboardPaths,
  );
  const assetGeneratorPromptPath = writePromptFile(
    runDir,
    "asset-generator",
    assetGeneratorPrompt,
  );
  console.log(`  📝 Asset Generator prompt: ${assetGeneratorPromptPath}`);
  console.log(`  📸 Moodboard references: ${moodboardPaths.length} images`);
  console.log(
    "  ⏳ In Claude Code, Asset Generator spawns to generate images via Gemini API.",
  );

  // Check for existing asset manifest (agent already ran or generate default)
  const assetManifestPath = resolve(runDir, "asset-manifest.yaml");
  if (!existsSync(assetManifestPath)) {
    console.log("  🔧 Generating default asset manifest for CLI testing...");
    const defaultManifest = generateDefaultAssetManifest(sectionPlan);
    writeYaml(assetManifestPath, defaultManifest);
    console.log("  ✅ Default asset manifest written (all fallbacks)");
  }

  const assetManifest = readYaml<AssetManifest>(assetManifestPath);
  const assetsGenerated = assetManifest.assets.filter((a) => a.success).length;
  const assetsFallback = assetManifest.assets.filter((a) => a.fallbackUsed).length;
  console.log(
    `  📊 Assets: ${assetsGenerated} generated, ${assetsFallback} fallback`,
  );
  timings.set("asset_generation", performance.now() - stepStart);

  // Step 13: QA Loop
  console.log("\n🟡 Step 10: Running QA loop...");
  stepStart = performance.now();
  const convergenceState: QAConvergenceState = {
    iterations: [],
    maxIterations: 3,
    currentIteration: 0,
    converged: false,
    shippedWithIssues: false,
  };

  while (!convergenceState.converged && convergenceState.currentIteration < MAX_QA_ITERATIONS) {
    const iteration = convergenceState.currentIteration;
    const previousIssues = iteration > 0
      ? convergenceState.iterations[iteration - 1]?.issues
      : undefined;

    console.log(`\n  📋 QA Iteration ${iteration + 1}/${MAX_QA_ITERATIONS}`);

    const qaPrompt = buildQAAgentPrompt(
      runDir,
      OUTPUT_DIR,
      iteration,
      previousIssues,
    );
    writePromptFile(runDir, `qa-agent-${iteration}`, qaPrompt);

    // Check for existing QA result (agent already ran or generate default)
    const qaResultPath = resolve(runDir, `qa-result-${iteration}.yaml`);
    if (!existsSync(qaResultPath)) {
      console.log("  🔧 Generating default QA result for CLI testing...");
      const defaultResult = generateDefaultQAResult(iteration);
      writeYaml(qaResultPath, defaultResult);
    }

    const qaResult = readYaml<QAResult>(qaResultPath);
    convergenceState.iterations.push(qaResult);

    if (qaResult.passed) {
      convergenceState.converged = true;
      console.log(`  ✅ QA passed: L1=${qaResult.levels.l1_technical}, L2=${qaResult.levels.l2_theme}, L3=${qaResult.levels.l3_design}`);
    } else {
      const issueCount = qaResult.issues.length;
      const prevCount = previousIssues?.length ?? 0;

      if (previousIssues && issueCount > prevCount) {
        console.log(`  ⚠️  Issues INCREASING (${prevCount} → ${issueCount}) — structural problem detected`);
        // SC-006: Identify stable sections to lock
        const prevSectionIds = new Set(previousIssues.map((i) => i.sectionId));
        const currSectionIds = new Set(qaResult.issues.map((i) => i.sectionId));
        const stableSections = sectionPlan.sections
          .filter((s) => !prevSectionIds.has(s.id) && !currSectionIds.has(s.id))
          .map((s) => s.id);
        console.log(`  🔒 Locked sections: ${stableSections.join(", ") || "none"}`);
      } else {
        console.log(`  🔄 ${issueCount} issues found — routing fixes to agents`);
        for (const issue of qaResult.issues) {
          console.log(`     [${issue.severity}] ${issue.type} in ${issue.sectionId} → ${issue.routeTo}`);
        }
      }

      convergenceState.currentIteration++;
    }
  }

  if (!convergenceState.converged) {
    convergenceState.shippedWithIssues = true;
    const remainingIssues = convergenceState.iterations[convergenceState.iterations.length - 1]?.issues ?? [];
    console.log(`\n  ⚠️  QA did not converge after ${MAX_QA_ITERATIONS} iterations. Shipping with ${remainingIssues.length} issues.`);
  }

  timings.set("qa_loop", performance.now() - stepStart);

  // Write convergence state
  writeYaml(resolve(runDir, "qa-convergence.yaml"), convergenceState);

  // Step 14: Final report
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("## Pipeline Complete");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`  Run ID:      ${runId}`);
  console.log(`  Run Dir:     ${runDir}`);
  console.log(`  Theme:       ${theme.name}`);
  console.log(`  Sections:    ${sectionPlan.sections.length}`);
  console.log(`  Blocks:      ${installed} installed, ${failed} failed`);
  console.log(`  Assets:      ${assetsGenerated} generated, ${assetsFallback} fallback`);
  console.log(`  QA:          ${convergenceState.converged ? "Converged" : "Shipped with issues"} (${convergenceState.iterations.length} iterations)`);
  console.log(`  Output Dir:  ${OUTPUT_DIR}`);
  const totalRuntime = performance.now() - pipelineStart;
  timings.set("total", totalRuntime);

  console.log("\n  ## Timing Breakdown");
  for (const [step, ms] of timings) {
    console.log(`    ${step.padEnd(20)} ${Math.round(ms)}ms`);
  }

  console.log("\n  Artifacts in run directory:");
  console.log("    theme.yaml             — Derived theme");
  console.log("    theme.css              — Generated CSS variables");
  console.log("    section-plan.yaml      — Strategist output");
  console.log("    block-selections.yaml  — Block Selector output");
  console.log("    copy.yaml              — Copy Writer output");
  console.log("    asset-manifest.yaml    — Asset Generator results");
  console.log("    qa-convergence.yaml    — QA loop results");
  console.log("    assets/                — Generated images");
  console.log("    *-prompt.md            — Agent prompts (for debugging)");
  console.log("\n  Output files:");
  console.log("    output/theme.css            — Theme CSS");
  console.log("    output/page.tsx             — Composed page (after Assembler)");
  console.log("    output/components/*.tsx      — Section components (after Assembler)");
  console.log("    output/assets/*.png          — Generated images");
  console.log("\n  Next steps:");
  console.log("    1. In Claude Code: run agents using the prompt files");
  console.log("    2. Run: npx tsx scripts/theme-validator.ts output/components/*.tsx");
  console.log("    3. Run: npm run dev — verify page renders");
  console.log("    4. Run: npm run build — verify build succeeds");
  console.log("");
}

// ---------------------------------------------------------------------------
// Default generators (for CLI testing without Claude Code agents)
// ---------------------------------------------------------------------------

function generateDefaultSectionPlan(profile: BusinessProfile): SectionPlan {
  const sections: SectionPlan["sections"] = [
    {
      id: "navbar",
      purpose: "navbar",
      title_hint: profile.name,
      layout_preference: "single-column",
      visual_requirement: "icon-cluster",
    },
    {
      id: "hero",
      purpose: "hero",
      title_hint: `${profile.description.split(".")[0]}`,
      layout_preference: "centered-stack",
      visual_requirement: "illustration",
    },
  ];

  // Add feature sections
  if (profile.features.length <= 3) {
    sections.push({
      id: "features",
      purpose: "features",
      title_hint: "What we offer",
      layout_preference:
        profile.features.length >= 3 ? "bento-asymmetric" : "grid-uniform",
      visual_requirement: "icon-cluster",
    });
  } else {
    sections.push({
      id: "features-1",
      purpose: "features",
      title_hint: "Core capabilities",
      layout_preference: "bento-asymmetric",
      visual_requirement: "icon-cluster",
    });
    sections.push({
      id: "features-2",
      purpose: "features",
      title_hint: "More features",
      layout_preference: "grid-uniform",
      visual_requirement: "icon-cluster",
    });
  }

  // Add optional sections based on feature count
  if (profile.features.length >= 3) {
    sections.push({
      id: "testimonials",
      purpose: "testimonials",
      title_hint: "What people say",
      layout_preference: "grid-uniform",
      visual_requirement: "photography",
    });
  }

  if (profile.features.length >= 4) {
    sections.push({
      id: "stats",
      purpose: "stats",
      title_hint: "By the numbers",
      layout_preference: "grid-uniform",
      visual_requirement: "decorative",
    });
  }

  if (profile.features.length >= 5) {
    sections.push({
      id: "logos",
      purpose: "logos",
      title_hint: "Trusted by",
      layout_preference: "single-column",
      visual_requirement: "icon-cluster",
    });
  }

  sections.push({
    id: "cta",
    purpose: "cta",
    title_hint: `Get started with ${profile.name}`,
    layout_preference: "centered-stack",
    visual_requirement: "decorative",
  });

  sections.push({
    id: "footer",
    purpose: "footer",
    title_hint: profile.name,
    layout_preference: "grid-uniform",
    visual_requirement: "icon-cluster",
  });

  return { sections };
}

function generateDefaultBlockSelections(
  plan: SectionPlan,
  catalogs: Map<string, BlockEntry[]>,
): BlockSelection {
  const sections: BlockSelection["sections"] = [];

  for (const section of plan.sections) {
    const candidates = catalogs.get(section.id) ?? [];
    const selected = candidates[0];

    if (selected) {
      sections.push({
        section_id: section.id,
        block_name: selected.name,
        category: selected.category,
        customization_notes: `Replace placeholder content with ${section.purpose} copy`,
        alternatives: candidates.slice(1, 4).map((c) => c.name),
      });
    } else {
      // No candidates found — use a generic fallback name
      sections.push({
        section_id: section.id,
        block_name: `${section.purpose}1`,
        category: section.purpose,
        customization_notes: `No pre-filtered candidates — use generic ${section.purpose} block`,
        alternatives: [],
      });
    }
  }

  return { sections };
}

function generateDefaultCopy(
  plan: SectionPlan,
  profile: BusinessProfile,
): SectionCopy {
  const sections: SectionCopy["sections"] = [];

  for (const section of plan.sections) {
    switch (section.purpose) {
      case "navbar":
        sections.push({
          section_id: section.id,
          headline: profile.name,
          subtext: "",
        });
        break;
      case "hero":
        sections.push({
          section_id: section.id,
          headline: `Build something ${profile.tone === "bold" ? "extraordinary" : "remarkable"} with ${profile.name}`,
          headline_accent_phrase:
            profile.tone === "bold" ? "extraordinary" : "remarkable",
          subtext: profile.description,
          cta_text: "Get Started",
        });
        break;
      case "features":
        sections.push({
          section_id: section.id,
          headline: "Everything you need",
          headline_accent_phrase: "you need",
          subtext: `Built for ${profile.audience}`,
          bullet_points: profile.features.map(
            (f) => `${f.title}: ${f.description}`,
          ),
        });
        break;
      case "testimonials":
        sections.push({
          section_id: section.id,
          headline: "Trusted by teams everywhere",
          headline_accent_phrase: "everywhere",
          subtext: "See what our customers have to say",
          testimonial_quote: `${profile.name} transformed how we work. Highly recommended.`,
        });
        break;
      case "stats":
        sections.push({
          section_id: section.id,
          headline: "Results that speak",
          headline_accent_phrase: "speak",
          subtext: "Our impact by the numbers",
        });
        break;
      case "logos":
        sections.push({
          section_id: section.id,
          headline: "Trusted by innovative teams",
          subtext: "",
        });
        break;
      case "cta":
        sections.push({
          section_id: section.id,
          headline: `Ready to get started?`,
          headline_accent_phrase: "get started",
          subtext: `Join ${profile.audience} already using ${profile.name}`,
          cta_text: "Start Free Trial",
        });
        break;
      case "footer":
        sections.push({
          section_id: section.id,
          headline: profile.name,
          subtext: profile.description,
        });
        break;
      default:
        sections.push({
          section_id: section.id,
          headline: section.title_hint,
          subtext: "",
        });
    }
  }

  return { sections };
}

// ---------------------------------------------------------------------------
// Phase 3 default generators
// ---------------------------------------------------------------------------

function generateDefaultAssetManifest(plan: SectionPlan): AssetManifest {
  const skipPurposes = new Set(["navbar", "footer"]);
  const assets = plan.sections
    .filter((s) => !skipPurposes.has(s.purpose))
    .map((s) => ({
      sectionId: s.id,
      success: false,
      fallbackUsed: true,
    }));
  return { assets };
}

function generateDefaultQAResult(iteration: number): QAResult {
  return {
    iteration,
    passed: true,
    issues: [],
    levels: {
      l1_technical: true,
      l2_theme: true,
      l3_design: true,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI entry point — only runs when this file is the direct entry point
// ---------------------------------------------------------------------------

const isCLI =
  process.argv[1]?.endsWith("orchestrator.ts") ||
  process.argv[1]?.endsWith("orchestrator.js");

if (isCLI) {
  const profileArg = process.argv[2];

  if (!profileArg) {
    console.log(
      "Usage: npx tsx pipeline/orchestrator.ts <business-profile.yaml>",
    );
    console.log(
      "\nRuns the Siphio landing page pipeline from business profile to assembled page.",
    );
    console.log("\nExample:");
    console.log(
      "  npx tsx pipeline/orchestrator.ts pipeline/input/sample-business-profile.yaml",
    );
    process.exit(0);
  }

  runPipeline(profileArg).catch((err) => {
    console.error("\n❌ Pipeline failed:", err.message);
    process.exit(1);
  });
}
