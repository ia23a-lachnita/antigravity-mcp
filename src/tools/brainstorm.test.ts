/**
 * Tests for the brainstorm MCP tool schema and prompt building.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { brainstormTool } from "./brainstorm.tool.js";

test("brainstorm tool is registered with correct name", () => {
  assert.equal(brainstormTool.name, "brainstorm");
});

test("brainstorm schema accepts minimal prompt", () => {
  const result = brainstormTool.zodSchema.parse({ prompt: "ideas for a mobile app" });
  assert.equal(result.prompt, "ideas for a mobile app");
  assert.equal(result.methodology, "auto");
  assert.equal(result.ideaCount, 12);
  assert.equal(result.includeAnalysis, true);
});

test("brainstorm schema rejects empty prompt", () => {
  assert.throws(() => brainstormTool.zodSchema.parse({ prompt: "" }));
});

test("brainstorm schema accepts all methodology values", () => {
  for (const m of ["divergent", "convergent", "scamper", "design-thinking", "lateral", "auto"]) {
    const result = brainstormTool.zodSchema.parse({
      prompt: "hello",
      methodology: m,
    });
    assert.equal(result.methodology, m);
  }
});

test("brainstorm schema rejects invalid methodology", () => {
  assert.throws(() =>
    brainstormTool.zodSchema.parse({ prompt: "hello", methodology: "invalid" })
  );
});

test("brainstorm schema accepts domain, constraints, existingContext", () => {
  const result = brainstormTool.zodSchema.parse({
    prompt: "hello",
    domain: "software",
    constraints: "budget < $1000",
    existingContext: "we already tried X",
  });
  assert.equal(result.domain, "software");
  assert.equal(result.constraints, "budget < $1000");
  assert.equal(result.existingContext, "we already tried X");
});

test("brainstorm schema accepts ideaCount", () => {
  const result = brainstormTool.zodSchema.parse({ prompt: "hello", ideaCount: 5 });
  assert.equal(result.ideaCount, 5);
});

test("brainstorm execute rejects empty prompt at runtime", async () => {
  await assert.rejects(() => brainstormTool.execute({ prompt: "  " }));
});
