import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { CLI } from '../constants.js';

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
  description: "receive help information about the Gemini MCP tool and available backends",
  zodSchema: helpArgsSchema,
  prompt: {
    description: "receive help information",
  },
  category: 'simple',
  execute: async (_args, _onProgress) => {
    const backend = process.env[CLI.COMMANDS.GEMINI] ?? process.env['GEMINI_BACKEND'] ?? 'auto';
    const hasApiKey = !!(
      process.env['GEMINI_API_KEY'] ||
      process.env['GOOGLE_GENERATIVE_AI_API_KEY'] ||
      process.env['GOOGLE_API_KEY']
    );
    return [
      'Gemini MCP Tool — Help',
      '',
      'Available backends (set via GEMINI_BACKEND env var):',
      '  sdk  — Direct Gemini API via @ai-sdk/google  (requires GEMINI_API_KEY)',
      '  agy  — Antigravity CLI via PTY              (requires agy + node-pty)',
      '  cli  — Legacy gemini CLI                    (discontinued for free tier)',
      '  auto — Auto-detect (default)',
      '',
      `Current GEMINI_BACKEND: ${backend}`,
      `GEMINI_API_KEY set:     ${hasApiKey ? 'yes' : 'no'}`,
      '',
      'Available tools: ask-gemini, brainstorm, fetch-chunk, timeout-test, ping,',
      '                 list-gemini-conversations, read-gemini-conversation,',
      '                 clear-gemini-conversation, delete-gemini-conversation',
      '',
      'Documentation: https://github.com/jamubc/gemini-mcp-tool',
    ].join('\n');
  }
};
