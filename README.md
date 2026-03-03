# Siphio — Multi-Agent Landing Page Builder

Autonomously builds modern, polished landing pages from a business profile using AI agents, shadcnblocks.com premium components, and Nano Banana 2 image generation.

## Prerequisites

- Node.js 20+
- npm 10+
- shadcnblocks.com premium subscription
- Google Gemini API key (for Nano Banana 2 image generation)

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd siphio-web-company
   npm install
   ```

2. Create a `.env` file in the project root:
   ```
   SHADCNBLOCKS_API_KEY=your_shadcnblocks_api_key
   GOOGLE_GEMINI_API_KEY=your_gemini_api_key
   ```

3. Verify your setup:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

## Quick Start

1. Create a business profile YAML file (or use an existing one):
   ```bash
   cp pipeline/input/sample-business-profile.yaml my-profile.yaml
   # Edit my-profile.yaml with your business details
   ```

2. Run the pipeline:
   ```bash
   npm run pipeline -- my-profile.yaml
   ```

3. View the output:
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

## Business Profile Format

Create a YAML file with the following fields:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `name` | Yes | Company/product name | `"FlowBoard"` |
| `description` | Yes | One-sentence description | `"Project management for remote teams"` |
| `features` | Yes | Array of features (1-8) | See below |
| `audience` | Yes | Target audience description | `"Remote team leads"` |
| `industry` | No | Industry vertical | `saas`, `fintech`, `education`, `agency`, `ecommerce`, `health`, `devtools`, `ai`, `crypto` |
| `tone` | No | Brand voice | `professional`, `friendly`, `bold`, `minimal` |
| `brand_colors` | No | Custom brand colors | `primary: "#3B82F6"` |

Each feature has:
```yaml
features:
  - title: "Feature Name"
    description: "One-line benefit statement"
```

**Section count logic:**
- 1-2 features → 5 sections
- 3-4 features → 6-7 sections
- 5-8 features → 7-8 sections

## Pipeline Flow

The pipeline runs these steps automatically:

1. **Validate** — Checks your business profile against the schema
2. **Theme Derivation** — Generates a color palette, typography, and spacing from your profile + style preferences
3. **Strategist** — Plans the section flow (hero, features, testimonials, CTA, etc.)
4. **Catalog Filter** — Pre-filters the 1,300+ block library to relevant candidates per section
5. **Block Selector + Copy Writer** — Run in parallel: select optimal blocks and write conversion-focused copy
6. **Block Install** — Installs selected shadcn blocks via CLI
7. **Assembler** — Combines blocks + copy + theme into final components
8. **Asset Generator** — Creates illustrations and icons via Nano Banana 2 (or uses SVG fallbacks)
9. **QA Loop** — Evaluates design quality, routes fixes, iterates up to 3 times
10. **Output** — Final page and components written to `output/`

## Output Structure

```
output/
  theme.css            — CSS variables for the generated theme
  page.tsx             — Composed landing page
  components/*.tsx     — Individual section components
  assets/*.png         — Generated illustrations and icons
```

## Customization

### Style Profile
Edit `context/style-profile.yaml` to change the overall design aesthetic (color preferences, typography patterns, layout styles).

### Controlled Vocabulary
Edit `pipeline/vocabulary/controlled-vocabulary.yaml` to modify the word pools agents use for reasoning about design decisions.

### Pairing Rules
Edit `pipeline/vocabulary/pairing-rules.yaml` to control which block combinations work well together.

### Theme Template
Edit `src/lib/theme/theme-template.yaml` to change default theme values (fonts, spacing, colors).

## Testing

Run the full test suite across all test profiles:
```bash
npx tsx scripts/pipeline-test-runner.ts
```

Run the pipeline against a single profile:
```bash
npx tsx pipeline/orchestrator.ts pipeline/input/profiles/saas-startup.yaml
```

Validate theme compliance:
```bash
npx tsx scripts/theme-validator.ts output/theme.css
npx tsx scripts/theme-validator.ts output/components/*.tsx
```

### Test Profiles

| Profile | Industry | Features | Edge Case |
|---------|----------|----------|-----------|
| `sample-business-profile.yaml` | fintech | 3 | Brand colors |
| `saas-startup.yaml` | saas | 3 | Friendly tone |
| `agency-creative.yaml` | agency | 4 | Bold tone + brand colors |
| `ecommerce-shop.yaml` | ecommerce | 5 | Many features |
| `education-platform.yaml` | education | 3 | Minimal tone |
| `edge-minimal.yaml` | (none) | 1 | No optional fields |
| `edge-maximal.yaml` | saas | 8 | All optional fields, max features |

## Troubleshooting

### Missing API Keys
```
❌ Profile validation failed
```
Ensure `.env` contains valid `SHADCNBLOCKS_API_KEY` and `GOOGLE_GEMINI_API_KEY`.

### Block Install Failures
```
❌ block-name: Command failed
```
The pipeline automatically tries alternative blocks from the same category. If all alternatives fail, the section uses a generic fallback. Check your shadcnblocks.com subscription status.

### QA Non-Convergence
```
⚠️ QA did not converge after 3 iterations
```
The pipeline ships the current best version with remaining issues documented in `qa-convergence.yaml`. Review the issue report and consider adjusting the business profile or style settings.

### Asset Generation Failures
```
⚠️ Asset generation failed, using fallback SVG
```
Check your Gemini API key and rate limits. The pipeline uses themed SVG placeholders when generation fails. Rate limit: 15 requests per minute with 60s cooldown on 429 errors.

## License

Private — not for redistribution.
