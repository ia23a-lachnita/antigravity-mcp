import { z } from "zod";
import { UnifiedTool } from "./registry.js";
import {
  listConversations,
  readConversation,
  clearConversation,
  deleteConversation,
} from "../utils/conversationPersistence.js";

const listArgsSchema = z.object({});

export const listConversationsTool: UnifiedTool = {
  name: "list-conversations",
  description: "List persisted antigravity-mcp conversations without dumping full content.",
  zodSchema: listArgsSchema,
  category: "utility",
  execute: async () => {
    const conversations = listConversations();
    return JSON.stringify({ conversations }, null, 2);
  },
};

const readArgsSchema = z.object({
  conversationId: z.string().min(1).describe("Conversation ID to read."),
  limitTurns: z.number().int().min(1).max(50).optional().describe("Max recent turns to return."),
});

export const readConversationTool: UnifiedTool = {
  name: "read-conversation",
  description: "Read recent turns from a persisted antigravity-mcp conversation.",
  zodSchema: readArgsSchema,
  category: "utility",
  execute: async (args) => {
    const conversationId = args.conversationId as string | undefined;
    if (!conversationId) {
      throw new Error("conversationId is required");
    }
    const limitTurns = typeof args.limitTurns === "number" ? args.limitTurns : undefined;
    const details = readConversation(conversationId, limitTurns ?? 5);
    return JSON.stringify(details, null, 2);
  },
};

const clearArgsSchema = z.object({
  conversationId: z.string().min(1).describe("Conversation ID to clear."),
});

export const clearConversationTool: UnifiedTool = {
  name: "clear-conversation",
  description: "Clear turns from a persisted antigravity-mcp conversation but keep its file.",
  zodSchema: clearArgsSchema,
  category: "utility",
  execute: async (args) => {
    const conversationId = args.conversationId as string | undefined;
    if (!conversationId) {
      throw new Error("conversationId is required");
    }
    clearConversation(conversationId);
    return JSON.stringify({ status: "cleared", conversationId }, null, 2);
  },
};

const deleteArgsSchema = z.object({
  conversationId: z.string().min(1).describe("Conversation ID to delete."),
});

export const deleteConversationTool: UnifiedTool = {
  name: "delete-conversation",
  description: "Delete a persisted antigravity-mcp conversation file.",
  zodSchema: deleteArgsSchema,
  category: "utility",
  execute: async (args) => {
    const conversationId = args.conversationId as string | undefined;
    if (!conversationId) {
      throw new Error("conversationId is required");
    }
    deleteConversation(conversationId);
    return JSON.stringify({ status: "deleted", conversationId }, null, 2);
  },
};
