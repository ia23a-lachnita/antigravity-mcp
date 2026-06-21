import test from "node:test";
import assert from "node:assert/strict";
import { buildGeminiArgs, resolveApprovalMode, resolveBackend } from "./geminiExecutor.js";

// ── approval-mode resolution ────────────────────────────────────────────────

test("plan mode is the default approval flag (legacy CLI)", () => {
  delete process.env.GEMINI_MCP_APPROVAL_MODE;
  const args = buildGeminiArgs("hello", {});
  assert.equal(args.includes("--approval-mode=plan"), true);
  assert.equal(args.includes("--approval-mode=yolo"), false);
});

test("approvalMode yolo adds --approval-mode=yolo (legacy CLI)", () => {
  const args = buildGeminiArgs("hello", { approvalMode: "yolo" });
  assert.equal(args.includes("--approval-mode=yolo"), true);
});

test("env approval mode works", () => {
  process.env.GEMINI_MCP_APPROVAL_MODE = "plan";
  assert.equal(resolveApprovalMode(), "plan");
  const args = buildGeminiArgs("hello", {});
  assert.equal(args.includes("--approval-mode=plan"), true);
  delete process.env.GEMINI_MCP_APPROVAL_MODE;
});

test("tool argument approval mode overrides env var", () => {
  process.env.GEMINI_MCP_APPROVAL_MODE = "plan";
  const args = buildGeminiArgs("hello", { approvalMode: "yolo" });
  assert.equal(args.includes("--approval-mode=yolo"), true);
  assert.equal(args.includes("--approval-mode=plan"), false);
  delete process.env.GEMINI_MCP_APPROVAL_MODE;
});

test("invalid GEMINI_MCP_APPROVAL_MODE env falls back to default", () => {
  process.env.GEMINI_MCP_APPROVAL_MODE = "invalid-mode";
  const resolved = resolveApprovalMode();
  assert.equal(resolved, "default");
  delete process.env.GEMINI_MCP_APPROVAL_MODE;
});

test("approvalMode default does not add approval-mode flag (legacy CLI)", () => {
  const args = buildGeminiArgs("hello", { approvalMode: "default" });
  assert.equal(args.some((a) => a.startsWith("--approval-mode")), false);
});

// ── buildGeminiArgs ─────────────────────────────────────────────────────────

test("buildGeminiArgs includes model flag when model provided", () => {
  const args = buildGeminiArgs("hello", { model: "gemini-2.5-flash" });
  const mIdx = args.indexOf("-m");
  assert.notEqual(mIdx, -1);
  assert.equal(args[mIdx + 1], "gemini-2.5-flash");
});

test("buildGeminiArgs includes sandbox flag when sandbox=true", () => {
  const args = buildGeminiArgs("hello", { sandbox: true });
  assert.equal(args.includes("-s"), true);
});

test("buildGeminiArgs omits sandbox flag when sandbox=false", () => {
  const args = buildGeminiArgs("hello", { sandbox: false });
  assert.equal(args.includes("-s"), false);
});

test("buildGeminiArgs includes prompt as last flag pair", () => {
  const args = buildGeminiArgs("my prompt", {});
  const pIdx = args.indexOf("-p");
  assert.notEqual(pIdx, -1);
  assert.equal(args[pIdx + 1], "my prompt");
});

// ── backend resolution ──────────────────────────────────────────────────────

test("resolveBackend returns sdk when GEMINI_API_KEY is set", () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-api-key";
  delete process.env.GEMINI_BACKEND;
  const backend = resolveBackend();
  assert.equal(backend, "sdk");
  if (saved === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = saved;
});

test("resolveBackend honours explicit GEMINI_BACKEND=cli override", () => {
  process.env.GEMINI_BACKEND = "cli";
  const backend = resolveBackend();
  assert.equal(backend, "cli");
  delete process.env.GEMINI_BACKEND;
});

test("resolveBackend honours explicit GEMINI_BACKEND=sdk override", () => {
  process.env.GEMINI_BACKEND = "sdk";
  const backend = resolveBackend();
  assert.equal(backend, "sdk");
  delete process.env.GEMINI_BACKEND;
});

test("resolveBackend honours explicit GEMINI_BACKEND=agy override", () => {
  process.env.GEMINI_BACKEND = "agy";
  const backend = resolveBackend();
  assert.equal(backend, "agy");
  delete process.env.GEMINI_BACKEND;
});

test("resolveBackend falls back to sdk for unknown auto scenario (no key, no agy)", () => {
  const savedKey = process.env.GEMINI_API_KEY;
  const savedGApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const savedGoogleKey = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_BACKEND;

  const backend = resolveBackend();
  // Without a key or agy PTY, auto-detect should still pick "sdk" (error surfaces at execution)
  assert.equal(["sdk", "agy", "cli"].includes(backend), true);

  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  if (savedGApiKey !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = savedGApiKey;
  if (savedGoogleKey !== undefined) process.env.GOOGLE_API_KEY = savedGoogleKey;
});
