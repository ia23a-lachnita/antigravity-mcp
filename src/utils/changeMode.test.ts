/**
 * Tests for changeModeParser, changeModeTranslator, changeModeChunker, and chunkCache.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseChangeModeOutput, validateChangeModeEdits } from "./changeModeParser.js";
import { formatChangeModeResponse, summarizeChangeModeEdits } from "./changeModeTranslator.js";
import { chunkChangeModeEdits } from "./changeModeChunker.js";
import { cacheChunks, getChunks, clearCache } from "./chunkCache.js";

// ── parseChangeModeOutput ────────────────────────────────────────────────────

const SAMPLE_CHANGE_RESPONSE = `
**FILE: src/utils/helper.js:10**
\`\`\`
OLD:
function hello() {
  return "world";
}
NEW:
function hello() {
  return "universe";
}
\`\`\`

**FILE: src/index.ts:5**
\`\`\`
OLD:
const x = 1;
NEW:
const x = 2;
\`\`\`
`;

test("parseChangeModeOutput extracts edits from markdown format", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  assert.equal(edits.length, 2);
});

test("parseChangeModeOutput captures filenames correctly", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  assert.equal(edits[0].filename, "src/utils/helper.js");
  assert.equal(edits[1].filename, "src/index.ts");
});

test("parseChangeModeOutput captures old/new code blocks", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  assert.equal(edits[0].oldCode.includes("return \"world\""), true);
  assert.equal(edits[0].newCode.includes("return \"universe\""), true);
  assert.equal(edits[1].oldCode.includes("const x = 1"), true);
  assert.equal(edits[1].newCode.includes("const x = 2"), true);
});

test("parseChangeModeOutput captures start line numbers", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  assert.equal(edits[0].oldStartLine, 10);
  assert.equal(edits[1].oldStartLine, 5);
});

test("parseChangeModeOutput returns empty array for non-matching input", () => {
  const edits = parseChangeModeOutput("just some plain text with no edits");
  assert.equal(edits.length, 0);
});

test("parseChangeModeOutput handles single edit", () => {
  const single = `**FILE: app.ts:1**
\`\`\`
OLD:
const a = 0;
NEW:
const a = 1;
\`\`\``;
  const edits = parseChangeModeOutput(single);
  assert.equal(edits.length, 1);
});

// ── validateChangeModeEdits ──────────────────────────────────────────────────

test("validateChangeModeEdits passes for well-formed edits", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const { valid } = validateChangeModeEdits(edits);
  assert.equal(valid, true);
});

test("validateChangeModeEdits fails for edit missing filename", () => {
  const { valid, errors } = validateChangeModeEdits([{
    filename: "",
    oldStartLine: 1,
    oldEndLine: 2,
    oldCode: "a",
    newStartLine: 1,
    newEndLine: 2,
    newCode: "b",
  }]);
  assert.equal(valid, false);
  assert.equal(errors.length > 0, true);
});

test("validateChangeModeEdits fails when both old and new code are empty", () => {
  const { valid } = validateChangeModeEdits([{
    filename: "foo.ts",
    oldStartLine: 1,
    oldEndLine: 1,
    oldCode: "",
    newStartLine: 1,
    newEndLine: 1,
    newCode: "",
  }]);
  assert.equal(valid, false);
});

// ── formatChangeModeResponse ─────────────────────────────────────────────────

test("formatChangeModeResponse includes edit count in header", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const response = formatChangeModeResponse(edits);
  assert.equal(response.includes("2 modification"), true);
});

test("formatChangeModeResponse includes chunk info when chunkInfo provided", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const response = formatChangeModeResponse(edits, { current: 1, total: 3, cacheKey: "abc" });
  assert.equal(response.includes("Chunk 1 of 3"), true);
});

test("formatChangeModeResponse includes OLD and NEW code blocks", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const response = formatChangeModeResponse(edits);
  assert.equal(response.includes("return \"world\""), true);
  assert.equal(response.includes("return \"universe\""), true);
});

test("formatChangeModeResponse includes fetch-chunk instruction when not last chunk", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const response = formatChangeModeResponse(
    edits.slice(0, 1),
    { current: 1, total: 2, cacheKey: "testkey123" }
  );
  assert.equal(response.includes("fetch-chunk"), true);
  assert.equal(response.includes("testkey123"), true);
});

// ── summarizeChangeModeEdits ─────────────────────────────────────────────────

test("summarizeChangeModeEdits shows total edit count", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const summary = summarizeChangeModeEdits(edits);
  assert.equal(summary.includes("Total edits: 2"), true);
});

test("summarizeChangeModeEdits shows files affected", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const summary = summarizeChangeModeEdits(edits);
  assert.equal(summary.includes("Files affected: 2"), true);
});

// ── chunkChangeModeEdits ─────────────────────────────────────────────────────

test("chunkChangeModeEdits returns single chunk for small edit set", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const chunks = chunkChangeModeEdits(edits, 100000);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].edits.length, 2);
});

test("chunkChangeModeEdits splits into multiple chunks when size exceeded", () => {
  // Each edit is ~300 bytes overhead + content; use 400 byte limit to force split
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const chunks = chunkChangeModeEdits(edits, 400);
  assert.equal(chunks.length >= 2, true);
});

test("chunkChangeModeEdits handles empty edit list", () => {
  const chunks = chunkChangeModeEdits([]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].edits.length, 0);
});

test("chunkChangeModeEdits sets hasMore correctly", () => {
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const chunks = chunkChangeModeEdits(edits, 400);
  if (chunks.length > 1) {
    assert.equal(chunks[0].hasMore, true);
    assert.equal(chunks[chunks.length - 1].hasMore, false);
  }
});

// ── chunkCache ───────────────────────────────────────────────────────────────

test("cacheChunks stores and getChunks retrieves within TTL", () => {
  clearCache();
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const chunks = chunkChangeModeEdits(edits, 100000);
  const key = cacheChunks("test-prompt-unique-12345", chunks);
  assert.equal(typeof key, "string");
  assert.equal(key.length > 0, true);

  const retrieved = getChunks(key);
  assert.ok(retrieved);
  assert.equal(retrieved.length, chunks.length);
});

test("getChunks returns null for unknown cache key", () => {
  const result = getChunks("definitely-not-a-real-key-xyz");
  assert.equal(result, null);
});

test("cacheChunks returns deterministic key for same prompt", () => {
  clearCache();
  const edits = parseChangeModeOutput(SAMPLE_CHANGE_RESPONSE);
  const chunks = chunkChangeModeEdits(edits);
  const key1 = cacheChunks("deterministic-prompt", chunks);
  const key2 = cacheChunks("deterministic-prompt", chunks);
  assert.equal(key1, key2);
});
