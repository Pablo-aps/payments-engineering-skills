import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(root, "skills");
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function validateRepository() {
  const errors = [];
  const directories = (await readdir(skillRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const index = JSON.parse(await readFile(path.join(root, "skills.json"), "utf8"));
  const indexed = new Map(index.skills.map((skill) => [skill.name, skill]));

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
  }

  for (const indexedName of indexed.keys()) {
    if (!directories.includes(indexedName)) {
      errors.push(`${indexedName}: indexed skill directory does not exist`);
    }
  }

  const evaluations = JSON.parse(await readFile(path.join(root, "evals", "cases.json"), "utf8"));
  for (const directory of directories) {
    for (const [kind, minimum] of [["positive", 3], ["negative", 2], ["adversarial", 3]]) {
      const count = evaluations.cases.filter(
        (testCase) => testCase.skill === directory && testCase.kind === kind,
      ).length;
      if (count < minimum) {
        errors.push(`${directory}: needs at least ${minimum} ${kind} eval cases; found ${count}`);
      }
    }
  }

  const ids = evaluations.cases.map((testCase) => testCase.id);
  if (new Set(ids).size !== ids.length) {
    errors.push("evals/cases.json contains duplicate IDs");
  }

  return { errors, skillCount: directories.length, evaluationCount: evaluations.cases.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateRepository();
  if (result.errors.length) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${result.skillCount} skills and ${result.evaluationCount} evaluation cases.`);
  }
}
