/**
 * Tests for the MCP tool registry — getToolDefinitions, getPromptDefinitions,
 * toolExists, executeTool, getPromptMessage.
 */
import test from "node:test";
import assert from "node:assert/strict";

// Import index to register all tools
import "../tools/index.js";
import {
  getToolDefinitions,
  getPromptDefinitions,
  toolExists,
  getPromptMessage,
  toolRegistry,
} from "./registry.js";

// ── registration ─────────────────────────────────────────────────────────────

const EXPECTED_TOOLS = [
  "ask-gemini",
  "ping",
  "Help",
  "brainstorm",
  "fetch-chunk",
  "timeout-test",
  "list-gemini-conversations",
  "read-gemini-conversation",
  "clear-gemini-conversation",
  "delete-gemini-conversation",
];

test("all expected tools are registered", () => {
  for (const name of EXPECTED_TOOLS) {
    assert.equal(toolExists(name), true, `${name} should be registered`);
  }
});

test("getToolDefinitions returns correct number of tools", () => {
  const defs = getToolDefinitions();
  assert.equal(defs.length >= EXPECTED_TOOLS.length, true);
});

test("each tool definition has name, description, and inputSchema", () => {
  for (const def of getToolDefinitions()) {
    assert.equal(typeof def.name, "string");
    assert.equal(typeof def.description, "string");
    assert.equal(typeof def.inputSchema, "object");
    assert.equal(def.inputSchema.type, "object");
  }
});

test("toolExists returns false for unknown tool", () => {
  assert.equal(toolExists("nonexistent-tool-xyz"), false);
});

// ── prompt definitions ────────────────────────────────────────────────────────

test("getPromptDefinitions returns an array", () => {
  const defs = getPromptDefinitions();
  assert.equal(Array.isArray(defs), true);
});

test("each prompt definition has name and description", () => {
  for (const def of getPromptDefinitions()) {
    assert.equal(typeof def.name, "string");
    assert.equal(typeof def.description, "string");
  }
});

// ── getPromptMessage ─────────────────────────────────────────────────────────

test("getPromptMessage builds message for ask-gemini", () => {
  const msg = getPromptMessage("ask-gemini", { prompt: "explain recursion" });
  assert.equal(msg.includes("ask-gemini"), true);
  assert.equal(msg.includes("explain recursion"), true);
});

test("getPromptMessage includes non-boolean args as (key: value)", () => {
  const msg = getPromptMessage("ask-gemini", {
    prompt: "hello",
    model: "gemini-2.5-flash",
  });
  assert.equal(msg.includes("(model: gemini-2.5-flash)"), true);
});

test("getPromptMessage includes boolean true args as [key]", () => {
  const msg = getPromptMessage("ask-gemini", {
    prompt: "hello",
    sandbox: true,
  });
  assert.equal(msg.includes("[sandbox]"), true);
});

test("getPromptMessage omits false boolean args", () => {
  const msg = getPromptMessage("ask-gemini", {
    prompt: "hello",
    sandbox: false,
  });
  assert.equal(msg.includes("[sandbox]"), false);
});

test("getPromptMessage throws for unknown tool", () => {
  assert.throws(() => getPromptMessage("nonexistent", {}));
});

// ── inputSchema structure ─────────────────────────────────────────────────────

test("ask-gemini tool definition has prompt in required fields", () => {
  const defs = getToolDefinitions();
  const askGemini = defs.find((d) => d.name === "ask-gemini");
  assert.ok(askGemini);
  assert.equal(Array.isArray(askGemini.inputSchema.required) ?
    askGemini.inputSchema.required.includes("prompt") : false, true);
});

test("ping tool definition exists with object inputSchema", () => {
  const defs = getToolDefinitions();
  const ping = defs.find((d) => d.name === "ping");
  assert.ok(ping);
  assert.equal(ping.inputSchema.type, "object");
});
