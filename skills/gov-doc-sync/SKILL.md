---
name: gov-doc-sync
description: Synchronize authoritative documentation and generated material for an identified change when documentation updates are requested. Trace affected consumers and distinguish approved behavior changes from regressions. Inspect only when the request is to assess stale docs; an ordinary commit review belongs to gov-check.
---

# Reconcile a change with its documentation

## Orient

If `.governance/runtime/cli.mjs` exists, `node .governance/runtime/cli.mjs status --root <repo> --json` lists adopted checks (for example links) that apply to the docs you will touch. It runs no registered command. If the task is only to review without editing, switch to gov-check.

Establish the requested operation and actual candidate: explicit base/head, staged diff, unstaged diff, or deliberately selected untracked files. An assessment remains read-only; perform updates only within the user's existing authorization. Record revision and dirty-state, reusing relevant fresh evidence already in context. Do not invent a main branch or ignore untracked material in a claimed whole-worktree review. For renames/deletions follow both old and new paths and references.

Trace changed externally meaningful behavior through callers/consumers, existing contracts, examples, tests, configuration and generated outputs. Search real symbols and paths instead of treating a filename list as an impact graph. Read existing navigation and authorities; preserve a single source of truth.

Classify each discrepancy before editing:

- Approved behavior change: update the affected authoritative docs and consumers within scope.
- Factual doc drift: repair from observed source and evidence.
- Product regression against the still-valid promise: report a separate product repair; retain the promise and necessary checks.
- Ambiguous product intent: ask only the missing decision; continue independent factual work.

Find the original generator and inputs for generated material, review its side effects, then regenerate using the repo's tool. Do not patch output to conceal a broken source. Explain why internal refactors require no doc changes when that is supported. Avoid forced frontmatter, new docs trees or duplicated policies.

Use adopted/native link, build, example and generated-consistency checks appropriate to the changed scope. If `.governance/runtime/cli.mjs` exists, review registered native commands before running report/check. A missing checker is a stated limitation, not permission to bootstrap. Distinguish skipped, unavailable, failed and actually passed verification. Changes after validation invalidate the corresponding evidence.

Deliver the candidate identity, impact traced and unknowns, discrepancy classification, actual doc/source diff, commands/results and any separate product task. Do not call documentation synchronized if necessary affected sources remain unexamined.
