/**
 * Gemini API Client — Nano Banana 2 Asset Generation
 *
 * References:
 * - PRD Phase 3: Asset Generation & QA Loop (SC-004)
 * - Nano Banana 2 Technology Profile: Sections 3, 4, 5
 *
 * Handles image generation via gemini-3.1-flash-image-preview with:
 * - Cascading prompt simplification on non-STOP finishReason
 * - Rate limit handling (429 → 60s cooldown)
 * - Server error backoff (5xx → exponential 2s/4s/8s)
 * - Returns null on exhausted retries — caller uses placeholder SVG
 */

import { GoogleGenAI } from "@google/genai";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { AssetRequest } from "./asset-types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = "gemini-3.1-flash-image-preview";

const THROTTLE = {
  maxConcurrent: 3,
  minDelayMs: 2000,
  maxRetries: 3,
  backoffMultiplier: 2,
  rateLimitCooldownMs: 60000,
};

// Safety settings — use SDK enums for type safety
// Landing page assets are low-risk; relax thresholds per Nano Banana 2 profile
const safetySettings: any[] = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
];

let requestCount = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create GoogleGenAI client from env var. */
export function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY not found in environment.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Build contents for generateContent call.
 * Returns string for text-only, or array with inlineData parts for reference images.
 */
function buildContents(
  prompt: string,
  referenceImages: Buffer[],
): string | Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
  if (referenceImages.length === 0) {
    return prompt;
  }
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  for (const img of referenceImages) {
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: img.toString("base64") },
    });
  }
  return parts;
}

/**
 * Simplify prompt by keeping only the first two sentences (base + category).
 * Drops the specific prompt layer on retry.
 */
function simplifyPrompt(fullPrompt: string): string {
  const sentences = fullPrompt.split(". ");
  if (sentences.length <= 2) return fullPrompt;
  return sentences.slice(0, 2).join(". ") + ".";
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Single asset generation call. Returns image Buffer or null. */
export async function generateAsset(
  request: AssetRequest,
): Promise<Buffer | null> {
  const ai = createGeminiClient();
  requestCount++;

  const prompt = `${request.category.basePrompt} ${request.category.categoryPrompt} Subject: ${request.specificPrompt}`;
  const contents = buildContents(prompt, request.referenceImages);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: request.category.aspectRatio,
        imageSize: request.category.imageSize,
      },
      safetySettings,
    },
  });

  const reason = response.candidates?.[0]?.finishReason;
  if (reason !== "STOP") {
    console.warn(`[gemini] Non-STOP finishReason: ${reason} for ${request.sectionId}`);
    return null;
  }

  const imgPart = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData,
  );
  if (!imgPart?.inlineData?.data) {
    console.warn(`[gemini] No image data in response for ${request.sectionId}`);
    return null;
  }

  return Buffer.from(imgPart.inlineData.data, "base64");
}

/**
 * Generate asset with retry logic (maps to PRD SC-004).
 *
 * - Non-STOP finishReason → simplify prompt, retry
 * - 429 → wait 60s, retry
 * - 5xx → exponential backoff
 * - All retries exhausted → return null (caller uses placeholder SVG)
 */
export async function generateAssetWithRetry(
  request: AssetRequest,
  retries: number = THROTTLE.maxRetries,
): Promise<Buffer | null> {
  let currentPrompt = `${request.category.basePrompt} ${request.category.categoryPrompt} Subject: ${request.specificPrompt}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const ai = createGeminiClient();
      requestCount++;

      const contents = buildContents(currentPrompt, request.referenceImages);
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: request.category.aspectRatio,
            imageSize: request.category.imageSize,
          },
          safetySettings,
        },
      });

      const reason = response.candidates?.[0]?.finishReason;
      if (reason !== "STOP") {
        console.warn(`[gemini] Attempt ${attempt + 1}: finishReason=${reason} for ${request.sectionId}`);
        currentPrompt = simplifyPrompt(currentPrompt);
        await delay(THROTTLE.minDelayMs * Math.pow(THROTTLE.backoffMultiplier, attempt));
        continue;
      }

      const imgPart = response.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData,
      );
      if (imgPart?.inlineData?.data) {
        console.log(`[gemini] Asset generated for ${request.sectionId} (attempt ${attempt + 1}, total requests: ${requestCount})`);
        return Buffer.from(imgPart.inlineData.data, "base64");
      }
    } catch (err: any) {
      if (err.status === 429) {
        console.warn(`[gemini] Rate limited (429) for ${request.sectionId}. Waiting 60s...`);
        await delay(THROTTLE.rateLimitCooldownMs);
        continue;
      }
      if (err.status >= 500) {
        const backoff = THROTTLE.minDelayMs * Math.pow(THROTTLE.backoffMultiplier, attempt);
        console.warn(`[gemini] Server error (${err.status}) for ${request.sectionId}. Backoff ${backoff}ms`);
        await delay(backoff);
        continue;
      }
      console.error(`[gemini] Unexpected error for ${request.sectionId}:`, err.message);
    }
  }

  console.error(`[gemini] All ${retries} retries exhausted for ${request.sectionId}. Caller uses fallback SVG.`);
  console.log(`[gemini] Total API requests: ${requestCount}`);
  return null;
}

/** Write image buffer to disk, creating parent dirs as needed. */
export function saveAsset(buffer: Buffer, outputPath: string): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
}
