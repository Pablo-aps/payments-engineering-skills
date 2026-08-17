#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArguments(argv) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex === -1 || !argv[outputIndex + 1]) {
    throw new Error("Usage: node benchmark/merge.mjs INPUT... --output FILE");
  }
  const inputs = argv.slice(0, outputIndex).map((input) => path.resolve(input));
  if (inputs.length < 2) throw new Error("At least two input result files are required");
  if (outputIndex + 2 !== argv.length) throw new Error("Unexpected argument after --output FILE");
  return { inputs, output: path.resolve(argv[outputIndex + 1]) };
}

function assertSame(left, right, label) {
  if (left !== right) throw new Error(`${label} differs across result files`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const sources = await Promise.all(options.inputs.map(async (input) => ({
    input,
    result: JSON.parse(await readFile(input, "utf8")),
  })));
  const first = sources[0].result;

  for (const { result } of sources.slice(1)) {
    assertSame(result.benchmark_version, first.benchmark_version, "benchmark version");
    assertSame(result.methodology.prompt, first.methodology.prompt, "prompt");
    assertSame(result.methodology.protocol_sha256, first.methodology.protocol_sha256, "protocol fingerprint");
  }

  const runs = sources.flatMap(({ result }) => result.runs);
  const cellIds = runs.map((run) => `${run.agent}/${run.mode}/${run.case_id}`);
  if (new Set(cellIds).size !== cellIds.length) throw new Error("Duplicate benchmark cell across result files");
  if (runs.some((run) => run.exit_code !== 0 || !run.output)) {
    throw new Error("Cannot merge result files containing failed cells");
  }

  const combined = {
    ...first,
    generated_at: new Date().toISOString(),
    combined_from: sources.map(({ input }) => path.relative(process.cwd(), input)),
    tools: Object.assign({}, ...sources.map(({ result }) => result.tools)),
    runs: runs.sort((left, right) => cellIdsFor(left).localeCompare(cellIdsFor(right))),
  };

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(combined, null, 2)}\n`);
  process.stdout.write(`Merged ${runs.length} cells into ${options.output}\n`);
}

function cellIdsFor(run) {
  return `${run.agent}/${run.case_id}/${run.mode}`;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
