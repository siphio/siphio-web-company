/**
 * Asset Types for PIV Phase 3 - Asset Generation
 * Cascading prompt configuration for Nano Banana 2 image generation pipeline
 *
 * References:
 * - PRD Phase 3: Asset Generation & QA Loop
 * - Nano Banana 2 Profile: Multi-reference image generation with controlled vocabulary
 * - Style Profile: Friendly-modern SaaS, soft gradients, flat illustration, light backgrounds
 */

/**
 * Represents an asset category with size, aspect ratio, and cascading prompt configuration
 */
export interface AssetCategory {
  /** Human-readable category name */
  name: string;
  /** Target image size for generation */
  imageSize: "512px" | "1K" | "2K";
  /** Target aspect ratio (e.g., "16:9", "1:1", "3:2") */
  aspectRatio: string;
  /** Base prompt establishing overall aesthetic and constraints */
  basePrompt: string;
  /** Category-specific prompt for detailed context */
  categoryPrompt: string;
}

/**
 * Represents a single asset generation request with context and references
 */
export interface AssetRequest {
  /** Section ID from the landing page structure */
  sectionId: string;
  /** Asset category defining size and prompt strategy */
  category: AssetCategory;
  /** Specific prompt for this unique asset */
  specificPrompt: string;
  /** Reference images for style and composition guidance (up to 14) */
  referenceImages: Buffer[];
}

/**
 * Represents the result of a single asset generation attempt
 */
export interface AssetResult {
  /** Section ID this asset was generated for */
  sectionId: string;
  /** Whether generation succeeded */
  success: boolean;
  /** Path to generated image (if successful) */
  imagePath?: string;
  /** Whether a fallback/cached image was used */
  fallbackUsed: boolean;
}

/**
 * Manifest tracking all generated assets for a landing page
 */
export interface AssetManifest {
  /** Array of asset generation results */
  assets: AssetResult[];
}

/**
 * Asset category presets with cascading prompts
 * Each category follows the style profile aesthetic:
 * - Friendly-modern SaaS illustration style
 * - Soft gradients and flat design
 * - Light/white backgrounds with rounded shapes
 * - No text overlays
 */
export const ASSET_CATEGORIES: Record<string, AssetCategory> = {
  hero: {
    name: "Hero Section",
    imageSize: "2K",
    aspectRatio: "16:9",
    basePrompt:
      "Illustration in friendly modern SaaS style. Soft gradients, flat design aesthetic. No text. Light background, rounded organic shapes. Warm, inviting, approachable tone. High-quality vector art style.",
    categoryPrompt:
      "Wide landscape illustration for hero section. Scenic, expansive composition. Abstract landscape with rolling hills, soft sky, gentle color transitions. Emphasis on negative space and whitespace.",
  },
  "feature-icon": {
    name: "Feature Icon",
    imageSize: "512px",
    aspectRatio: "1:1",
    basePrompt:
      "Flat icon illustration in friendly modern SaaS style. Minimal, clean design. No text. White/light background. Rounded, soft shapes with smooth curves.",
    categoryPrompt:
      "Single feature icon for capability highlight. Abstract symbol representing a concept. Balanced composition, centered, versatile enough to pair with multiple heading styles.",
  },
  "bento-card": {
    name: "Bento Card",
    imageSize: "1K",
    aspectRatio: "3:2",
    basePrompt:
      "Abstract decorative illustration for bento grid card. Friendly modern SaaS aesthetic. Soft gradients, flat design, rounded shapes. No text. Light background.",
    categoryPrompt:
      "Card-sized abstract composition. Decorative accent illustration. Subtle pattern or texture element. Works as background or subtle visual interest without dominating content.",
  },
  "background-texture": {
    name: "Background Texture",
    imageSize: "2K",
    aspectRatio: "16:9",
    basePrompt:
      "Subtle background texture pattern in friendly modern SaaS style. Soft gradient foundation with minimal geometric or organic pattern overlay. No text. White/light color palette.",
    categoryPrompt:
      "Soft, unobtrusive background layer. Provides visual depth without competing for attention. Works as subtle texture beneath content sections. Minimal contrast, calming aesthetic.",
  },
  decorative: {
    name: "Decorative Element",
    imageSize: "1K",
    aspectRatio: "1:1",
    basePrompt:
      "Small decorative accent element in friendly modern SaaS style. Flat illustration, soft colors, rounded shapes. No text. Light background. Minimal, versatile design.",
    categoryPrompt:
      "Decorative flourish for spacing or visual punctuation. Abstract shape or small ornamental element. Works across multiple page sections. Subtle, supporting role.",
  },
};
