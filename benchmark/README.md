# Directional Benchmark

This benchmark asks Claude Code and OpenAI Codex to review the same five unsafe payment artifacts with and without the relevant project skill installed.

It answers a narrow question: **did the skill make a required payment failure signal appear in this run?** It does not claim to measure general model quality or prove production correctness.

## Method

- The artifact and user prompt are identical for baseline and treatment.
- Review fixtures contain no answer keys, expected signals, source notes, or skill instructions.
- Every run uses a fresh temporary workspace.
- The baseline has no project skill.
- The treatment has only the relevant project skill.
- Runs are read-only and do not persist sessions.
- Criteria and signal patterns live in [`cases.json`](cases.json) and are fixed before results are inspected.
- Complete structured findings and run metadata are retained in `results/`.
- SHA-256 fingerprints bind each result to the protocol, fixture, and installed skill content.
- The published report uses one trial per cell and discloses this limitation.

The default models are `gpt-5.6-sol` for Codex and the current `sonnet` alias for Claude Code. Override them with `BENCHMARK_CODEX_MODEL` and `BENCHMARK_CLAUDE_MODEL`.

## Run

```bash
npm run benchmark
```

The aggregate command runs each CLI separately, refuses to merge failed or duplicate cells, verifies that both result files share the same protocol fingerprint, and then scores the combined output. Use `npm run benchmark:codex` or `npm run benchmark:claude` when only one authenticated CLI is available.

Run one cell while iterating:

```bash
node benchmark/run.mjs \
  --agent codex \
  --mode skill \
  --case ambiguous-refund-timeout \
  --output /tmp/payment-skill-smoke.json
```

## Interpret results carefully

The scorer looks for predeclared concepts, not exact wording. It is intentionally simple and auditable. Read the raw findings whenever a score changes: a model can mention a keyword while proposing an unsafe control, or propose a safe equivalent using language the patterns miss.

The five files in `fixtures/` are deliberately separate from the educational examples. Public examples contain explanations and expected review signals; benchmark fixtures do not. Mixing the two would leak the answer into the baseline and invalidate the comparison.
