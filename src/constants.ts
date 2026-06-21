

// Logging
export const LOG_PREFIX = "[GMCPT]";

export type ApprovalMode = "default" | "auto_edit" | "plan" | "yolo";
export type ConversationMode = "none" | "append" | "readonly" | "reset";

// Which backend to use for Gemini model access.
// "sdk"  – direct @ai-sdk/google API calls (requires GEMINI_API_KEY)
// "agy"  – agy Antigravity CLI via PTY (requires node-pty + agy installed)
// "cli"  – legacy gemini CLI (requires gemini CLI in PATH)
// "auto" – pick sdk if GEMINI_API_KEY set, else agy if agy found, else error
export type GeminiBackend = "sdk" | "agy" | "cli" | "auto";

// Error messages
export const ERROR_MESSAGES = {
  QUOTA_EXCEEDED: "Quota exceeded for quota metric",
  QUOTA_EXCEEDED_SHORT: "⚠️ Gemini Pro daily quota exceeded. Please retry with model: 'gemini-2.5-flash'",
  TOOL_NOT_FOUND: "not found in registry",
  NO_PROMPT_PROVIDED: "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
  NO_API_KEY: "No Gemini API key found. Set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) environment variable. Get a free key at https://aistudio.google.com/apikey",
  AGY_NOT_FOUND: "agy (Antigravity CLI) not found. Install it from https://antigravity.google or set GEMINI_BACKEND=sdk and provide GEMINI_API_KEY.",
  PTY_NOT_AVAILABLE: "node-pty is not installed. Run: npm install node-pty  (requires native build tools). Alternatively set GEMINI_BACKEND=sdk and provide GEMINI_API_KEY.",
  LEGACY_CLI_DISCONTINUED: "The gemini CLI (Google Gemini Code Assist) has been discontinued for the free tier. Migrate to GEMINI_BACKEND=sdk (requires GEMINI_API_KEY) or GEMINI_BACKEND=agy (requires agy installed).",
} as const;

// Status messages
export const STATUS_MESSAGES = {
  QUOTA_SWITCHING: "🚫 Quota exceeded, switching to Flash model...",
  FLASH_RETRY: "⚡ Retrying with Gemini 2.5 Flash...",
  FLASH_SUCCESS: "✅ Flash model completed successfully",
  SANDBOX_EXECUTING: "🔒 Executing in sandbox mode...",
  GEMINI_RESPONSE: "Gemini response:",
  PROCESSING_START: "🔍 Starting analysis (may take 5-15 minutes for large codebases)",
  PROCESSING_CONTINUE: "⏳ Still processing... Gemini is working on your request",
  PROCESSING_COMPLETE: "✅ Analysis completed successfully",
  SDK_BACKEND: "🔑 Using direct Gemini API (SDK backend)",
  AGY_BACKEND: "🔮 Using Antigravity CLI (agy backend)",
  CLI_BACKEND: "🖥️  Using legacy Gemini CLI (cli backend)",
} as const;

// Models — same model names work across both SDK and agy backends
export const MODELS = {
  PRO: "gemini-2.5-pro",
  FLASH: "gemini-2.5-flash",
  // Antigravity-specific model aliases (agy may present these in its UI)
  PRO_PREVIEW: "gemini-2.5-pro-preview-06-05",
  FLASH_LITE: "gemini-2.5-flash-lite-preview-06-17",
} as const;

// MCP Protocol Constants
export const PROTOCOL = {
  ROLES: {
    USER: "user",
    ASSISTANT: "assistant",
  },
  CONTENT_TYPES: {
    TEXT: "text",
  },
  STATUS: {
    SUCCESS: "success",
    ERROR: "error",
    FAILED: "failed",
    REPORT: "report",
  },
  NOTIFICATIONS: {
    PROGRESS: "notifications/progress",
  },
  KEEPALIVE_INTERVAL: 25000, // 25 seconds
} as const;

// Legacy CLI Constants (gemini CLI and agy CLI flags)
export const CLI = {
  COMMANDS: {
    GEMINI: "gemini",
    AGY: "agy",
    ECHO: "echo",
  },
  // gemini CLI flags (legacy)
  FLAGS: {
    MODEL: "-m",
    SANDBOX: "-s",
    PROMPT: "-p",
    APPROVAL_MODE: "--approval-mode",
    HELP: "--help",
  },
  // agy CLI flags
  AGY_FLAGS: {
    MODEL: "--model",
    SANDBOX: "--sandbox",
    PROMPT: "-p",
    SKIP_PERMISSIONS: "--dangerously-skip-permissions",
    HELP: "--help",
    PRINT_TIMEOUT: "--print-timeout",
  },
  DEFAULTS: {
    MODEL: "default",
    BOOLEAN_TRUE: "true",
    BOOLEAN_FALSE: "false",
    AGY_PRINT_TIMEOUT: "5m0s",
  },
} as const;

// Environment variable names
export const ENV_VARS = {
  GEMINI_API_KEY: "GEMINI_API_KEY",
  GOOGLE_GENERATIVE_AI_API_KEY: "GOOGLE_GENERATIVE_AI_API_KEY",
  GOOGLE_API_KEY: "GOOGLE_API_KEY",
  GEMINI_BACKEND: "GEMINI_BACKEND",
  GEMINI_CLI_PATH: "GEMINI_CLI_PATH",
  AGY_CLI_PATH: "AGY_CLI_PATH",
  GEMINI_MCP_APPROVAL_MODE: "GEMINI_MCP_APPROVAL_MODE",
  GEMINI_MCP_CONVERSATION_DIR: "GEMINI_MCP_CONVERSATION_DIR",
} as const;

// (merged PromptArguments and ToolArguments)
export interface ToolArguments {
  prompt?: string;
  model?: string;
  sandbox?: boolean | string;
  changeMode?: boolean | string;
  approvalMode?: ApprovalMode;
  conversationId?: string;
  conversationMode?: ConversationMode;
  maxConversationTurns?: number;
  maxConversationChars?: number;
  chunkIndex?: number | string;
  chunkCacheKey?: string;
  message?: string;

  // brainstorm tool
  methodology?: string;
  domain?: string;
  constraints?: string;
  existingContext?: string;
  ideaCount?: number;
  includeAnalysis?: boolean;

  [key: string]: string | boolean | number | undefined;
}
