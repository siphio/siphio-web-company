// Shared YAML read/write helpers — consistent options across the pipeline
// Pattern: mirrors yaml usage in scripts/build-catalog.ts

import { readFileSync, writeFileSync } from "fs";
import yaml from "js-yaml";

export function readYaml<T>(path: string): T {
  const content = readFileSync(path, "utf-8");
  return yaml.load(content) as T;
}

export function writeYaml(path: string, data: unknown): void {
  const content = yaml.dump(data, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
  writeFileSync(path, content, "utf-8");
}
