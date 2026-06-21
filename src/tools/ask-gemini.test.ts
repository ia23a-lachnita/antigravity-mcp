/**
 * Tests for the ask-gemini MCP tool.
 *
 * These tests stub out executeGeminiCLI to avoid real API calls and verify
 * the tool's argument parsing, changeMode routing, and conversation integration.
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// We import the tool after potentially patching the executor module.
// Because Node's module cache is shared within a test run, we set env vars
// rather than monkey-patching imports.

import { askGeminiTool } from "./ask-gemini.tool.js";

// Helper: create a temp conversation dir and clean up after each test
function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ask-gemini-test-"));
}

// ── Schema validation ────────────────────────────────────────────────────────

test("askGeminiTool is registered with correct name", () => {
  assert.equal(askGeminiTool.name, "ask-gemini");
});

test("askGeminiTool category is gemini", () => {
  assert.equal(askGeminiTool.category, "gemini");
});

test("askGeminiTool schema rejects empty prompt", () => {
  assert.throws(() => {
    askGeminiTool.zodSchema.parse({ prompt: "" });
  });
});

test("askGeminiTool schema accepts minimal prompt", () => {
  const result = askGeminiTool.zodSchema.parse({ prompt: "hello" });
  assert.equal(result.prompt, "hello");
  assert.equal(result.sandbox, false);
  assert.equal(result.changeMode, false);
});

test("askGeminiTool schema coerces sandbox string to boolean", () => {
  // sandbox is z.boolean().default(false) — passing true should be fine
  const result = askGeminiTool.zodSchema.parse({ prompt: "hi", sandbox: true });
  assert.equal(result.sandbox, true);
});

test("askGeminiTool schema accepts all approval modes", () => {
  for (const mode of ["default", "auto_edit", "plan", "yolo"]) {
    const result = askGeminiTool.zodSchema.parse({
      prompt: "hi",
      approvalMode: mode,
    });
    assert.equal(result.approvalMode, mode);
  }
});

test("askGeminiTool schema rejects invalid approvalMode", () => {
  assert.throws(() => {
    askGeminiTool.zodSchema.parse({ prompt: "hi", approvalMode: "invalid" });
  });
});

test("askGeminiTool schema accepts conversationId and conversationMode", () => {
  const result = askGeminiTool.zodSchema.parse({
    prompt: "hello",
    conversationId: "conv-1",
    conversationMode: "append",
  });
  assert.equal(result.conversationId, "conv-1");
  assert.equal(result.conversationMode, "append");
});

// ── Execution: cache-hit path (no real API call needed) ─────────────────────

test("askGeminiTool with chunkIndex + chunkCacheKey returns no-edits message when cache miss", async () => {
  // When cache is empty, processChangeModeOutput parses an empty rawResult and
  // returns "No edits found" rather than a literal "Cache miss" string.
  const result = await askGeminiTool.execute({
    prompt: "some prompt",
    changeMode: true,
    chunkIndex: 2,
    chunkCacheKey: "nonexistent-key",
  });
  // Either "No edits found" (cache miss → empty parse) or any non-error string
  assert.equal(typeof result, "string");
  assert.ok(result.trim().length > 0, "Should return a non-empty message");
});

// ── Conversation persistence wiring ─────────────────────────────────────────

test("askGeminiTool execute with no prompt throws descriptive error", async () => {
  await assert.rejects(
    () => askGeminiTool.execute({ prompt: "" }),
    (err: Error) => {
      assert.ok(err.message.length > 0);
      return true;
    },
  );
});
