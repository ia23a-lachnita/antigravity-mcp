import { executeCommand } from './commandExecutor.js';
import { callGeminiSdkWithFallback, hasGeminiApiKey } from './aiSdkExecutor.js';
import { executeAgyViaPty, isAgyAvailable, isPtyAvailable } from './agyPtyExecutor.js';
import { Logger } from './logger.js';
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES,
  MODELS,
  CLI,
  ENV_VARS,
  type ApprovalMode,
  type AiBackend,
} from '../constants.js';

import { parseChangeModeOutput, validateChangeModeEdits } from './changeModeParser.js';
import { formatChangeModeResponse, summarizeChangeModeEdits } from './changeModeTranslator.js';
import { chunkChangeModeEdits } from './changeModeChunker.js';
import { cacheChunks, getChunks } from './chunkCache.js';

export interface AiExecutionOptions {
  model?: string;
  sandbox?: boolean;
  changeMode?: boolean;
  approvalMode?: ApprovalMode;
  onProgress?: (newOutput: string) => void;
}

// ──────────────────────────────────────────────
// Approval-mode helpers (shared across backends)
// ──────────────────────────────────────────────

const VALID_APPROVAL_MODES: ApprovalMode[] = ['default', 'auto_edit', 'plan', 'yolo'];

function isApprovalMode(value: string): value is ApprovalMode {
  return VALID_APPROVAL_MODES.includes(value as ApprovalMode);
}

export function resolveApprovalMode(approvalMode?: ApprovalMode): ApprovalMode {
  if (approvalMode) return approvalMode;

  const envMode = process.env[ENV_VARS.ANTIGRAVITY_MCP_APPROVAL_MODE]?.trim();
  if (!envMode) return 'plan';

  if (!isApprovalMode(envMode)) {
    Logger.warn(`Ignoring invalid ANTIGRAVITY_MCP_APPROVAL_MODE: ${envMode}`);
    return 'default';
  }
  return envMode;
}

// ──────────────────────────────────────────────
// Legacy CLI arg-builder (gemini CLI, kept for ANTIGRAVITY_BACKEND=cli)
// ──────────────────────────────────────────────

export function buildGeminiArgs(
  prompt: string,
  options: Pick<AiExecutionOptions, 'model' | 'sandbox' | 'approvalMode'>,
): string[] {
  const args: string[] = [];
  if (options.model) args.push(CLI.FLAGS.MODEL, options.model);
  if (options.sandbox) args.push(CLI.FLAGS.SANDBOX);

  const resolvedApprovalMode = resolveApprovalMode(options.approvalMode);
  if (resolvedApprovalMode !== 'default') {
    args.push(`${CLI.FLAGS.APPROVAL_MODE}=${resolvedApprovalMode}`);
  }

  args.push(CLI.FLAGS.PROMPT, prompt);
  return args;
}

// ──────────────────────────────────────────────
// Backend selection
// ──────────────────────────────────────────────

export function resolveBackend(): AiBackend {
  const override = process.env[ENV_VARS.ANTIGRAVITY_BACKEND]?.trim().toLowerCase() as AiBackend | undefined;
  if (override && ['sdk', 'agy', 'cli'].includes(override)) {
    return override;
  }

  // Auto-detect
  if (hasGeminiApiKey()) return 'sdk';
  if (isAgyAvailable() && isPtyAvailable()) return 'agy';

  // Return 'sdk' even without a key — the error will surface at execution time
  // with a clear message rather than a generic "no backend" error.
  return 'sdk';
}

// ──────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────

export async function executeModel(
  prompt: string,
  options: AiExecutionOptions = {},
): Promise<string> {
  const { model, sandbox, changeMode, onProgress, approvalMode } = options;
  let processedPrompt = prompt;

  // changeMode: rewrite @file: refs and prepend formatting instructions
  if (changeMode) {
    processedPrompt = prompt.replace(/file:(\S+)/g, '@$1');

    const changeModeInstructions = `
[CHANGEMODE INSTRUCTIONS]
You are generating code modifications that will be processed by an automated system. The output format is critical because it enables programmatic application of changes without human intervention.

INSTRUCTIONS:
1. Analyze each provided file thoroughly
2. Identify locations requiring changes based on the user request
3. For each change, output in the exact format specified
4. The OLD section must be EXACTLY what appears in the file (copy-paste exact match)
5. Provide complete, directly replacing code blocks
6. Verify line numbers are accurate

CRITICAL REQUIREMENTS:
1. Output edits in the EXACT format specified below - no deviations
2. The OLD string MUST be findable with Ctrl+F - it must be a unique, exact match
3. Include enough surrounding lines to make the OLD string unique
4. If a string appears multiple times (like </div>), include enough context lines above and below to make it unique
5. Copy the OLD content EXACTLY as it appears - including all whitespace, indentation, line breaks
6. Never use partial lines - always include complete lines from start to finish

OUTPUT FORMAT (follow exactly):
**FILE: [filename]:[line_number]**
\`\`\`
OLD:
[exact code to be replaced - must match file content precisely]
NEW:
[new code to insert - complete and functional]
\`\`\`

EXAMPLE 1 - Simple unique match:
**FILE: src/utils/helper.js:100**
\`\`\`
OLD:
function getMessage() {
  return "Hello World";
}
NEW:
function getMessage() {
  return "Hello Universe!";
}
\`\`\`

EXAMPLE 2 - Common tag needing context:
**FILE: index.html:245**
\`\`\`
OLD:
        </div>
      </div>
    </section>
NEW:
        </div>
      </footer>
    </section>
\`\`\`

IMPORTANT: The OLD section must be an EXACT copy from the file that can be found with Ctrl+F!

USER REQUEST:
${processedPrompt}
`;
    processedPrompt = changeModeInstructions;
  }

  const backend = resolveBackend();
  Logger.debug(`Using backend: ${backend}`);

  const resolvedApprovalMode = resolveApprovalMode(approvalMode);

  switch (backend) {
    case 'sdk':
      return executeSdkBackend(processedPrompt, { model, onProgress });

    case 'agy':
      return executeAgyBackend(processedPrompt, {
        model,
        sandbox: !!sandbox,
        approvalMode: resolvedApprovalMode,
        onProgress,
      });

    case 'cli':
      return executeCliBackend(processedPrompt, {
        model,
        sandbox: !!sandbox,
        approvalMode: resolvedApprovalMode,
        onProgress,
      });

    default:
      throw new Error(`Unknown backend: ${backend}`);
  }
}

async function executeSdkBackend(
  prompt: string,
  options: { model?: string; onProgress?: (s: string) => void },
): Promise<string> {
  Logger.debug(`SDK backend: model=${options.model ?? MODELS.DEFAULT}`);
  return callGeminiSdkWithFallback(prompt, options);
}

async function executeAgyBackend(
  prompt: string,
  options: {
    model?: string;
    sandbox?: boolean;
    approvalMode?: ApprovalMode;
    onProgress?: (s: string) => void;
  },
): Promise<string> {
  Logger.debug(`agy backend: model=${options.model ?? 'default'}`);
  return executeAgyViaPty(prompt, options);
}

async function executeCliBackend(
  prompt: string,
  options: {
    model?: string;
    sandbox?: boolean;
    approvalMode?: ApprovalMode;
    onProgress?: (s: string) => void;
  },
): Promise<string> {
  Logger.debug(`CLI backend: model=${options.model ?? 'default'}`);
  const args = buildGeminiArgs(prompt, options);

  try {
    return await executeCommand(CLI.COMMANDS.GEMINI, args, options.onProgress);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Catch IneligibleTierError from discontinued free-tier gemini CLI
    if (
      errorMessage.includes('IneligibleTierError') ||
      errorMessage.includes('no longer supported') ||
      errorMessage.includes('Antigravity')
    ) {
      throw new Error(ERROR_MESSAGES.LEGACY_CLI_DISCONTINUED);
    }

    // Quota fallback
    if (errorMessage.includes(ERROR_MESSAGES.QUOTA_EXCEEDED) && options.model !== MODELS.FLASH) {
      Logger.warn(`CLI: quota exceeded. Falling back to ${MODELS.FLASH}.`);
      const fallbackArgs = buildGeminiArgs(prompt, { ...options, model: MODELS.FLASH });
      return executeCommand(CLI.COMMANDS.GEMINI, fallbackArgs, options.onProgress);
    }

    throw error;
  }
}

// ──────────────────────────────────────────────
// changeMode post-processing (unchanged logic)
// ──────────────────────────────────────────────

export async function processChangeModeOutput(
  rawResult: string,
  chunkIndex?: number,
  chunkCacheKey?: string,
  prompt?: string,
): Promise<string> {
  if (chunkIndex && chunkCacheKey) {
    const cachedChunks = getChunks(chunkCacheKey);
    if (cachedChunks && chunkIndex > 0 && chunkIndex <= cachedChunks.length) {
      Logger.debug(`Using cached chunk ${chunkIndex} of ${cachedChunks.length}`);
      const chunk = cachedChunks[chunkIndex - 1];
      let result = formatChangeModeResponse(
        chunk.edits,
        { current: chunkIndex, total: cachedChunks.length, cacheKey: chunkCacheKey },
      );
      if (chunkIndex === 1 && chunk.edits.length > 5) {
        const allEdits = cachedChunks.flatMap((c) => c.edits);
        result = summarizeChangeModeEdits(allEdits) + '\n\n' + result;
      }
      return result;
    }
    Logger.debug(`Cache miss or invalid chunk index, processing new result`);
  }

  const edits = parseChangeModeOutput(rawResult);
  if (edits.length === 0) {
    return `No edits found in response. Please ensure the model uses the OLD/NEW format. \n\n+ ${rawResult}`;
  }

  const validation = validateChangeModeEdits(edits);
  if (!validation.valid) {
    return `Edit validation failed:\n${validation.errors.join('\n')}`;
  }

  const chunks = chunkChangeModeEdits(edits);
  let cacheKey: string | undefined;
  if (chunks.length > 1 && prompt) {
    cacheKey = cacheChunks(prompt, chunks);
    Logger.debug(`Cached ${chunks.length} chunks with key: ${cacheKey}`);
  }

  const returnChunkIndex =
    chunkIndex && chunkIndex > 0 && chunkIndex <= chunks.length ? chunkIndex : 1;
  const returnChunk = chunks[returnChunkIndex - 1];

  let result = formatChangeModeResponse(
    returnChunk.edits,
    chunks.length > 1 ? { current: returnChunkIndex, total: chunks.length, cacheKey } : undefined,
  );

  if (returnChunkIndex === 1 && edits.length > 5) {
    result = summarizeChangeModeEdits(edits, chunks.length > 1) + '\n\n' + result;
  }

  Logger.debug(
    `ChangeMode: Parsed ${edits.length} edits, ${chunks.length} chunks, returning chunk ${returnChunkIndex}`,
  );
  return result;
}

async function sendStatusMessage(message: string): Promise<void> {
  Logger.debug(`Status: ${message}`);
}
