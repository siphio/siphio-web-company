import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import type { InstallResult } from "./types";

/**
 * Installs shadcn blocks serially via CLI.
 *
 * Blocks are installed one at a time — never concurrently — because the
 * shadcn CLI mutates shared project files (tailwind config, globals.css, etc.)
 * and concurrent runs against the same project directory will corrupt state.
 *
 * Expects SHADCNBLOCKS_API_KEY to already be set in process.env.
 */
export function installBlocks(
  blockNames: string[],
  projectDir: string
): InstallResult[] {
  const results: InstallResult[] = [];

  for (const name of blockNames) {
    const result = installSingleBlock(name, projectDir);
    results.push(result);
  }

  return results;
}

function installSingleBlock(
  blockName: string,
  projectDir: string
): InstallResult {
  const command = `npx shadcn@latest add @shadcnblocks/${blockName} --yes --overwrite --silent`;

  try {
    execSync(command, {
      cwd: projectDir,
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const installedPath = resolve(
      projectDir,
      "src",
      "components",
      `${blockName}.tsx`
    );

    if (existsSync(installedPath)) {
      return {
        block_name: blockName,
        success: true,
        installed_path: installedPath,
      };
    }

    // CLI succeeded but expected file not found at the conventional path.
    // The block may have installed to a different location or structure.
    return {
      block_name: blockName,
      success: true,
      installed_path: undefined,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown installation error";

    return {
      block_name: blockName,
      success: false,
      error: message,
    };
  }
}
