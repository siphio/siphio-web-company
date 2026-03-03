/**
 * QA Evaluation Types for Pipeline
 * References: PRD Section 4.2 (QA Issue Routing and Convergence Check decision trees)
 */

/**
 * QA issue categories
 * Each type routes to a specific agent for remediation
 */
export type QAIssueType =
  | "theme_violation"
  | "visual_monotony"
  | "copy_mismatch"
  | "asset_quality"
  | "structural";

/**
 * Agent targets for issue routing
 * Determines which agent receives remediation request
 */
export type QARouteTarget =
  | "assembler"
  | "block-selector"
  | "copy-writer"
  | "asset-generator";

/**
 * Individual QA issue identified during evaluation
 */
export interface QAIssue {
  type: QAIssueType;
  severity: "critical" | "warning";
  sectionId: string;
  description: string;
  routeTo: QARouteTarget;
}

/**
 * Results from a single QA evaluation pass
 */
export interface QAResult {
  iteration: number;
  passed: boolean;
  issues: QAIssue[];
  levels: {
    l1_technical: boolean;
    l2_theme: boolean;
    l3_design: boolean;
  };
}

/**
 * Convergence state tracking across QA iterations
 * Manages the iteration loop with max 3 attempts before shipping
 */
export interface QAConvergenceState {
  iterations: QAResult[];
  maxIterations: 3;
  currentIteration: number;
  converged: boolean;
  shippedWithIssues: boolean;
}

/**
 * Routes each issue type to its remediation agent
 * Decision tree from PRD Section 4.2
 */
export const ISSUE_ROUTE_MAP: Record<QAIssueType, QARouteTarget> = {
  theme_violation: "assembler",
  visual_monotony: "block-selector",
  copy_mismatch: "copy-writer",
  asset_quality: "asset-generator",
  structural: "assembler",
};
