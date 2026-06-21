import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { readFileSync, existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { Logger } from './logger.js';
import { ERROR_MESSAGES, MODELS, ENV_VARS } from '../constants.js';

// Resolve API key from multiple env var names (in priority order)
export function resolveGeminiApiKey(): string | undefined {
  return (
    process.env[ENV_VARS.GEMINI_API_KEY] ||
    process.env[ENV_VARS.GOOGLE_GENERATIVE_AI_API_KEY] ||
    process.env[ENV_VARS.GOOGLE_API_KEY]
  );
}

export function hasGeminiApiKey(): boolean {
  return !!resolveGeminiApiKey();
}

// Expand @filename references in a prompt by inlining file content.
// Only expands paths that actually exist; others pass through unchanged.
export function expandFileReferences(prompt: string, baseDir?: string): string {
  return prompt.replace(/@(\S+)/g, (match, rawPath) => {
    try {
      // Resolve relative to baseDir (cwd) if path is not absolute
      const filePath = isAbsolute(rawPath)
        ? rawPath
        : resolve(baseDir ?? process.cwd(), rawPath);

      if (!existsSync(filePath)) {
        return match; // Keep @ref as-is when file not found
      }

      const content = readFileSync(filePath, 'utf-8');
      const ext = rawPath.split('.').pop() ?? '';
      const lang = ext ? ext : '';
      return `[File: ${rawPath}]\n\`\`\`${lang}\n${content}\n\`\`\``;
    } catch {
      return match;
    }
  });
}

export interface SdkExecutionOptions {
  model?: string;
  onProgress?: (newOutput: string) => void;
}

export async function callGeminiSdk(
  prompt: string,
  options: SdkExecutionOptions = {},
): Promise<string> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  const modelId = options.model || MODELS.PRO;
  const resolvedPrompt = expandFileReferences(prompt);

  Logger.debug(`SDK backend: model=${modelId}, prompt length=${resolvedPrompt.length}`);

  const google = createGoogleGenerativeAI({ apiKey });

  if (options.onProgress) {
    let accumulated = '';
    const result = await streamText({
      model: google(modelId),
      prompt: resolvedPrompt,
    });

    for await (const chunk of result.textStream) {
      accumulated += chunk;
      options.onProgress(accumulated);
    }
    return accumulated;
  }

  const { text } = await generateText({
    model: google(modelId),
    prompt: resolvedPrompt,
  });

  return text;
}

// Quota-aware wrapper: retries with Flash model on RESOURCE_EXHAUSTED / 429
export async function callGeminiSdkWithFallback(
  prompt: string,
  options: SdkExecutionOptions = {},
): Promise<string> {
  try {
    return await callGeminiSdk(prompt, options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuotaError =
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes(ERROR_MESSAGES.QUOTA_EXCEEDED);

    if (isQuotaError && options.model !== MODELS.FLASH) {
      Logger.warn(`SDK: quota exceeded on ${options.model ?? MODELS.PRO}, retrying with ${MODELS.FLASH}`);
      return callGeminiSdk(prompt, { ...options, model: MODELS.FLASH });
    }
    throw err;
  }
}
