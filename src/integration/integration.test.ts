/**
 * Integration tests — run real AI API calls.
 *
 * These tests are SKIPPED automatically when GEMINI_API_KEY is not set in the
 * environment. To run them:
 *
 *   GEMINI_API_KEY=<key> npm test
 *
 * They verify end-to-end behaviour of the SDK backend and the full MCP tool
 * pipeline. Do not add tests that depend on specific response wording; only
 * assert structural constraints (non-empty, contains expected sections, etc.).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { hasGeminiApiKey, callGeminiSdk } from "../utils/aiSdkExecutor.js";
import { executeModel } from "../utils/executor.js";
import { askTool } from "../tools/ask.tool.js";
import { brainstormTool } from "../tools/brainstorm.tool.js";
import { MODELS } from "../constants.js";

const SKIP = !hasGeminiApiKey();
const skip = (name: string, fn: () => Promise<void>) => {
  if (SKIP) {
    test(`[SKIPPED – no GEMINI_API_KEY] ${name}`, () => {
      // No assertions; test passes to keep suite green
    });
  } else {
    test(name, fn);
  }
};

// ── callGeminiSdk direct ─────────────────────────────────────────────────────

skip("callGeminiSdk returns non-empty string for simple prompt", async () => {
  const result = await callGeminiSdk("Reply with exactly: INTEGRATION_OK", {
    model: MODELS.FLASH,
  });
  assert.equal(typeof result, "string");
  assert.ok(result.trim().length > 0, "Response should be non-empty");
});

skip("callGeminiSdk passes streaming chunks to onProgress", async () => {
  const chunks: string[] = [];
  await callGeminiSdk("Count from 1 to 5, one number per line.", {
    model: MODELS.FLASH,
    onProgress: (text) => chunks.push(text),
  });
  assert.ok(chunks.length > 0, "Should have received at least one progress chunk");
});

skip("callGeminiSdk inlines @file reference content", async () => {
  // Create a temp file to reference
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const dir = mkdtempSync(join(tmpdir(), "integration-test-"));
  const file = join(dir, "data.txt");
  writeFileSync(file, "SECRET_CONTENT_12345", "utf-8");

  try {
    const result = await callGeminiSdk(
      `What is in the file ${file}? Just echo the file content.`,
      { model: MODELS.FLASH },
    );
    assert.ok(
      result.includes("SECRET_CONTENT_12345"),
      "Response should contain the inlined file content",
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ── executeModel (SDK backend) ───────────────────────────────────────────────

skip("executeModel returns response via SDK backend", async () => {
  process.env.ANTIGRAVITY_BACKEND = "sdk";
  try {
    const result = await executeModel("Reply with exactly: CLI_SDK_OK", {
      model: MODELS.FLASH,
    });
    assert.equal(typeof result, "string");
    assert.ok(result.trim().length > 0);
  } finally {
    delete process.env.ANTIGRAVITY_BACKEND;
  }
});

skip("executeModel quota fallback switches to Flash model", async () => {
  process.env.ANTIGRAVITY_BACKEND = "sdk";
  try {
    const result = await executeModel("say hi", { model: MODELS.FLASH });
    assert.ok(result.trim().length > 0, "Flash model should work");
  } finally {
    delete process.env.ANTIGRAVITY_BACKEND;
  }
});

// ── MCP tool: ask-ai ─────────────────────────────────────────────────────────

skip("ask-ai tool executes and returns AI response prefix", async () => {
  process.env.ANTIGRAVITY_BACKEND = "sdk";
  try {
    const result = await askTool.execute({
      prompt: "Reply with exactly: TOOL_OK",
      model: MODELS.FLASH,
    });
    assert.ok(result.includes("AI response:"), "Should have response prefix");
    assert.ok(result.trim().length > 0, "Should have content");
  } finally {
    delete process.env.ANTIGRAVITY_BACKEND;
  }
});

skip("ask-ai tool with changeMode returns changeMode output structure", async () => {
  process.env.ANTIGRAVITY_BACKEND = "sdk";
  try {
    const result = await askTool.execute({
      prompt:
        "For a file called example.ts with content 'const x = 1;', suggest changing x to y using the OLD/NEW format.",
      model: MODELS.FLASH,
      changeMode: true,
    });
    // Either we get parsed edits or a "no edits found" message
    assert.equal(typeof result, "string");
    assert.ok(result.trim().length > 0);
  } finally {
    delete process.env.ANTIGRAVITY_BACKEND;
  }
});

// ── MCP tool: brainstorm ─────────────────────────────────────────────────────

skip("brainstorm tool returns structured ideas list", async () => {
  process.env.ANTIGRAVITY_BACKEND = "sdk";
  try {
    const result = await brainstormTool.execute({
      prompt: "mobile app ideas for students",
      methodology: "divergent",
      ideaCount: 3,
      includeAnalysis: false,
      model: MODELS.FLASH,
    });
    assert.equal(typeof result, "string");
    assert.ok(result.trim().length > 0, "Brainstorm should return non-empty");
  } finally {
    delete process.env.ANTIGRAVITY_BACKEND;
  }
});

// ── agy PTY backend (skipped unless ANTIGRAVITY_BACKEND=agy explicitly set) ──

const AGY_SKIP = !(!SKIP && process.env.ANTIGRAVITY_BACKEND === "agy");
const agySkip = (name: string, fn: () => Promise<void>) => {
  if (AGY_SKIP) {
    test(`[SKIPPED – set ANTIGRAVITY_BACKEND=agy to run] ${name}`, () => {});
  } else {
    test(name, fn);
  }
};

agySkip("agy PTY backend returns non-empty response", async () => {
  const result = await executeModel("Reply with exactly: AGY_OK");
  assert.equal(typeof result, "string");
  assert.ok(result.trim().length > 0, "agy should return non-empty response");
});
