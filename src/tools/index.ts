// Tool Registry Index - Registers all tools
import { toolRegistry } from './registry.js';
import { askTool } from './ask.tool.js';
import { pingTool, helpTool } from './simple-tools.js';
import { brainstormTool } from './brainstorm.tool.js';
import { fetchChunkTool } from './fetch-chunk.tool.js';
import { timeoutTestTool } from './timeout-test.tool.js';
import {
  listConversationsTool,
  readConversationTool,
  clearConversationTool,
  deleteConversationTool,
} from './conversation-tools.js';

toolRegistry.push(
  askTool,
  pingTool,
  helpTool,
  brainstormTool,
  fetchChunkTool,
  timeoutTestTool,
  listConversationsTool,
  readConversationTool,
  clearConversationTool,
  deleteConversationTool
);

export * from './registry.js';
