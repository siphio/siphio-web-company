import { readFileSync } from 'fs';
import yaml from 'js-yaml';

// Business Profile Validator — checks YAML input against business-profile.schema.yaml constraints
// Reference: PRD SC-001, SC-002

interface ValidationError {
  field: string;
  message: string;
}

interface Feature {
  title?: unknown;
  description?: unknown;
}

interface BrandColors {
  primary?: unknown;
  secondary?: unknown;
}

interface BusinessProfile {
  name?: unknown;
  description?: unknown;
  features?: unknown;
  audience?: unknown;
  industry?: unknown;
  tone?: unknown;
  brand_colors?: unknown;
}

// Valid enum values from schema
const VALID_INDUSTRIES = [
  'fintech', 'saas', 'agency', 'ecommerce',
  'education', 'health', 'devtools', 'ai', 'crypto', 'general',
];

const VALID_TONES = ['professional', 'friendly', 'bold', 'minimal'];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function validateProfile(profile: BusinessProfile): ValidationError[] {
  const errors: ValidationError[] = [];

  // --- Required fields ---

  // name: string, 1-100 chars
  if (profile.name === undefined || profile.name === null) {
    errors.push({ field: 'name', message: 'Required field is missing' });
  } else if (typeof profile.name !== 'string') {
    errors.push({ field: 'name', message: 'Must be a string' });
  } else if (profile.name.length < 1 || profile.name.length > 100) {
    errors.push({ field: 'name', message: 'Must be 1-100 characters' });
  }

  // description: string, 10-500 chars
  if (profile.description === undefined || profile.description === null) {
    errors.push({ field: 'description', message: 'Required field is missing' });
  } else if (typeof profile.description !== 'string') {
    errors.push({ field: 'description', message: 'Must be a string' });
  } else if (profile.description.length < 10) {
    errors.push({ field: 'description', message: 'Must be at least 10 characters' });
  } else if (profile.description.length > 500) {
    errors.push({ field: 'description', message: 'Must be at most 500 characters' });
  }

  // features: array, 1-8 items
  if (profile.features === undefined || profile.features === null) {
    errors.push({ field: 'features', message: 'Required field is missing' });
  } else if (!Array.isArray(profile.features)) {
    errors.push({ field: 'features', message: 'Must be an array' });
  } else {
    if (profile.features.length < 1) {
      errors.push({ field: 'features', message: 'Must have at least 1 item' });
    } else if (profile.features.length > 8) {
      errors.push({ field: 'features', message: 'Must have at most 8 items' });
    }

    // Validate each feature item
    (profile.features as unknown[]).forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        errors.push({ field: `features[${index}]`, message: 'Each feature must be an object' });
        return;
      }

      const feature = item as Feature;

      // feature.title: string, 1-80 chars
      if (feature.title === undefined || feature.title === null) {
        errors.push({ field: `features[${index}].title`, message: 'Required field is missing' });
      } else if (typeof feature.title !== 'string') {
        errors.push({ field: `features[${index}].title`, message: 'Must be a string' });
      } else if (feature.title.length < 1 || feature.title.length > 80) {
        errors.push({ field: `features[${index}].title`, message: 'Must be 1-80 characters' });
      }

      // feature.description: string, 1-200 chars
      if (feature.description === undefined || feature.description === null) {
        errors.push({ field: `features[${index}].description`, message: 'Required field is missing' });
      } else if (typeof feature.description !== 'string') {
        errors.push({ field: `features[${index}].description`, message: 'Must be a string' });
      } else if (feature.description.length < 1 || feature.description.length > 200) {
        errors.push({ field: `features[${index}].description`, message: 'Must be 1-200 characters' });
      }
    });
  }

  // audience: string, non-empty (1-200 chars per schema)
  if (profile.audience === undefined || profile.audience === null) {
    errors.push({ field: 'audience', message: 'Required field is missing' });
  } else if (typeof profile.audience !== 'string') {
    errors.push({ field: 'audience', message: 'Must be a string' });
  } else if (profile.audience.length < 1) {
    errors.push({ field: 'audience', message: 'Must be non-empty' });
  } else if (profile.audience.length > 200) {
    errors.push({ field: 'audience', message: 'Must be at most 200 characters' });
  }

  // --- Optional fields ---

  // industry: enum if provided
  if (profile.industry !== undefined && profile.industry !== null) {
    if (typeof profile.industry !== 'string') {
      errors.push({ field: 'industry', message: 'Must be a string' });
    } else if (!VALID_INDUSTRIES.includes(profile.industry)) {
      errors.push({
        field: 'industry',
        message: `Must be one of: ${VALID_INDUSTRIES.join(', ')}`,
      });
    }
  }

  // tone: enum if provided
  if (profile.tone !== undefined && profile.tone !== null) {
    if (typeof profile.tone !== 'string') {
      errors.push({ field: 'tone', message: 'Must be a string' });
    } else if (!VALID_TONES.includes(profile.tone)) {
      errors.push({
        field: 'tone',
        message: `Must be one of: ${VALID_TONES.join(', ')}`,
      });
    }
  }

  // brand_colors: object with hex colors if provided
  if (profile.brand_colors !== undefined && profile.brand_colors !== null) {
    if (typeof profile.brand_colors !== 'object' || Array.isArray(profile.brand_colors)) {
      errors.push({ field: 'brand_colors', message: 'Must be an object' });
    } else {
      const colors = profile.brand_colors as BrandColors;

      // primary is required within brand_colors (per schema: required: [primary])
      if (colors.primary === undefined || colors.primary === null) {
        errors.push({ field: 'brand_colors.primary', message: 'Required when brand_colors is provided' });
      } else if (typeof colors.primary !== 'string') {
        errors.push({ field: 'brand_colors.primary', message: 'Must be a string' });
      } else if (!HEX_COLOR_REGEX.test(colors.primary)) {
        errors.push({ field: 'brand_colors.primary', message: 'Must be a valid hex color (e.g. #3B82F6)' });
      }

      // secondary is optional within brand_colors
      if (colors.secondary !== undefined && colors.secondary !== null) {
        if (typeof colors.secondary !== 'string') {
          errors.push({ field: 'brand_colors.secondary', message: 'Must be a string' });
        } else if (!HEX_COLOR_REGEX.test(colors.secondary)) {
          errors.push({ field: 'brand_colors.secondary', message: 'Must be a valid hex color (e.g. #10B981)' });
        }
      }
    }
  }

  return errors;
}

// CLI entry point
const profilePath = process.argv[2];

if (!profilePath) {
  console.log('Usage: npx tsx scripts/validate-profile.ts <business-profile.yaml>');
  console.log('Validates a business profile YAML file against the schema.');
  process.exit(0);
}

try {
  const fileContent = readFileSync(profilePath, 'utf-8');
  const profile = yaml.load(fileContent) as BusinessProfile;

  if (!profile || typeof profile !== 'object') {
    console.error('❌ Invalid YAML: file does not contain a valid object');
    process.exit(1);
  }

  const errors = validateProfile(profile);

  if (errors.length === 0) {
    console.log(`✅ Profile is valid: ${profilePath}`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${errors.length} validation error(s) in ${profilePath}:\n`);
    for (const err of errors) {
      console.log(`  ${err.field}: ${err.message}`);
    }
    console.log('');
    process.exit(1);
  }
} catch (err: any) {
  if (err.code === 'ENOENT') {
    console.error(`❌ File not found: ${profilePath}`);
  } else if (err.name === 'YAMLException') {
    console.error(`❌ Invalid YAML syntax: ${err.message}`);
  } else {
    console.error(`❌ Error: ${err.message}`);
  }
  process.exit(1);
}
