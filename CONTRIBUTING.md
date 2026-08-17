# Contributing

Contributions that make payment engineering more explicit, testable, and accurate are welcome.

## Before opening a pull request

1. Open an issue for a new skill or a material change in scope.
2. Prefer primary sources: provider documentation, protocol specifications, database documentation, or accounting standards.
3. Describe the invariant or failure mode the change addresses.
4. Add or update positive, negative, and adversarial evaluation cases.
5. Run `npm test` with Node.js 20 or newer.

## Skill standard

A skill must:

- solve a bounded payment-engineering task;
- define when it should and should not activate;
- distinguish known failure from an indeterminate external outcome;
- name transaction, trust, and authority boundaries;
- include concurrency, retry, and delayed-delivery cases where relevant;
- avoid presenting sample schemas as production-ready;
- keep references close to primary documentation;
- use plain English and explain provider-specific assumptions.

Keep `SKILL.md` focused. Put detailed domain material in `references/` and reusable contracts in `assets/`. Do not add generated prose, unverifiable claims, or examples that normalize unsafe money handling.

## Commit and pull request style

Use a short imperative subject such as `Add payout reconciliation fixtures`. Keep unrelated changes separate. In the pull request, state the problem, the safety impact, the evidence used, and how the change was tested.

By contributing, you agree that your contribution is licensed under Apache-2.0.
