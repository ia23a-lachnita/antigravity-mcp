import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeModel, processChangeModeOutput } from '../utils/executor.js';
import { prepareConversationContext, persistConversationTurn } from '../utils/conversationPersistence.js';
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES,
  ApprovalMode,
  ConversationMode
} from '../constants.js';

const askArgsSchema = z.object({
  prompt: z.string().min(1).describe("Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"),
  model: z.string().optional().describe("Optional model to use (e.g., 'gemini-2.5-flash', 'gemini-3.5-flash'). If not specified, uses the default model."),
  sandbox: z.boolean().default(false).describe("Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment"),
  changeMode: z.boolean().default(false).describe("Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly"),
  approvalMode: z.enum(["default", "auto_edit", "plan", "yolo"]).optional().describe("agy CLI approval mode. default passes no approval flag, yolo enables auto-approval."),
  conversationId: z.string().min(1).optional().describe("Optional MCP-managed conversation ID for context replay across one-shot calls."),
  conversationMode: z.enum(["none", "append", "readonly", "reset"]).optional().describe("Conversation behavior: none, append (default when conversationId is set), readonly, or reset."),
  maxConversationTurns: z.number().int().min(1).optional().describe("Maximum prior turns to replay when conversationId is provided."),
  maxConversationChars: z.number().int().min(1).optional().describe("Maximum combined characters of replayed conversation turns."),
  chunkIndex: z.union([z.number(), z.string()]).optional().describe("Which chunk to return (1-based)"),
  chunkCacheKey: z.string().optional().describe("Optional cache key for continuation"),
});

export const askTool: UnifiedTool = {
  name: "ask-ai",
  description: "Ask the configured AI model (agy/Gemini via Google subscription, or direct API). Supports model selection, sandbox mode, and changeMode for structured edits.",
  zodSchema: askArgsSchema,
  prompt: {
    description: "Execute an AI prompt via the configured backend (agy, sdk, or legacy cli). Supports enhanced change mode for structured edit suggestions.",
  },
  category: 'ai',
  execute: async (args, onProgress) => {
    const {
      prompt,
      model,
      sandbox,
      changeMode,
      approvalMode,
      conversationId,
      conversationMode,
      maxConversationTurns,
      maxConversationChars,
      chunkIndex,
      chunkCacheKey
    } = args;
    if (!prompt?.trim()) { throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED); }

    if (changeMode && chunkIndex && chunkCacheKey) {
      return processChangeModeOutput(
        '', // empty for cache...
        chunkIndex as number,
        chunkCacheKey as string,
        prompt as string
      );
    }

    const conversationContext = prepareConversationContext(prompt as string, {
      conversationId: conversationId as string | undefined,
      conversationMode: conversationMode as ConversationMode | undefined,
      maxConversationTurns: maxConversationTurns as number | undefined,
      maxConversationChars: maxConversationChars as number | undefined,
    });

    const result = await executeModel(
      conversationContext.promptForModel,
      {
        model: model as string | undefined,
        sandbox: !!sandbox,
        changeMode: !!changeMode,
        approvalMode: approvalMode as ApprovalMode | undefined,
        onProgress
      }
    );

    if (conversationContext.shouldSave && conversationContext.conversationId) {
      persistConversationTurn(conversationContext.conversationId, prompt as string, result);
    }

    if (changeMode) {
      return processChangeModeOutput(
        result,
        args.chunkIndex as number | undefined,
        undefined,
        prompt as string
      );
    }
    return `${STATUS_MESSAGES.AI_RESPONSE}\n${result}`;
  }
};
