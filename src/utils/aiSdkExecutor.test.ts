import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { expandFileReferences, hasGeminiApiKey, resolveGeminiApiKey } from "./aiSdkExecutor.js";

// ── API key resolution ──────────────────────────────────────────────────────

test("resolveGeminiApiKey picks GEMINI_API_KEY first", () => {
  process.env.GEMINI_API_KEY = "key-primary";
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "key-secondary";
  assert.equal(resolveGeminiApiKey(), "key-primary");
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
});

test("resolveGeminiApiKey falls back to GOOGLE_GENERATIVE_AI_API_KEY", () => {
  delete process.env.GEMINI_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "key-secondary";
  assert.equal(resolveGeminiApiKey(), "key-secondary");
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
});

test("resolveGeminiApiKey falls back to GOOGLE_API_KEY", () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GOOGLE_API_KEY = "key-tertiary";
  assert.equal(resolveGeminiApiKey(), "key-tertiary");
  delete process.env.GOOGLE_API_KEY;
});

test("resolveGeminiApiKey returns undefined when no key set", () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  assert.equal(resolveGeminiApiKey(), undefined);
});

test("hasGeminiApiKey returns true when key is set", () => {
  process.env.GEMINI_API_KEY = "test-key";
  assert.equal(hasGeminiApiKey(), true);
  delete process.env.GEMINI_API_KEY;
});

test("hasGeminiApiKey returns false when no key", () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  assert.equal(hasGeminiApiKey(), false);
});

// ── @file reference expansion ───────────────────────────────────────────────

test("expandFileReferences inlines an existing file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-test-"));
  const filePath = path.join(tmpDir, "hello.ts");
  fs.writeFileSync(filePath, "const x = 1;", "utf-8");

  // File references must use @ prefix
  const prompt = `analyze @${filePath}`;
  const expanded = expandFileReferences(prompt);
  assert.equal(expanded.includes("const x = 1;"), true);
  assert.equal(expanded.includes("[File:"), true);
  assert.equal(expanded.includes("```ts"), true);

  fs.rmSync(tmpDir, { recursive: true });
});

test("expandFileReferences leaves @ref unchanged when file missing", () => {
  const prompt = "analyze @/does/not/exist.ts";
  const expanded = expandFileReferences(prompt);
  assert.equal(expanded, prompt);
});

test("expandFileReferences handles multiple file refs in one prompt", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-test-multi-"));
  const file1 = path.join(tmpDir, "a.ts");
  const file2 = path.join(tmpDir, "b.ts");
  fs.writeFileSync(file1, "const a = 1;", "utf-8");
  fs.writeFileSync(file2, "const b = 2;", "utf-8");

  // Each file reference requires @ prefix
  const prompt = `compare @${file1} and @${file2}`;
  const expanded = expandFileReferences(prompt);
  assert.equal(expanded.includes("const a = 1;"), true);
  assert.equal(expanded.includes("const b = 2;"), true);

  fs.rmSync(tmpDir, { recursive: true });
});

test("expandFileReferences resolves relative paths against provided baseDir", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-test-rel-"));
  const filePath = path.join(tmpDir, "rel.ts");
  fs.writeFileSync(filePath, "export default 42;", "utf-8");

  const prompt = "analyze @rel.ts";
  const expanded = expandFileReferences(prompt, tmpDir);
  assert.equal(expanded.includes("export default 42;"), true);

  fs.rmSync(tmpDir, { recursive: true });
});

test("expandFileReferences passes through prompt without @ refs unchanged", () => {
  const prompt = "explain how recursion works";
  assert.equal(expandFileReferences(prompt), prompt);
});
