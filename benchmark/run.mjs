#!/usr/bin/env node

import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const benchmarkDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(benchmarkDirectory, "..");
const runnerPath = fileURLToPath(import.meta.url);
const schemaPath = path.join(benchmarkDirectory, "output.schema.json");
const casesPath = path.join(benchmarkDirectory, "cases.json");
const codexModel = process.env.BENCHMARK_CODEX_MODEL || "gpt-5.6-sol";
const claudeModel = process.env.BENCHMARK_CLAUDE_MODEL || "sonnet";

function parseArguments(argv) {
  const options = {
    agents: ["codex", "claude"],
    modes: ["baseline", "skill"],
    caseIds: [],
    output: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--agent") {
      options.agents = value === "all" ? ["codex", "claude"] : [value];
      index += 1;
    } else if (argument === "--mode") {
      options.modes = value === "both" ? ["baseline", "skill"] : [value];
      index += 1;
    } else if (argument === "--case") {
      options.caseIds.push(value);
      index += 1;
    } else if (argument === "--output") {
      options.output = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!options.output) throw new Error("--output is required");
  for (const agent of options.agents) {
    if (!new Set(["codex", "claude"]).has(agent)) throw new Error(`Unsupported agent: ${agent}`);
  }
  for (const mode of options.modes) {
    if (!new Set(["baseline", "skill"]).has(mode)) throw new Error(`Unsupported mode: ${mode}`);
  }
  return options;
}

function commandVersion(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unavailable";
}

function parseJsonObject(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new Error("Agent did not return a JSON object");
  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function sha256(parts) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
}

async function hashDirectory(directory) {
  const parts = [];

  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        parts.push(path.relative(directory, absolute), "\0", await readFile(absolute), "\0");
      }
    }
  }

  await visit(directory);
  return sha256(parts);
}

async function prepareWorkspace(testCase, agent, mode) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), `payment-skill-${agent}-${mode}-`));
  await cp(path.join(root, testCase.artifact), path.join(workspace, "case.md"));

  if (mode === "skill") {
    const skillTarget = agent === "codex"
      ? path.join(workspace, ".agents", "skills", testCase.skill)
      : path.join(workspace, ".claude", "skills", testCase.skill);
    await mkdir(path.dirname(skillTarget), { recursive: true });
    await cp(path.join(root, "skills", testCase.skill), skillTarget, { recursive: true });
  }
  return workspace;
}

async function runCodex(workspace, prompt) {
  const finalOutputPath = path.join(workspace, "codex-final.json");
  const args = [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox", "read-only",
    "--skip-git-repo-check",
    "--json",
    "--model", codexModel,
    "--cd", workspace,
    "--output-schema", schemaPath,
    "--output-last-message", finalOutputPath,
    prompt,
  ];
  const startedAt = Date.now();
  const process = spawnSync("codex", args, {
    cwd: workspace,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt;
  let output = null;
  try {
    output = parseJsonObject(await readFile(finalOutputPath, "utf8"));
  } catch (error) {
    if (process.status === 0) throw error;
  }
  const events = process.stdout
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  const usageEvent = [...events].reverse().find((event) => event.usage || event.type === "turn.completed");
  return {
    exit_code: process.status,
    duration_ms: durationMs,
    requested_model: codexModel,
    resolved_models: [codexModel],
    usage: usageEvent?.usage ?? usageEvent?.turn?.usage ?? null,
    output,
    error: process.status === 0 ? null : process.stderr.trim().slice(-4000),
  };
}

async function runClaude(workspace, prompt, schema) {
  const args = [
    "--print",
    "--model", claudeModel,
    "--effort", "high",
    "--setting-sources", "project",
    "--strict-mcp-config",
    "--mcp-config", JSON.stringify({ mcpServers: {} }),
    "--tools", "Read,Grep,Glob",
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    "--no-chrome",
    "--output-format", "json",
    "--json-schema", JSON.stringify(schema),
    prompt,
  ];
  const startedAt = Date.now();
  const process = spawnSync("claude", args, {
    cwd: workspace,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt;
  let envelope = null;
  let output = null;
  try {
    envelope = JSON.parse(process.stdout);
    output = parseJsonObject(envelope.structured_output ?? envelope.result);
  } catch (error) {
    if (process.status === 0) throw error;
  }
  return {
    exit_code: process.status,
    duration_ms: durationMs,
    requested_model: claudeModel,
    resolved_models: Object.keys(envelope?.modelUsage ?? {}),
    usage: envelope?.usage ?? null,
    cost_usd: envelope?.total_cost_usd ?? null,
    output,
    error: process.status === 0
      ? null
      : (envelope?.result || process.stderr.trim() || "Claude Code exited without an error message").slice(-4000),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const benchmark = JSON.parse(await readFile(casesPath, "utf8"));
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const protocolSha256 = sha256([
    "cases.json\0", await readFile(casesPath),
    "\0output.schema.json\0", await readFile(schemaPath),
    "\0run.mjs\0", await readFile(runnerPath),
  ]);
  const selectedCases = options.caseIds.length
    ? benchmark.cases.filter((testCase) => options.caseIds.includes(testCase.id))
    : benchmark.cases;
  if (selectedCases.length === 0) throw new Error("No benchmark cases selected");

  const results = {
    benchmark_version: benchmark.version,
    generated_at: new Date().toISOString(),
    methodology: {
      trials_per_cell: 1,
      prompt: benchmark.prompt,
      workspace: "fresh temporary directory for every run",
      baseline: "no project skill",
      treatment: "only the case's relevant project skill",
      fixture_integrity: "review fixtures contain no expected signals, source notes, or skill instructions",
      permissions: "read-only review; no file edits",
      scoring: "fixed signal patterns from benchmark/cases.json plus manual review",
      protocol_sha256: protocolSha256,
    },
    tools: {
      codex_cli: commandVersion("codex", ["--version"]),
      claude_code: commandVersion("claude", ["--version"]),
    },
    runs: [],
  };

  for (const testCase of selectedCases) {
    const artifactSha256 = sha256([await readFile(path.join(root, testCase.artifact))]);
    const skillSha256 = await hashDirectory(path.join(root, "skills", testCase.skill));
    for (const agent of options.agents) {
      for (const mode of options.modes) {
        const workspace = await prepareWorkspace(testCase, agent, mode);
        process.stderr.write(`Running ${agent}/${mode}/${testCase.id}\n`);
        try {
          const outcome = agent === "codex"
            ? await runCodex(workspace, benchmark.prompt)
            : await runClaude(workspace, benchmark.prompt, schema);
          results.runs.push({
            case_id: testCase.id,
            skill: testCase.skill,
            artifact_sha256: artifactSha256,
            installed_skill_sha256: mode === "skill" ? skillSha256 : null,
            agent,
            mode,
            ...outcome,
          });
        } finally {
          await rm(workspace, { recursive: true, force: true });
        }
      }
    }
  }

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(results, null, 2)}\n`);
  const failures = results.runs.filter((run) => run.exit_code !== 0 || !run.output);
  process.stderr.write(`Wrote ${results.runs.length} runs to ${options.output}\n`);
  if (failures.length) {
    process.stderr.write(`${failures.length} run(s) failed\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
