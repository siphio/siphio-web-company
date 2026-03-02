# Technology Profile: Nano Banana 2 (Gemini API)

**Generated**: 2026-03-02
**PRD Reference**: Section 3 — Nano Banana 2 (via Gemini API)
**Agent Use Case**: Generate style-consistent illustrations, icons, and decorative elements for landing pages using cascading prompts and moodboard reference images

---

## 1. Authentication & Setup

**API Key Source**: Google AI Studio — https://aistudio.google.com/apikey

**Environment Variable**: `GOOGLE_GEMINI_API_KEY=your-api-key-here`

**Setup**: Create a Google AI Studio account, generate an API key, store in `.env`. Nano Banana 2 has no free tier — billing must be enabled (Tier 1). Tier 2 ($250 spend + 30 days) unlocks higher rate limits.

**SDK Installation**:
```bash
npm install @google/genai
```

The older `@google/generative-ai` is legacy. Use `@google/genai` — the unified SDK for all Google GenAI models.

---

## 2. Core Data Models

### Model Selection

| Model ID | Name | Best For | Status |
|----------|------|----------|--------|
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | High-volume, speed-optimized, up to 14 refs | Preview |
| `gemini-3-pro-image-preview` | Nano Banana Pro | 4K assets, complex layouts, precise text | Preview |
| `gemini-2.5-flash-image` | Nano Banana | Lower cost ($0.039/img), dev/testing | Stable |

**Recommended**: `gemini-3.1-flash-image-preview` — speed-optimized, 14 reference images, up to 4K output.

### Request/Response Shape

```typescript
// Request — via @google/genai SDK
await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: string | ContentPart[],  // text prompt or mixed text+image parts
  config: {
    responseModalities: ["TEXT", "IMAGE"],  // or ["IMAGE"] for image-only
    imageConfig: {
      aspectRatio: "1:1"|"16:9"|"3:2"|"4:3"|"9:16"|"21:9"|"2:3"|"3:4"|"4:5"|"5:4"|"1:4"|"4:1"|"1:8"|"8:1",
      imageSize: "512px"|"1K"|"2K"|"4K",   // 512px = 3.1 Flash only
    },
    safetySettings?: SafetySetting[],
  },
});

// Response — image data arrives as base64 inline
response.candidates[0].content.parts.forEach(part => {
  if (part.inlineData) {
    Buffer.from(part.inlineData.data, "base64"); // PNG or JPEG
  }
});
// finishReason: "STOP" = success
```

### Pricing (Nano Banana 2 / 3.1 Flash)

| Size | Cost/Image | Token Equivalent |
|------|-----------|-----------------|
| 512px | $0.045 | Lowest |
| 1K | $0.067 | ~1,120 tokens |
| 2K | $0.101 | ~1,120 tokens |
| 4K | $0.151 | ~2,000 tokens |

Input: $0.25/M tokens. Batch API: 50% discount (24h turnaround).

---

## 3. Key Endpoints

**Base URL**: `https://generativelanguage.googleapis.com/v1beta/models/{model-id}:generateContent`

All image generation uses `generateContent`. No separate image endpoint.

### 3.1 Text-to-Image

```typescript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: "A friendly, minimal illustration of a dashboard interface with soft gradients, flat style, no text, white background",
  config: {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
  },
});

for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    fs.writeFileSync("hero.png", Buffer.from(part.inlineData.data, "base64"));
  }
}
```

### 3.2 With Reference Images (Style Anchoring)

Core capability for the Asset Generator agent. Pass 2-3 moodboard images as base64 `inlineData` parts.

```typescript
const ref1 = fs.readFileSync("context/moodboard/website-ref-1.png");
const ref2 = fs.readFileSync("context/moodboard/website-ref-3.png");

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    { text: "Create an illustration matching these references. Subject: team collaboration with floating UI cards. Style: friendly modern SaaS, soft gradients, minimal, flat, no text." },
    { inlineData: { mimeType: "image/png", data: ref1.toString("base64") } },
    { inlineData: { mimeType: "image/png", data: ref2.toString("base64") } },
  ],
  config: {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
  },
});
```

**Reference limits (3.1 Flash)**: Up to 10 objects + 4 characters = 14 total per request.

### 3.3 Multi-Turn Editing (QA Refinement)

```typescript
const chat = ai.chats.create({
  model: "gemini-3.1-flash-image-preview",
  config: { responseModalities: ["TEXT", "IMAGE"] },
});

const initial = await chat.sendMessage({
  message: "Create a flat pricing card illustration, teal and coral palette",
  config: { imageConfig: { aspectRatio: "3:2", imageSize: "1K" } },
});

// QA feedback loop — refine without regenerating from scratch
const refined = await chat.sendMessage({
  message: "Softer gradients, more whitespace between tiers. Same palette.",
  config: { imageConfig: { aspectRatio: "3:2", imageSize: "1K" } },
});
```

---

## 4. Rate Limits & Throttling

| Tier | RPM | IPM | RPD | Requirements |
|------|-----|-----|-----|-------------|
| Free | N/A | N/A | N/A | Not available for 3.1 Flash |
| Tier 1 | 150-300 | ~10 | 1,000-1,500 | Billing enabled |
| Tier 2 | 500-1,500 | ~30 | 10,000 | $250 spend + 30 days |

IPM = Images Per Minute. Exact values vary; check Google AI Studio dashboard. Preview models have more restricted limits.

**Throttling config for Asset Generator**:
```typescript
const THROTTLE = {
  maxConcurrent: 3,           // Parallel generation requests
  minDelayMs: 2000,           // 2s between requests
  maxRetries: 3,              // Per-image retry budget
  backoffMultiplier: 2,       // Exponential: 2s, 4s, 8s
  rateLimitCooldownMs: 60000, // 60s on 429 errors
};
```

---

## 5. Error Handling

### finishReason Codes

| Code | Configurable | Meaning | Recovery |
|------|-------------|---------|----------|
| `STOP` | N/A | Success | None |
| `SAFETY` | Yes (Layer 1) | Input filter triggered | Relax `safetySettings` or rephrase |
| `IMAGE_SAFETY` | No (Layer 2) | Post-generation violation | Revise creative direction |
| `PROHIBITED_CONTENT` | No (Layer 2) | Copyright/IP block | Use original designs only |
| `IMAGE_RECITATION` | No (Layer 2) | Too similar to training data | Add unique descriptors |
| `OTHER` | No (Layer 2) | Unspecified block | Simplify prompt |

**Dual-layer safety**: Layer 1 is configurable via `safetySettings`. Layer 2 is always active — blocks NSFW, copyrighted characters, public figures, deepfakes. Google has acknowledged these filters are "more cautious than intended."

**Recommended safety settings** (landing page assets are low-risk):
```typescript
const safetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
];
```

**Critical**: Blocked requests still consume API quota despite returning no image.

### Retry Pattern (maps to PRD SC-004)

```typescript
async function generateAssetWithRetry(
  ai: GoogleGenAI, prompt: string, refs: Buffer[], config: ImageConfig, retries = 3
): Promise<Buffer | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: buildContents(prompt, refs),
        config: { responseModalities: ["IMAGE"], imageConfig: config, safetySettings },
      });
      const reason = response.candidates?.[0]?.finishReason;
      if (reason !== "STOP") {
        prompt = simplifyPrompt(prompt); // Drop specific layer, keep base + category
        await delay(THROTTLE.minDelayMs * Math.pow(THROTTLE.backoffMultiplier, attempt));
        continue;
      }
      const img = response.candidates[0].content.parts.find(p => p.inlineData);
      if (img) return Buffer.from(img.inlineData.data, "base64");
    } catch (err: any) {
      if (err.status === 429) { await delay(THROTTLE.rateLimitCooldownMs); continue; }
      if (err.status >= 500) { await delay(THROTTLE.minDelayMs * Math.pow(THROTTLE.backoffMultiplier, attempt)); continue; }
      throw err;
    }
  }
  return null; // All retries exhausted — caller uses placeholder SVG
}
```

---

## 6. SDK / Library Recommendation

**Primary**: `@google/genai` — TypeScript-first, unified SDK, chat support, active development.

```typescript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
```

**REST fallback** (for fine-grained control):
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent
Header: x-goog-api-key: {key}
Body: { contents: [...], generationConfig: { responseModalities: ["IMAGE"], imageConfig: {...} } }
```

---

## 7. Integration Gotchas

1. **Style drift between generations** — No internal state across calls. Consistency depends on identical reference images + cascading prompt base in every request. Never vary references mid-pipeline.

2. **Aggressive content filtering** — Even innocuous prompts can be blocked. Avoid human faces when possible; use abstract figures. Test all prompt templates before pipeline deployment.

3. **Reference image quality** — Low-res or text-heavy references degrade output. Pre-process moodboard images to minimum 1024x1024, crop to relevant visual area.

4. **No SVG output** — Raster only (PNG/JPEG). For icons, generate at 512px then trace to SVG with `potrace` or similar post-processor.

5. **Thinking tokens bill even when hidden** — Use `thinkingLevel: "minimal"` for standard assets. Reserve `"High"` for complex multi-element compositions.

6. **SynthID watermark** — Invisible digital watermark on all outputs. Non-removable, does not affect visual quality.

7. **No free tier** — Billing required from day one. Use `gemini-2.5-flash-image` ($0.039/img) during development to save costs.

---

## 8. PRD Capability Mapping

| PRD Requirement | API Implementation |
|----------------|-------------------|
| Cascading prompt (base + category + specific) | String concat into `contents` text field |
| Reference images (2-3 moodboard) | `inlineData` parts in `contents` array |
| Hero illustration | `imageSize: "2K"`, `aspectRatio: "16:9"` |
| Icon set | `imageSize: "512px"`, `aspectRatio: "1:1"`, post-process to SVG |
| Bento card graphics | `imageSize: "1K"`, `aspectRatio: "3:2"` or `"4:3"` |
| Background textures | `imageSize: "2K"`, `aspectRatio: "16:9"` |
| Decorative elements | `imageSize: "1K"`, `aspectRatio: "1:1"` |
| Style consistency | Same refs + prompt base in every request |
| SC-004: retry simplified | Drop specific prompt layer, keep base + category |
| SC-004: 3 failures | Return null, caller inserts placeholder SVG |
| SC-007: parallel timeout | `AbortController` with 30s timeout |

---

## 9. Live Integration Testing Specification

### 9.1 Tier Classification

| Tier | Tests | Description |
|------|-------|-------------|
| Tier 1 (Auto-Live) | 1 | API connectivity: list models, verify `gemini-3.1-flash-image-preview` accessible |
| Tier 2 | 0 | N/A — all generation costs credits |
| Tier 3 (Approval) | 2 | Single image gen + reference image gen (~$0.09 total) |
| Tier 4 (Mock) | 1 | Full pipeline retry/fallback logic with mocked responses |

### 9.2 Test Fixtures

```typescript
// test/fixtures/gemini-config.ts
export const TEST_CONFIG = {
  model: "gemini-3.1-flash-image-preview",
  testPrompt: "A simple teal circle on a white background, flat illustration, minimal",
  testImageSize: "512px" as const,
  timeoutMs: 45000,
  referenceImagePaths: ["context/moodboard/website-ref-1.png", "context/moodboard/website-ref-3.png"],
};

// test/fixtures/gemini-mock.ts
export const MOCK_SUCCESS = {
  candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "iVBORw0KGgo..." } }] }, finishReason: "STOP" }],
};
export const MOCK_BLOCKED = {
  candidates: [{ content: { parts: [] }, finishReason: "IMAGE_SAFETY" }],
};
```

### 9.3 Testing Sequence

**Tier 1**: Verify connectivity — `ai.models.list()` returns model list including target model.

**Tier 3** (requires approval prompt showing estimated cost):
1. Generate single 512px test image with simple prompt. Verify `finishReason === "STOP"` and valid base64 PNG in response.
2. Generate image with 2 moodboard references. Verify style influence and successful generation.

**Tier 4**: Mock pipeline — simulate blocked-then-success sequence using `MOCK_BLOCKED` + `MOCK_SUCCESS` fixtures. Verify retry logic produces output on second attempt.

## PIV-Automator-Hooks
tech_name: nano-banana-2-gemini-api
research_status: complete
endpoints_documented: 3
tier_1_count: 1
tier_2_count: 0
tier_3_count: 2
tier_4_count: 1
gotchas_count: 7
confidence: high
