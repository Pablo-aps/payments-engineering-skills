import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(root, "skills");
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hazardPrefixes = new Map([
  ["build-reliable-payment-webhooks", "WHK"],
  ["design-payment-ledger", "LED"],
  ["implement-idempotent-payments", "IDM"],
  ["reconcile-payment-systems", "REC"],
  ["review-payment-state-machine", "STM"],
]);
const hazardFields = ["id", "severity", "mechanism", "evidence", "control", "detection", "recovery", "test"];
const severities = new Set(["critical", "high", "medium", "low"]);
const evaluationKinds = new Set(["positive", "negative", "adversarial", "artifact"]);

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function validateRepository() {
  const errors = [];
  const directories = (await readdir(skillRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const packageManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const releaseVersion = packageManifest.version;
  const index = JSON.parse(await readFile(path.join(root, "skills.json"), "utf8"));
  if (index.version !== releaseVersion) errors.push("skills.json version must match package.json");
  const indexed = new Map(index.skills.map((skill) => [skill.name, skill]));
  const hazardsById = new Map();
  const hazardIdsBySkill = new Map();

  for (const directory of directories) {
    const skillDirectory = path.join(skillRoot, directory);
    const skillFile = path.join(skillDirectory, "SKILL.md");
    let source;
    try {
      source = await readFile(skillFile, "utf8");
    } catch {
      errors.push(`${directory}: missing SKILL.md`);
      continue;
    }

    const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatter) {
      errors.push(`${directory}: invalid YAML frontmatter boundary`);
      continue;
    }

    const metadata = Object.fromEntries(
      frontmatter[1]
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf(":");
          return separator === -1
            ? [line.trim(), ""]
            : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
        }),
    );
    const keys = Object.keys(metadata).sort();
    if (keys.join(",") !== "description,name") {
      errors.push(`${directory}: frontmatter must contain only name and description`);
    }
    if (metadata.name !== directory) {
      errors.push(`${directory}: frontmatter name must match directory`);
    }
    if (!namePattern.test(directory) || directory.length > 64) {
      errors.push(`${directory}: name must be lowercase kebab-case and at most 64 characters`);
    }
    if (!metadata.description || metadata.description.length > 1024) {
      errors.push(`${directory}: description must contain 1-1024 characters`);
    }
    if (/\bTODO\b|\[TODO/i.test(source)) {
      errors.push(`${directory}: unresolved TODO marker`);
    }
    if (source.split("\n").length > 500) {
      errors.push(`${directory}: SKILL.md exceeds 500 lines`);
    }

    const localLinks = [...source.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)].map((match) => match[1]);
    for (const link of localLinks) {
      try {
        await access(path.resolve(skillDirectory, link));
      } catch {
        errors.push(`${directory}: broken local link ${link}`);
      }
    }

    const agentMetadataPath = path.join(skillDirectory, "agents", "openai.yaml");
    try {
      const agentMetadata = await readFile(agentMetadataPath, "utf8");
      for (const field of ["display_name:", "short_description:", "default_prompt:"]) {
        if (!agentMetadata.includes(field)) {
          errors.push(`${directory}: agents/openai.yaml missing ${field.slice(0, -1)}`);
        }
      }
      if (!agentMetadata.includes(`$${directory}`)) {
        errors.push(`${directory}: default_prompt must mention $${directory}`);
      }
    } catch {
      errors.push(`${directory}: missing agents/openai.yaml`);
    }

    const entry = indexed.get(directory);
    if (!entry || entry.path !== `skills/${directory}`) {
      errors.push(`${directory}: missing or incorrect skills.json entry`);
    }

    const catalogPath = path.join(skillDirectory, "references", "hazard-catalog.json");
    try {
      const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
      const expectedPrefix = hazardPrefixes.get(directory);
      if (catalog.version !== 1) errors.push(`${directory}: hazard catalog version must be 1`);
      if (catalog.skill !== directory) errors.push(`${directory}: hazard catalog skill does not match directory`);
      if (!Array.isArray(catalog.sources) || catalog.sources.length < 3) {
        errors.push(`${directory}: hazard catalog needs at least 3 primary-source URLs`);
      } else {
        if (new Set(catalog.sources).size !== catalog.sources.length) {
          errors.push(`${directory}: hazard catalog contains duplicate source URLs`);
        }
        for (const sourceUrl of catalog.sources) {
          if (!isNonEmpty(sourceUrl) || !sourceUrl.startsWith("https://")) {
            errors.push(`${directory}: invalid hazard source URL ${String(sourceUrl)}`);
          }
        }
      }
      if (!Array.isArray(catalog.hazards) || catalog.hazards.length < 10) {
        errors.push(`${directory}: hazard catalog must contain at least 10 hazards`);
      }

      const localHazardIds = new Set();
      for (const hazard of catalog.hazards ?? []) {
        for (const field of hazardFields) {
          if (!isNonEmpty(hazard[field])) errors.push(`${directory}: hazard ${hazard.id ?? "unknown"} missing ${field}`);
        }
        if (!severities.has(hazard.severity)) {
          errors.push(`${directory}: hazard ${hazard.id ?? "unknown"} has invalid severity`);
        }
        if (!new RegExp(`^${expectedPrefix}-\\d{3}$`).test(hazard.id ?? "")) {
          errors.push(`${directory}: invalid hazard ID ${hazard.id ?? "unknown"}`);
        }
        if (localHazardIds.has(hazard.id) || hazardsById.has(hazard.id)) {
          errors.push(`${directory}: duplicate hazard ID ${hazard.id}`);
        }
        localHazardIds.add(hazard.id);
        hazardsById.set(hazard.id, directory);
      }
      if (expectedPrefix) {
        for (let number = 1; number <= 10; number += 1) {
          const expectedId = `${expectedPrefix}-${String(number).padStart(3, "0")}`;
          if (!localHazardIds.has(expectedId)) errors.push(`${directory}: missing hazard ID ${expectedId}`);
        }
      }
      hazardIdsBySkill.set(directory, localHazardIds);
    } catch (error) {
      errors.push(`${directory}: invalid or missing hazard catalog (${error.message})`);
    }
  }

  for (const indexedName of indexed.keys()) {
    if (!directories.includes(indexedName)) {
      errors.push(`${indexedName}: indexed skill directory does not exist`);
    }
  }

  const evaluations = JSON.parse(await readFile(path.join(root, "evals", "cases.json"), "utf8"));
  if (evaluations.version !== releaseVersion) errors.push("evals/cases.json version must match package.json");
  const coveredHazards = new Set();
  for (const testCase of evaluations.cases) {
    for (const field of ["id", "skill", "kind", "prompt"]) {
      if (!isNonEmpty(testCase[field])) errors.push(`eval ${testCase.id ?? "unknown"}: missing ${field}`);
    }
    if (!directories.includes(testCase.skill)) errors.push(`eval ${testCase.id}: unknown skill ${testCase.skill}`);
    if (!evaluationKinds.has(testCase.kind)) errors.push(`eval ${testCase.id}: invalid kind ${testCase.kind}`);
    if (typeof testCase.trigger_expected !== "boolean") {
      errors.push(`eval ${testCase.id}: trigger_expected must be boolean`);
    } else if ((testCase.kind === "negative") === testCase.trigger_expected) {
      errors.push(`eval ${testCase.id}: trigger expectation conflicts with kind ${testCase.kind}`);
    }
    for (const field of ["expected", "forbidden"]) {
      if (!Array.isArray(testCase[field]) || testCase[field].length === 0 || !testCase[field].every(isNonEmpty)) {
        errors.push(`eval ${testCase.id}: ${field} must be a non-empty string array`);
      }
    }
    for (const hazardId of testCase.hazards ?? []) {
      if (!hazardsById.has(hazardId)) {
        errors.push(`eval ${testCase.id}: unknown hazard ${hazardId}`);
      } else if (hazardsById.get(hazardId) !== testCase.skill) {
        errors.push(`eval ${testCase.id}: hazard ${hazardId} belongs to another skill`);
      } else {
        coveredHazards.add(hazardId);
      }
    }
  }

  for (const directory of directories) {
    for (const [kind, minimum] of [["positive", 3], ["negative", 2], ["adversarial", 5], ["artifact", 3]]) {
      const count = evaluations.cases.filter(
        (testCase) => testCase.skill === directory && testCase.kind === kind,
      ).length;
      if (count < minimum) {
        errors.push(`${directory}: needs at least ${minimum} ${kind} eval cases; found ${count}`);
      }
    }
    for (const hazardId of hazardIdsBySkill.get(directory) ?? []) {
      if (!coveredHazards.has(hazardId)) errors.push(`${directory}: hazard ${hazardId} is not covered by an eval`);
    }
  }

  const evaluationIds = evaluations.cases.map((testCase) => testCase.id);
  if (new Set(evaluationIds).size !== evaluationIds.length) {
    errors.push("evals/cases.json contains duplicate IDs");
  }

  const fixture = JSON.parse(await readFile(path.join(root, "fixtures", "failure-scenarios.json"), "utf8"));
  if (fixture.version !== releaseVersion) errors.push("fixtures/failure-scenarios.json version must match package.json");
  const fixtureIds = new Set();
  for (const scenario of fixture.scenarios) {
    if (!isNonEmpty(scenario.id) || fixtureIds.has(scenario.id)) {
      errors.push(`fixture has missing or duplicate ID ${scenario.id ?? "unknown"}`);
    }
    fixtureIds.add(scenario.id);
    if (!directories.includes(scenario.skill)) errors.push(`fixture ${scenario.id}: unknown skill ${scenario.skill}`);
    if (!scenario.input || typeof scenario.input !== "object") errors.push(`fixture ${scenario.id}: missing input`);
    if (!scenario.expected || typeof scenario.expected !== "object") errors.push(`fixture ${scenario.id}: missing expected outcome`);
    if (!Array.isArray(scenario.hazards) || scenario.hazards.length === 0) {
      errors.push(`fixture ${scenario.id}: hazards must be a non-empty array`);
    }
    if (new Set(scenario.hazards ?? []).size !== (scenario.hazards ?? []).length) {
      errors.push(`fixture ${scenario.id}: hazards contain duplicates`);
    }
    for (const hazardId of scenario.hazards ?? []) {
      if (hazardsById.get(hazardId) !== scenario.skill) {
        errors.push(`fixture ${scenario.id}: invalid hazard ${hazardId}`);
      }
    }
  }
  for (const directory of directories) {
    const count = fixture.scenarios.filter((scenario) => scenario.skill === directory).length;
    if (count < 4) errors.push(`${directory}: needs at least 4 failure fixtures; found ${count}`);
  }

  const benchmark = JSON.parse(await readFile(path.join(root, "benchmark", "cases.json"), "utf8"));
  if (benchmark.version !== 2) errors.push("benchmark/cases.json version must be 2");
  if (!isNonEmpty(benchmark.prompt)) errors.push("benchmark/cases.json needs a fixed prompt");
  const benchmarkIds = new Set();
  const benchmarkSkills = new Set();
  let exampleCount = 0;

  for (const testCase of benchmark.cases ?? []) {
    if (!isNonEmpty(testCase.id) || benchmarkIds.has(testCase.id)) {
      errors.push(`benchmark has missing or duplicate ID ${testCase.id ?? "unknown"}`);
    }
    benchmarkIds.add(testCase.id);
    if (!directories.includes(testCase.skill)) {
      errors.push(`benchmark ${testCase.id}: unknown skill ${testCase.skill}`);
    }
    if (benchmarkSkills.has(testCase.skill)) {
      errors.push(`benchmark ${testCase.id}: skill ${testCase.skill} has more than one case`);
    }
    benchmarkSkills.add(testCase.skill);
    if (!isNonEmpty(testCase.artifact) || !testCase.artifact.startsWith("benchmark/fixtures/")) {
      errors.push(`benchmark ${testCase.id}: artifact must be a blind benchmark/fixtures file`);
    } else {
      try {
        const artifact = await readFile(path.join(root, testCase.artifact), "utf8");
        if (!artifact.includes("```")) errors.push(`benchmark ${testCase.id}: artifact needs a reviewable code block`);
        if (/Expected review signals|Primary evidence|Review with the skill|Use \$[a-z]/i.test(artifact)) {
          errors.push(`benchmark ${testCase.id}: artifact leaks instructions or expected signals`);
        }
        if (artifact.includes(testCase.skill)) {
          errors.push(`benchmark ${testCase.id}: artifact names the treatment skill`);
        }
      } catch {
        errors.push(`benchmark ${testCase.id}: missing artifact ${testCase.artifact}`);
      }
    }

    if (!Array.isArray(testCase.criteria) || testCase.criteria.length !== 4) {
      errors.push(`benchmark ${testCase.id}: exactly 4 fixed criteria are required`);
    }
    const criterionIds = new Set();
    for (const criterion of testCase.criteria ?? []) {
      if (!isNonEmpty(criterion.id) || criterionIds.has(criterion.id)) {
        errors.push(`benchmark ${testCase.id}: missing or duplicate criterion ID ${criterion.id ?? "unknown"}`);
      }
      criterionIds.add(criterion.id);
      if (!isNonEmpty(criterion.description)) {
        errors.push(`benchmark ${testCase.id}/${criterion.id}: missing description`);
      }
      if (!Array.isArray(criterion.patterns) || criterion.patterns.length === 0 || !criterion.patterns.every(isNonEmpty)) {
        errors.push(`benchmark ${testCase.id}/${criterion.id}: patterns must be a non-empty string array`);
      }
      for (const pattern of criterion.patterns ?? []) {
        try {
          new RegExp(pattern, "is");
        } catch {
          errors.push(`benchmark ${testCase.id}/${criterion.id}: invalid pattern ${pattern}`);
        }
      }
    }

    try {
      const example = await readFile(path.join(root, "examples", `${testCase.id}.md`), "utf8");
      exampleCount += 1;
      for (const heading of [
        "## Scenario",
        "## Unsafe implementation",
        "## Failure mechanism",
        "## Review with the skill",
        "## Expected review signals",
        "## Primary evidence",
      ]) {
        if (!example.includes(heading)) errors.push(`example ${testCase.id}: missing ${heading}`);
      }
      if (!example.includes(testCase.skill)) errors.push(`example ${testCase.id}: does not name ${testCase.skill}`);
      if (!example.includes("https://")) errors.push(`example ${testCase.id}: missing primary-source URL`);
    } catch {
      errors.push(`example ${testCase.id}: missing examples/${testCase.id}.md`);
    }
  }

  for (const directory of directories) {
    if (!benchmarkSkills.has(directory)) errors.push(`${directory}: missing blind benchmark case`);
  }

  try {
    const outputSchema = JSON.parse(await readFile(path.join(root, "benchmark", "output.schema.json"), "utf8"));
    if (outputSchema.type !== "object" || outputSchema.additionalProperties !== false) {
      errors.push("benchmark/output.schema.json must define a closed object");
    }
    for (const field of ["decision", "summary", "findings"]) {
      if (!outputSchema.required?.includes(field)) errors.push(`benchmark output schema must require ${field}`);
    }
  } catch (error) {
    errors.push(`invalid benchmark output schema (${error.message})`);
  }

  const readme = await readFile(path.join(root, "README.md"), "utf8");
  const readmeLinks = [...readme.matchAll(/\]\((?!https?:|#)([^)#]+)(?:#[^)]+)?\)/g)].map((match) => match[1]);
  for (const link of readmeLinks) {
    try {
      await access(path.resolve(root, link));
    } catch {
      errors.push(`README.md: broken local link ${link}`);
    }
  }

  return {
    errors,
    skillCount: directories.length,
    hazardCount: hazardsById.size,
    evaluationCount: evaluations.cases.length,
    fixtureCount: fixture.scenarios.length,
    benchmarkCaseCount: benchmark.cases?.length ?? 0,
    exampleCount,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateRepository();
  if (result.errors.length) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Validated ${result.skillCount} skills, ${result.hazardCount} hazards, `
      + `${result.evaluationCount} evaluation cases, ${result.fixtureCount} failure fixtures, `
      + `${result.benchmarkCaseCount} blind benchmark cases, and ${result.exampleCount} examples.`,
    );
  }
}
