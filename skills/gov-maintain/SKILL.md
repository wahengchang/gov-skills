---
name: gov-maintain
description: Maintain adopted repository governance by repairing documentation and tool drift, evaluating stale or duplicate rules, and preserving regression protection. Use for a scoped governance health review or cleanup after repeated changes. For first-time adoption use gov-setup, for a single new invariant use gov-rule.
---

# Maintain useful protection

## Orient

If `.governance/runtime/cli.mjs` exists, start with `node .governance/runtime/cli.mjs status --root <repo> --json`: `runtime-drift`, `invalid-contract`, `enforce-failing` and `activatable` point at the maintenance work; `unverified` lists registered commands you must review before running. The state suggests, your declared scope decides. Missing runtime is a reportable dependency, not permission to install.

Define the requested scope and a real prior record or explicit base if available. State changed-only, sampled or full coverage; no history means unknown trend, not an invented improvement metric. Inspect existing navigation, authorities, rules, adopted config, proof references, CI and runtime version/ownership. Trace representative real paths, not just file existence.

Classify findings as doc drift, tool/harness drift, product regression or ambiguous intent. Repair reversible governance drift within the user's authorization. Product behavior fixes/refactors remain a separate task; newly adopted dependent checks stay report, and already-enforced gates retain their mode and protection. Continue independent work while a product decision is pending.

Run adopted/native checks after reviewing command side effects. A broken tool is an error, not a clean check. If runtime updates are needed, use the installed gov-setup skill's preview/update ownership workflow when available; do not overwrite local edits or reach into a private source checkout. If unavailable, report that dependency and complete other work. Missing toolkit does not authorize installation.

Look for duplicate authorities, unused/obsolete rules, stale proofs and protection that no longer tests the intended failure. For retirement or consolidation, demonstrate obsolescence or stronger replacement, trace consumers and prove remaining protection with an isolated counterexample. Do not delete a failing check or relax an adopted scope to claim clean. Age alone is not a retirement reason. Keep durable rule references meaningful and one-off logs temporary.

New/revised checks start report and a selected batch becomes enforce only after fresh complete zero-finding verification. No baseline. Reuse existing runtime and native tools, not a new maintenance engine. Do not create a scheduler or permanent agent unless requested.

Review the actual diff, rerun relevant validation, then repeat the same scoped maintenance check to ensure it produces no unnecessary further edits. Return **clean**, **changed**, **partial** or **blocked**, with declared scope, evidence, remaining findings, separate product tasks and unavailable historical data. Sampled coverage or a product regression cannot support full-repo clean.
