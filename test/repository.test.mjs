import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  assert.ok(result.hazardCount >= 50);
  assert.ok(result.evaluationCount >= 65);
  assert.ok(result.fixtureCount >= 20);
  assert.equal(result.benchmarkCaseCount, 5);
  assert.equal(result.exampleCount, 5);
});

test("fixture scenarios use unique IDs and declare expected outcomes", async () => {
  const fixture = JSON.parse(await readFile(path.join(root, "fixtures", "failure-scenarios.json"), "utf8"));
  const ids = fixture.scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const scenario of fixture.scenarios) {
    assert.ok(scenario.skill);
    assert.ok(scenario.input);
    assert.ok(scenario.expected);
    assert.ok(Array.isArray(scenario.hazards));
    assert.ok(scenario.hazards.length > 0);
  }
});

test("published Codex benchmark evidence is complete and fingerprinted", async () => {
  const raw = JSON.parse(
    await readFile(path.join(root, "benchmark", "results", "2026-08-18.codex.raw.json"), "utf8"),
  );
  const scores = JSON.parse(
    await readFile(path.join(root, "benchmark", "results", "2026-08-18.codex.scores.json"), "utf8"),
  );
  const report = await readFile(
    path.join(root, "benchmark", "results", "2026-08-18.codex.md"),
    "utf8",
  );
  const protocolHash = createHash("sha256");
  for (const [label, file] of [
    ["cases.json", path.join(root, "benchmark", "cases.json")],
    ["output.schema.json", path.join(root, "benchmark", "output.schema.json")],
    ["run.mjs", path.join(root, "benchmark", "run.mjs")],
  ]) {
    protocolHash.update(`${label}\0`);
    protocolHash.update(await readFile(file));
    if (label !== "run.mjs") protocolHash.update("\0");
  }

  assert.equal(raw.benchmark_version, 2);
  assert.equal(raw.methodology.protocol_sha256, protocolHash.digest("hex"));
  assert.equal(raw.runs.length, 10);
  assert.equal(scores.scores.length, 10);
  assert.match(report, /One trial per cell/);
  assert.match(report, /not a statistically significant model comparison/);

  const cells = new Set();
  for (const run of raw.runs) {
    assert.equal(run.agent, "codex");
    assert.equal(run.exit_code, 0);
    assert.ok(run.output);
    assert.match(run.artifact_sha256, /^[a-f0-9]{64}$/);
    if (run.mode === "baseline") {
      assert.equal(run.installed_skill_sha256, null);
    } else {
      assert.match(run.installed_skill_sha256, /^[a-f0-9]{64}$/);
    }
    const cell = `${run.case_id}/${run.mode}`;
    assert.ok(!cells.has(cell));
    cells.add(cell);
  }

  assert.equal(cells.size, 10);
});

test("social preview has GitHub's recommended dimensions and size", async () => {
  const preview = await readFile(path.join(root, "docs", "social-preview.png"));
  assert.equal(preview.subarray(1, 4).toString(), "PNG");
  assert.equal(preview.readUInt32BE(16), 1280);
  assert.equal(preview.readUInt32BE(20), 640);
  assert.ok(preview.byteLength < 1024 * 1024);
});
