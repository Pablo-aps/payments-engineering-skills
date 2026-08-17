#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const benchmarkDirectory = path.dirname(fileURLToPath(import.meta.url));
const casesPath = path.join(benchmarkDirectory, "cases.json");

function parseArguments(argv) {
  if (!argv[0]) throw new Error("Usage: node benchmark/score.mjs RESULTS [--json-out FILE] [--markdown-out FILE]");
  const options = { results: path.resolve(argv[0]), jsonOut: null, markdownOut: null };
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === "--json-out") {
      options.jsonOut = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--markdown-out") {
      options.markdownOut = path.resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }
  return options;
}

function scoreRun(run, testCase) {
  const searchable = JSON.stringify(run.output ?? {}).toLowerCase();
  const criteria = testCase.criteria.map((criterion) => {
    const matchedPattern = criterion.patterns.find((pattern) => new RegExp(pattern, "is").test(searchable));
    return {
      id: criterion.id,
      description: criterion.description,
      passed: Boolean(matchedPattern),
      matched_pattern: matchedPattern ?? null,
    };
  });
  return {
    case_id: run.case_id,
    agent: run.agent,
    mode: run.mode,
    score: criteria.filter((criterion) => criterion.passed).length,
    maximum: criteria.length,
    criteria,
  };
}

function markdownReport(results, scores) {
  const agents = [...new Set(scores.map((score) => score.agent))].sort();
  const caseIds = [...new Set(scores.map((score) => score.case_id))];
  const requestedModels = [...new Set(results.runs.map((run) => `${run.agent}: ${run.requested_model}`))].join("; ");
  const lines = [
    "# Directional Benchmark Results",
    "",
    `- Run (UTC): \`${results.generated_at}\``,
    `- Codex CLI: \`${results.tools.codex_cli}\``,
    `- Claude Code: \`${results.tools.claude_code}\``,
    `- Requested models: \`${requestedModels}\``,
    "",
    "> One trial per cell. This is a reproducible smoke benchmark, not a statistically significant model comparison. Scores are deterministic signal checks and must be read alongside the raw outputs.",
    "",
    "| Agent | Case | Baseline | With skill | Delta |",
    "| --- | --- | ---: | ---: | ---: |",
  ];

  for (const agent of agents) {
    for (const caseId of caseIds) {
      const baseline = scores.find((score) => score.agent === agent && score.case_id === caseId && score.mode === "baseline");
      const treatment = scores.find((score) => score.agent === agent && score.case_id === caseId && score.mode === "skill");
      if (!baseline || !treatment) continue;
      const delta = treatment.score - baseline.score;
      lines.push(`| ${agent} | ${caseId} | ${baseline.score}/${baseline.maximum} | ${treatment.score}/${treatment.maximum} | ${delta >= 0 ? "+" : ""}${delta} |`);
    }
  }

  lines.push("", "## Observed totals", "");
  lines.push("| Agent | Baseline signals | With skill signals | Delta |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const agent of agents) {
    const baseline = scores.filter((score) => score.agent === agent && score.mode === "baseline");
    const treatment = scores.filter((score) => score.agent === agent && score.mode === "skill");
    const baselineScore = baseline.reduce((sum, score) => sum + score.score, 0);
    const treatmentScore = treatment.reduce((sum, score) => sum + score.score, 0);
    const maximum = baseline.reduce((sum, score) => sum + score.maximum, 0);
    const delta = treatmentScore - baselineScore;
    lines.push(`| ${agent} | ${baselineScore}/${maximum} | ${treatmentScore}/${maximum} | ${delta >= 0 ? "+" : ""}${delta} |`);
  }

  lines.push("", "## Limits", "");
  lines.push("- One run cannot estimate variance or prove that one model is generally safer.");
  lines.push("- Pattern scoring measures whether required concepts appeared, not whether the proposed implementation is correct.");
  lines.push("- Models, aliases, CLI behavior, and implicit skill activation can change after this run.");
  lines.push("- Read the machine-readable result file for complete findings, usage metadata, and failures.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const benchmark = JSON.parse(await readFile(casesPath, "utf8"));
  const results = JSON.parse(await readFile(options.results, "utf8"));
  const caseMap = new Map(benchmark.cases.map((testCase) => [testCase.id, testCase]));
  const scores = results.runs.map((run) => scoreRun(run, caseMap.get(run.case_id)));
  const scored = {
    benchmark_version: benchmark.version,
    source_results: path.relative(process.cwd(), options.results),
    generated_at: new Date().toISOString(),
    scores,
  };
  const markdown = markdownReport(results, scores);

  if (options.jsonOut) await writeFile(options.jsonOut, `${JSON.stringify(scored, null, 2)}\n`);
  if (options.markdownOut) await writeFile(options.markdownOut, markdown);
  if (!options.jsonOut && !options.markdownOut) process.stdout.write(markdown);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
