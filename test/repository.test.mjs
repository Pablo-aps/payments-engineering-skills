import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateRepository } from "../scripts/validate-skills.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("all skills and evaluation cases satisfy repository rules", async () => {
  const result = await validateRepository();
  assert.deepEqual(result.errors, []);
  assert.equal(result.skillCount, 5);
  assert.ok(result.evaluationCount >= 40);
});

test("fixture scenarios use unique IDs and declare expected outcomes", async () => {
  const fixture = JSON.parse(await readFile(path.join(root, "fixtures", "failure-scenarios.json"), "utf8"));
  const ids = fixture.scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const scenario of fixture.scenarios) {
    assert.ok(scenario.skill);
    assert.ok(scenario.input);
    assert.ok(scenario.expected);
  }
});
