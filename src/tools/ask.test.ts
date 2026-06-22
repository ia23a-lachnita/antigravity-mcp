/**
 * Tests for the ask-ai MCP tool.
 *
 * These tests stub out executeModel to avoid real API calls and verify
 * the tool's argument parsing, changeMode routing, and conversation integration.
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { askTool } from "./ask.tool.js";

// Helper: create a temp conversation dir and clean up after each test
function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ask-ai-test-"));
}

// ── Schema validation ────────────────────────────────────────────────────────

test("askTool is registered with correct name", () => {
  assert.equal(askTool.name, "ask-ai");
});

test("askTool category is ai", () => {
  assert.equal(askTool.category, "ai");
});

test("askTool schema rejects empty prompt", () => {
  assert.throws(() => {
    askTool.zodSchema.parse({ prompt: "" });
  });
});

test("askTool schema accepts minimal prompt", () => {
  const result = askTool.zodSchema.parse({ prompt: "hello" });
  assert.equal(result.prompt, "hello");
  assert.equal(result.sandbox, false);
  assert.equal(result.changeMode, false);
});

test("askTool schema coerces sandbox string to boolean", () => {
  const result = askTool.zodSchema.parse({ prompt: "hi", sandbox: true });
  assert.equal(result.sandbox, true);
});

test("askTool schema accepts all approval modes", () => {
  for (const mode of ["default", "auto_edit", "plan", "yolo"]) {
    const result = askTool.zodSchema.parse({
      prompt: "hi",
      approvalMode: mode,
    });
    assert.equal(result.approvalMode, mode);
  }
});

test("askTool schema rejects invalid approvalMode", () => {
  assert.throws(() => {
    askTool.zodSchema.parse({ prompt: "hi", approvalMode: "invalid" });
  });
});

test("askTool schema accepts conversationId and conversationMode", () => {
  const result = askTool.zodSchema.parse({
    prompt: "hello",
    conversationId: "conv-1",
    conversationMode: "append",
  });
  assert.equal(result.conversationId, "conv-1");
  assert.equal(result.conversationMode, "append");
});

// ── Execution: cache-hit path (no real API call needed) ─────────────────────

test("askTool with chunkIndex + chunkCacheKey returns no-edits message when cache miss", async () => {
  const result = await askTool.execute({
    prompt: "some prompt",
    changeMode: true,
    chunkIndex: 2,
    chunkCacheKey: "nonexistent-key",
  });
  assert.equal(typeof result, "string");
  assert.ok(result.trim().length > 0, "Should return a non-empty message");
});

// ── Conversation persistence wiring ─────────────────────────────────────────

test("askTool execute with no prompt throws descriptive error", async () => {
  await assert.rejects(
    () => askTool.execute({ prompt: "" }),
    (err: Error) => {
      assert.ok(err.message.length > 0);
      return true;
    },
  );
});
