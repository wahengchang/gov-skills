---
name: gov-audit
description: Inspect repository governance coverage and adoption gaps when no specific candidate change is the review target. Use for a read-only governance inventory or evidence needed before adoption; trace real behavior, authoritative sources and existing native protection. Use gov-check for an identified commit or worktree review.
---

# Audit existing governance

## Orient

If `.governance/runtime/cli.mjs` exists, run `node .governance/runtime/cli.mjs status --root <repo> --json` first. It is read-only and runs no registered command. Treat its `state`, `drift` and `unverified` as leads for the audit, not as findings. If it is absent, say so and continue with native tools.

Produce a repository-specific map that setup or maintenance can act on. This is a read-only investigation; do not run an installer, generator, or discovered script just because it exists.

Establish the repo root, Git state (including unborn HEAD), worktree boundaries, and requested scope. Reuse relevant in-context investigation after checking its candidate, scope and freshness; refresh changed evidence rather than repeating an unchanged audit. Read applicable AGENTS instructions, existing navigation, build manifests, CI and representative tests. Follow at least one relevant real path from entrypoint through implementation to consumers and protection. Names and directory layouts alone do not establish authority or coverage.

For each relevant promise record:

- Authoritative source and owner, with file/line or command evidence.
- Implementation and consumers actually traced; untraced branches remain unknown.
- Existing types, lint, architecture rules, tests and CI that enforce it. Distinguish a test file's existence from observed failure/pass behavior.
- Governance gaps, product regressions and ambiguous intent separately; reuse existing protection before proposing another rule.

Inspect `.governance/config.json` and `rules.json` if present. A missing toolkit is an adoption gap, not a reason to silently install it. A present checker can run only after reviewing its registered commands and their side effects. If appropriate, run `node .governance/runtime/cli.mjs report --root <repo>`; report-mode findings still matter, and exit 0 does not establish semantic correctness.

Deliver a compact audit with scope/revision/dirty-state, facts and evidence, explicitly labelled inferences, unknowns, and prioritized adoption batches. Recommend only checks suited to observed paths and native tools. No mandatory new docs tree, frontmatter, AGENTS size budget, or dependency graph. Do not write a full parallel business specification.

Every proposed batch starts in report mode. There is no legacy baseline. Only a freshly verified batch with zero findings can become enforce. If cleanup changes product behavior or requires refactoring, identify the dependent checks and a separate product task; continue independent governance work.
