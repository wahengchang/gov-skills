---
name: gov-check
description: Review an explicit candidate change against authoritative contracts, real callers and consumers, documentation and fresh native verification. Use for an engineering governance check before handoff or merge; defaults to read-only review.
---

# Check an identified candidate

Resolve the candidate and requested coverage first: explicit base/head or staged/unstaged/selected untracked scope. Inspect Git state, including unborn HEAD. Record actual hashes and dirty-state; never assume a branch name/base. When reviewing an entire working tree, account for staged, unstaged and untracked files. Follow rename/delete references from both versions.

Read applicable instructions and authoritative contracts. Trace important changes through real callers/consumers, configuration, schemas, tests and affected docs. A declared map or symbol search seeds investigation; it does not prove complete impact. Identify untraced boundaries. Keep machine findings separate from semantic judgments.

Review and run relevant existing native checks in the correct cwd. If adopted, use `node .governance/runtime/cli.mjs check --root <repo> --json` after reviewing registered command side effects. Missing toolkit: use native tools and explicitly report the integration gap. Missing required tool, invalid config, stale result or unresolved candidate identity cannot become pass. A report-mode finding may exit 0 and still be a review issue; proof-file existence does not prove coverage.

Do not edit reviewed source by default. Do not lower tests, remove assertions, add skips/baselines or change promises to get green. If fixes are requested, stay within that authorization, then re-identify/revalidate the new candidate. Product behavior fixes/refactors in a governance-only task remain a separate task.

Record evidence tied to the exact examined source: revision plus relevant working-content hashes/diff, argv/cwd, exit and observed assertion/result. If code or relevant config changes after a run, rerun affected validation or mark the evidence stale. Old HEAD results cannot validate today's worktree.

Return one semantic outcome with scope and evidence:

- **pass**: declared required coverage completed, no unresolved relevant findings, evidence fresh.
- **issues**: supported violations/regressions, with file/line, impact and concrete correction.
- **blocked**: a necessary prerequisite/decision/tool prevents a conclusion.
- **partial**: useful subset checked, explicit uncovered areas remain.

Include machine results and report/enforce modes separately, verification not run, impact unknowns and any independent governance work completed. Avoid an unconditional pass if required evidence is absent.
