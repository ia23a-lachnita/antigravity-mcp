import test from "node:test";
import assert from "node:assert/strict";
import { stripAnsi, buildAgyArgs, resolveAgyPath, isPtyAvailable, normalizeAgyModel } from "./agyPtyExecutor.js";

// ── ANSI stripping ──────────────────────────────────────────────────────────

test("stripAnsi removes color escape sequences", () => {
  const raw = "\x1b[32mHello\x1b[0m World";
  assert.equal(stripAnsi(raw), "Hello World");
});

test("stripAnsi removes cursor-movement sequences", () => {
  const raw = "\x1b[2J\x1b[H" + "clean text";
  assert.equal(stripAnsi(raw), "clean text");
});

test("stripAnsi removes OSC window-title sequences", () => {
  const raw = "\x1b]0;Window Title\x07" + "clean";
  assert.equal(stripAnsi(raw), "clean");
});

test("stripAnsi normalizes CRLF to LF", () => {
  const raw = "line1\r\nline2\r\nline3";
  assert.equal(stripAnsi(raw), "line1\nline2\nline3");
});

test("stripAnsi normalizes bare CR to LF", () => {
  const raw = "line1\rline2";
  assert.equal(stripAnsi(raw), "line1\nline2");
});

test("stripAnsi leaves plain text unchanged", () => {
  const text = "Hello, World! 123 #@$";
  assert.equal(stripAnsi(text), text);
});

test("stripAnsi handles complex TUI output with mixed sequences", () => {
  const raw =
    "\x1b[?1049h\x1b[?1h\x1b=\x1b[?2004h" +
    "\x1b[32m✓\x1b[0m " +
    "Gemini response here" +
    "\x1b[?1049l";
  const clean = stripAnsi(raw);
  assert.equal(clean.includes("Gemini response here"), true);
  assert.equal(clean.includes("\x1b"), false);
});

// ── normalizeAgyModel ───────────────────────────────────────────────────────

test("normalizeAgyModel strips -preview suffix", () => {
  assert.equal(normalizeAgyModel("gemini-3.1-pro-preview"), "gemini-3.1-pro");
});

test("normalizeAgyModel strips -exp suffix", () => {
  assert.equal(normalizeAgyModel("gemini-2.5-flash-exp"), "gemini-2.5-flash");
});

test("normalizeAgyModel strips -latest suffix", () => {
  assert.equal(normalizeAgyModel("gemini-3.5-flash-latest"), "gemini-3.5-flash");
});

test("normalizeAgyModel strips numeric variant suffixes", () => {
  assert.equal(normalizeAgyModel("gemini-2.5-pro-001"), "gemini-2.5-pro");
});

test("normalizeAgyModel leaves valid model IDs unchanged", () => {
  assert.equal(normalizeAgyModel("gemini-3.1-pro"), "gemini-3.1-pro");
  assert.equal(normalizeAgyModel("gemini-3.5-flash"), "gemini-3.5-flash");
});

// ── buildAgyArgs ────────────────────────────────────────────────────────────

test("buildAgyArgs includes prompt with -p flag", () => {
  const args = buildAgyArgs("hello world", {});
  const pIdx = args.indexOf("-p");
  assert.notEqual(pIdx, -1);
  assert.equal(args[pIdx + 1], "hello world");
});

test("buildAgyArgs includes model with --model flag", () => {
  const args = buildAgyArgs("hello", { model: "gemini-2.5-flash" });
  const mIdx = args.indexOf("--model");
  assert.notEqual(mIdx, -1);
  assert.equal(args[mIdx + 1], "gemini-2.5-flash");
});

test("buildAgyArgs normalizes model variants (e.g. -preview suffix)", () => {
  const args = buildAgyArgs("hello", { model: "gemini-3.1-pro-preview" });
  const mIdx = args.indexOf("--model");
  assert.notEqual(mIdx, -1);
  assert.equal(args[mIdx + 1], "gemini-3.1-pro");
});

test("buildAgyArgs includes --sandbox when sandbox=true", () => {
  const args = buildAgyArgs("hello", { sandbox: true });
  assert.equal(args.includes("--sandbox"), true);
});

test("buildAgyArgs omits --sandbox when sandbox=false", () => {
  const args = buildAgyArgs("hello", { sandbox: false });
  assert.equal(args.includes("--sandbox"), false);
});

test("buildAgyArgs always includes --dangerously-skip-permissions (print mode is non-interactive)", () => {
  // Print mode has no terminal for tool approval — always skip permissions
  const noMode = buildAgyArgs("hello", {});
  assert.equal(noMode.includes("--dangerously-skip-permissions"), true);
});

test("buildAgyArgs includes --dangerously-skip-permissions for yolo mode", () => {
  const args = buildAgyArgs("hello", { approvalMode: "yolo" });
  assert.equal(args.includes("--dangerously-skip-permissions"), true);
});

test("buildAgyArgs includes --dangerously-skip-permissions for auto_edit mode", () => {
  const args = buildAgyArgs("hello", { approvalMode: "auto_edit" });
  assert.equal(args.includes("--dangerously-skip-permissions"), true);
});

test("buildAgyArgs includes --dangerously-skip-permissions even for plan mode", () => {
  const args = buildAgyArgs("hello", { approvalMode: "plan" });
  assert.equal(args.includes("--dangerously-skip-permissions"), true);
});

test("buildAgyArgs includes --print-timeout with default value", () => {
  const args = buildAgyArgs("hello", {});
  const tIdx = args.indexOf("--print-timeout");
  assert.notEqual(tIdx, -1);
  assert.equal(args[tIdx + 1], "5m0s");
});

test("buildAgyArgs uses custom printTimeout when provided", () => {
  const args = buildAgyArgs("hello", { printTimeout: "2m0s" });
  const tIdx = args.indexOf("--print-timeout");
  assert.notEqual(tIdx, -1);
  assert.equal(args[tIdx + 1], "2m0s");
});

// ── resolveAgyPath ──────────────────────────────────────────────────────────

test("resolveAgyPath returns AGY_CLI_PATH override when set", () => {
  process.env.AGY_CLI_PATH = "C:\\custom\\agy.exe";
  const resolved = resolveAgyPath();
  assert.equal(resolved, "C:\\custom\\agy.exe");
  delete process.env.AGY_CLI_PATH;
});

test("resolveAgyPath strips surrounding quotes from AGY_CLI_PATH", () => {
  process.env.AGY_CLI_PATH = '"C:\\custom\\agy.exe"';
  const resolved = resolveAgyPath();
  assert.equal(resolved, "C:\\custom\\agy.exe");
  delete process.env.AGY_CLI_PATH;
});

test("resolveAgyPath returns a non-empty string when no override", () => {
  delete process.env.AGY_CLI_PATH;
  const resolved = resolveAgyPath();
  assert.equal(typeof resolved, "string");
  assert.ok(resolved.length > 0);
});

// ── isPtyAvailable ───────────────────────────────────────────────────────────

test("isPtyAvailable returns a boolean", () => {
  const result = isPtyAvailable();
  assert.equal(typeof result, "boolean");
});
