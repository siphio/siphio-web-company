// QA Agent — prompt builder
// Constructs a prompt for the Claude Code Agent Tool sub-agent that evaluates
// assembled landing page output across 3 levels: technical, theme, design quality.
// Reference: PRD Phase 3, SC-005, SC-006, Section 4.2

import type { QAResult, QAIssue } from "../lib/qa-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format previous issues for regression detection. */
function formatPreviousIssues(issues: QAIssue[]): string {
  if (issues.length === 0) return "No previous issues.";
  return issues
    .map(
      (i) =>
        `- [${i.severity}] ${i.type} in ${i.sectionId}: ${i.description} → route to ${i.routeTo}`,
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

export function buildQAAgentPrompt(
  runDir: string,
  outputDir: string,
  iteration: number,
  previousIssues?: QAIssue[],
): string {
  const prevIssuesText = previousIssues
    ? formatPreviousIssues(previousIssues)
    : "This is the first QA iteration.";

  const regressionWarning =
    previousIssues && previousIssues.length > 0
      ? `
## Regression Detection

Previous iteration had ${previousIssues.length} issues. If the current evaluation finds MORE issues than before, this indicates a structural problem — note this in your result.

Previous issues:
${prevIssuesText}`
      : "";

  return `You are the QA Agent for the Siphio landing page pipeline. Your job is to evaluate the assembled landing page output across 3 levels and identify issues for targeted remediation.

## Iteration: ${iteration + 1} of 3 max
${regressionWarning}

## Evaluation Levels

### Level 1: Technical Validation

Check that all output files are valid:

1. Run \`npx tsc --noEmit\` on the output directory to check for TypeScript errors
2. Verify all \`.tsx\` files in \`${outputDir}/components/\` have valid imports
3. Check that \`${outputDir}/page.tsx\` exists and imports all section components
4. Verify no undefined references or missing modules

**Pass criteria**: Zero TypeScript compilation errors in output files.

### Level 2: Theme Compliance

Run the theme validator script on each output component:

\`\`\`bash
npx tsx scripts/theme-validator.ts ${outputDir}/components/{component}.tsx
\`\`\`

Also manually check:
1. All colors use CSS variables (\`var(--accent-primary)\`, \`var(--background)\`, etc.) — no hardcoded hex/rgb values
2. Fonts use theme variables (\`var(--font-heading)\`, \`var(--font-body)\`, \`var(--font-accent)\`)
3. No hardcoded pixel values for spacing where theme variables exist
4. \`${outputDir}/theme.css\` exists and defines all required CSS variables

**Pass criteria**: Theme validator reports zero violations.

### Level 3: Design Quality

Evaluate against the style profile checklist:

1. **Visual monotony**: Are adjacent sections using different layout patterns? Flag if two consecutive sections look structurally identical.
2. **Copy vocabulary**: Do headlines use terms from the controlled vocabulary? Read \`pipeline/vocabulary/controlled-vocabulary.yaml\` and check headline words against the word pools.
3. **Asset consistency**: If assets exist in \`${runDir}/assets/\`, are they consistent in style? (Skip if no assets generated.)
4. **Section flow**: Does the ordering follow PRD patterns? (navbar → hero → content → social proof → cta → footer)
5. **Mixed-font headlines**: Check if sections with \`headline_accent_phrase\` in the copy correctly wrap the accent phrase in italic serif styling.
6. **Animation wrappers**: If animation components are imported, verify hero headline is NOT animated (only subtitle + CTA should animate).

**Pass criteria**: No critical design quality issues.

## Issue Classification

For each issue found, classify it:

| Issue Type | Route To | When |
|------------|----------|------|
| \`theme_violation\` | assembler | Wrong color, font, or spacing values |
| \`visual_monotony\` | block-selector | Adjacent sections too similar in layout |
| \`copy_mismatch\` | copy-writer | Vocabulary violation or tone inconsistency |
| \`asset_quality\` | asset-generator | Generated image doesn't match style profile |
| \`structural\` | assembler | Missing imports, broken JSX, compilation error |

Severity:
- \`critical\`: Must fix before shipping (compilation errors, broken rendering, WCAG violations)
- \`warning\`: Should fix but page still functions (minor theme deviations, style inconsistencies)

## Output

Write your evaluation to \`${runDir}/qa-result-${iteration}.yaml\` using the Write tool:

\`\`\`yaml
iteration: ${iteration}
passed: true  # or false if any critical issues found
issues:
  - type: "theme_violation"
    severity: "critical"
    sectionId: "hero"
    description: "Hardcoded #3B82F6 instead of var(--accent-primary)"
    routeTo: "assembler"
levels:
  l1_technical: true
  l2_theme: true
  l3_design: true
\`\`\`

If all three levels pass with zero critical issues, set \`passed: true\`.
If any critical issue exists, set \`passed: false\`.
Warnings alone do not cause failure — document them but still pass.

## Process

1. Read all files in \`${outputDir}/components/\` and \`${outputDir}/page.tsx\`
2. Run Level 1 checks (TypeScript compilation)
3. Run Level 2 checks (theme validator script)
4. Run Level 3 checks (design quality evaluation)
5. Compile all issues with classifications
6. Write the result YAML file
7. Summarize findings in terminal: total issues by type and severity

After writing the result, confirm the pass/fail status and list any critical issues.`;
}
