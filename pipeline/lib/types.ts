// Pipeline state interfaces — used by all agents and the orchestrator
// Reference: PRD Phase 2, Section 6 (Architecture)

import type { BusinessProfile, Theme } from "@/lib/theme/types";

// --- Strategist output ---

export interface SectionEntry {
  id: string;
  purpose: string;
  title_hint: string;
  feature_index?: number;
  layout_preference: string;
  visual_requirement: string;
}

export interface SectionPlan {
  sections: SectionEntry[];
}

// --- Block Selector output ---

export interface BlockChoice {
  section_id: string;
  block_name: string;
  category: string;
  customization_notes: string;
  alternatives: string[];
}

export interface BlockSelection {
  sections: BlockChoice[];
}

// --- Copy Writer output ---

export interface CopyEntry {
  section_id: string;
  headline: string;
  headline_accent_phrase?: string;
  subtext: string;
  cta_text?: string;
  bullet_points?: string[];
  testimonial_quote?: string;
}

export interface SectionCopy {
  sections: CopyEntry[];
}

// --- Pipeline run state ---

export interface PipelineRun {
  id: string;
  profile: BusinessProfile;
  theme: Theme;
  plan: SectionPlan;
  blocks: BlockSelection;
  copy: SectionCopy;
  run_dir: string;
  output_dir: string;
}

// --- Block catalog entry (matches block-catalog.yaml structure) ---

export interface BlockTags {
  section_purpose: string;
  mood: string;
  density: string;
  layout: string;
}

export interface BlockEntry {
  name: string;
  category: string;
  description: string;
  screenshot_url: string;
  landing_page_relevant: boolean;
  tags?: BlockTags;
}

export interface BlockCatalog {
  generated_at: string;
  total_count: number;
  landing_page_relevant_count: number;
  categories: Record<string, number>;
  blocks: BlockEntry[];
}

// --- Pairing rules (matches pairing-rules.yaml structure) ---

export interface PairingRule {
  pairs_well_with: string[];
  never_after: string[];
  max_adjacent_same_density: number;
  notes?: string;
}

export interface PairingRules {
  rules: Record<string, PairingRule>;
}

// --- Block installer result ---

export interface InstallResult {
  block_name: string;
  success: boolean;
  installed_path?: string;
  error?: string;
}
