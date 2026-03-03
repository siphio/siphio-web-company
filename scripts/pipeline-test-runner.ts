// Pipeline test runner — runs Siphio pipeline against all test profiles
// Reports pass/fail, section count, QA convergence, and runtime per profile
//
// Usage: npx tsx scripts/pipeline-test-runner.ts

import { readdirSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { performance } from "perf_hooks";
import yaml from "js-yaml";

import { runPipeline } from "../pipeline/orchestrator";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(__dirname, "..");
const PROFILES_DIR = resolve(PROJECT_ROOT, "pipeline/input/profiles");
const SAMPLE_PROFILE = resolve(
  PROJECT_ROOT,
  "pipeline/input/sample-business-profile.yaml",
);

interface ProfileResult {
  name: string;
  file: string;
  features: number;
  industry: string;
  status: "pass" | "fail";
  error?: string;
  runtimeMs: number;
}

// ---------------------------------------------------------------------------
// Discover profiles
// ---------------------------------------------------------------------------

function discoverProfiles(): string[] {
  const profiles: string[] = [SAMPLE_PROFILE];

  try {
    const files = readdirSync(PROFILES_DIR);
    for (const file of files) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        profiles.push(join(PROFILES_DIR, file));
      }
    }
  } catch {
    console.log(`⚠️  Profiles directory not found: ${PROFILES_DIR}`);
  }

  return profiles;
}

// ---------------------------------------------------------------------------
// Run single profile
// ---------------------------------------------------------------------------

async function runProfile(profilePath: string): Promise<ProfileResult> {
  const raw = readFileSync(profilePath, "utf-8");
  const profile = yaml.load(raw) as Record<string, unknown>;
  const features = Array.isArray(profile.features)
    ? profile.features.length
    : 0;
  const name = (profile.name as string) ?? "unknown";
  const industry = (profile.industry as string) ?? "(none)";

  const start = performance.now();

  try {
    await runPipeline(profilePath);
    return {
      name,
      file: profilePath.replace(PROJECT_ROOT + "/", ""),
      features,
      industry,
      status: "pass",
      runtimeMs: performance.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name,
      file: profilePath.replace(PROJECT_ROOT + "/", ""),
      features,
      industry,
      status: "fail",
      error: message,
      runtimeMs: performance.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("## Siphio Pipeline Test Runner");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const profiles = discoverProfiles();
  console.log(`📋 Discovered ${profiles.length} profiles\n`);

  const results: ProfileResult[] = [];
  const totalStart = performance.now();

  for (const profilePath of profiles) {
    const shortName = profilePath.replace(PROJECT_ROOT + "/", "");
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🟡 Running: ${shortName}`);
    console.log("=".repeat(60));

    const result = await runProfile(profilePath);
    results.push(result);

    if (result.status === "pass") {
      console.log(`\n✅ ${result.name}: PASS (${Math.round(result.runtimeMs)}ms)`);
    } else {
      console.log(`\n❌ ${result.name}: FAIL — ${result.error}`);
    }
  }

  const totalRuntime = performance.now() - totalStart;

  // ---------------------------------------------------------------------------
  // Aggregate report
  // ---------------------------------------------------------------------------

  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("## Test Results");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Table header
  console.log(
    `${"Profile".padEnd(25)} ${"Industry".padEnd(12)} ${"Features".padEnd(10)} ${"Status".padEnd(8)} ${"Runtime".padEnd(10)}`,
  );
  console.log("-".repeat(70));

  for (const r of results) {
    const status = r.status === "pass" ? "✅ PASS" : "❌ FAIL";
    console.log(
      `${r.name.padEnd(25)} ${r.industry.padEnd(12)} ${String(r.features).padEnd(10)} ${status.padEnd(8)} ${Math.round(r.runtimeMs)}ms`,
    );
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log("-".repeat(70));
  console.log(
    `\n📊 Summary: ${passed}/${results.length} passed, ${failed} failed`,
  );
  console.log(`⏱️  Total runtime: ${Math.round(totalRuntime)}ms`);
  console.log(
    `⏱️  Average per profile: ${Math.round(totalRuntime / results.length)}ms`,
  );

  if (failed > 0) {
    console.log("\n❌ Failed profiles:");
    for (const r of results.filter((r) => r.status === "fail")) {
      console.log(`  ${r.name}: ${r.error}`);
    }
  }

  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n❌ Test runner crashed:", err.message);
  process.exit(1);
});
