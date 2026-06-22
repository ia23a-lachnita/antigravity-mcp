import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { ENV_VARS } from '../constants.js';

const pingArgsSchema = z.object({
  prompt: z.string().default('').describe("Message to echo "),
});

export const pingTool: UnifiedTool = {
  name: "ping",
  description: "Echo",
  zodSchema: pingArgsSchema,
  prompt: {
    description: "Echo test message with structured response.",
  },
  category: 'simple',
  execute: async (args, onProgress) => {
    const message = args.prompt || args.message || "Pong!";
    if (onProgress) {
      onProgress(String(message));
    }
    return String(message);
  }
};

const helpArgsSchema = z.object({});

export const helpTool: UnifiedTool = {
  name: "Help",
  description: "receive help information about antigravity-mcp and available backends",
  zodSchema: helpArgsSchema,
  prompt: {
    description: "receive help information",
  },
  category: 'simple',
  execute: async (_args, _onProgress) => {
    const backend = process.env[ENV_VARS.ANTIGRAVITY_BACKEND] ?? 'auto';
    const hasApiKey = !!(
      process.env[ENV_VARS.GEMINI_API_KEY] ||
      process.env[ENV_VARS.GOOGLE_GENERATIVE_AI_API_KEY] ||
      process.env[ENV_VARS.GOOGLE_API_KEY]
    );
    return [
      'Antigravity MCP — Help',
      '',
      'Available backends (set via ANTIGRAVITY_BACKEND env var):',
      '  sdk  — Direct Gemini API via @ai-sdk/google  (requires GEMINI_API_KEY)',
      '  agy  — Antigravity CLI via PTY              (requires agy + node-pty)',
      '  cli  — Legacy gemini CLI                    (discontinued for free tier)',
      '  auto — Auto-detect (default)',
      '',
      `Current ANTIGRAVITY_BACKEND: ${backend}`,
      `GEMINI_API_KEY set:          ${hasApiKey ? 'yes' : 'no'}`,
      '',
      'Available tools: ask-ai, brainstorm, fetch-chunk, timeout-test, ping,',
      '                 list-conversations, read-conversation,',
      '                 clear-conversation, delete-conversation',
      '',
      'Documentation: https://github.com/ia23a-lachnita/antigravity-mcp',
    ].join('\n');
  }
};
