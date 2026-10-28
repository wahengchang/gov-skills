---
name: gov-check
description: Review an identified commit, PR, staged change or working-tree candidate against authoritative contracts, real consumers, documentation and fresh native verification. Use for a governance review before handoff or merge; default to read-only. Use gov-audit for coverage discovery without a candidate and gov-doc-sync for requested documentation updates.
---

# Check an identified candidate

## Orient

If `.governance/runtime/cli.mjs` exists, `node .governance/runtime/cli.mjs status --root <repo> --json` shows adopted checks, modes and owned-runtime drift without running registered commands. A `runtime-drift` or `invalid-contract` state limits what a later `check` can establish; report it. `status` never substitutes for `check`. If this runtime predates `status` or the diagnostic cannot start, report it as unavailable and continue useful native investigation within the requested scope; do not install or repair runtime merely to obtain status.

Resolve the candidate and requested coverage first: explicit base/head or staged/unstaged/selected untracked scope. Inspect Git state, including unborn HEAD. Record actual hashes and dirty-state; never assume a branch name/base. For a root commit with no parent, review its complete added tree against the empty tree. When reviewing an entire working tree, account for staged, unstaged and untracked files. Follow rename/delete references from both versions.

Read applicable instructions and authoritative contracts. Reuse fresh candidate/scope evidence already in context. Trace important changes through real callers/consumers, configuration, schemas, tests and affected docs. Expand coverage for shared contracts, dependencies, generators or uncertain impact even when the diff is small. A declared map, command.paths or symbol search seeds investigation; it does not prove complete impact. Identify untraced boundaries. Keep machine findings separate from semantic judgments.

If `.governance/rules.json` exists, map every changed path, including created and deleted ones and both sides of a rename, to the rules whose `scope` covers it. Read each matching rule's `source` and judge the change against it; a rule with a check is also covered by that check, but its result does not replace this reading. For a rule with `textReason` no mechanical protection exists, so this semantic review is the only coverage: state that. A path no rule covers is an impact unknown, not a pass. For a deleted path, find rules and links that reference it (`scope`, `source`, `proof`). If the candidate comes from a ticket with a Change map, use it to seed this mapping and verify it against the repository; a declared map is not evidence.

Review and run relevant existing native checks in the correct cwd. If adopted, use `node .governance/runtime/cli.mjs check --root <repo> --json` after reviewing registered command side effects. Missing toolkit: use native tools and explicitly report the integration gap. Missing required tool, invalid config, stale result or unresolved candidate identity cannot become pass. A report-mode finding may exit 0 and still be a review issue; proof-file existence does not prove coverage.

Do not edit reviewed source by default. Do not lower tests, remove assertions, add skips/baselines or change promises to get green. If fixes are requested, stay within that authorization, then re-identify/revalidate the new candidate. Product behavior fixes/refactors in a governance-only task remain a separate task.

Record evidence tied to the exact examined source: revision plus relevant working-content hashes/diff, argv/cwd, relevant tool/environment observations, exit and observed assertion/result. If source, config, command definitions or relevant execution conditions/external inputs change after a run, rerun affected validation or mark the evidence stale. Old HEAD results cannot validate today's worktree.

Return one semantic outcome with scope and evidence:

- **pass**: declared required coverage completed, no unresolved relevant findings, evidence fresh.
- **issues**: supported violations/regressions, with file/line, impact and concrete correction.
- **blocked**: a necessary prerequisite/decision/tool prevents a conclusion.
- **partial**: useful subset checked, explicit uncovered areas remain.

Include machine results and report/enforce modes separately, which paths are covered only by semantic review (text-only rules, or no rule), verification not run, impact unknowns and any independent governance work completed. Avoid an unconditional pass if required evidence is absent.
