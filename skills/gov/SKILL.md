---
name: gov
description: Route ambiguous or multi-workflow repository governance requests to audit, setup, rule, documentation sync, check or maintenance using intent, authorization, available tools and impact. Use when governance help needs a workflow choice or combines several concerns. Clear or explicitly named tasks go directly to their matching skill; ordinary product implementation does not require this router.
---

# Choose the necessary governance work

Resolve the requested outcome and operation before choosing a workflow. Honor an explicitly named skill or clear task directly. Preserve inspect/preview-only scope and existing authorization for requested changes; routing creates neither write permission nor an extra approval checkpoint. Ask only for a missing decision that changes the work, while continuing independent useful work.

Inspect the minimum facts: applicable instructions, target root, candidate or requested coverage, Git/dirty state, existing governance contracts, relevant native tools and available skills. This discovery is read-only; do not execute discovered scripts merely to inventory capabilities. Missing runtime is not a setup trigger. If `.governance/runtime/cli.mjs` exists, `node .governance/runtime/cli.mjs status --root <repo> --json` is a read-only, command-free source for adoption state, owned-runtime drift and unverified commands; use its `state` as evidence for the choice, never in place of the requested outcome. Its `suggestions` are hints and [routing details](references/routing.md) stay the mapping from intent.

Choose one primary workflow:

| Requested outcome | Primary skill |
| --- | --- |
| Understand governance coverage or adoption gaps without a specific candidate | `gov-audit` |
| Adopt, preview, update or remove owned tooling; requested hooks | `gov-setup` |
| Add, revise or retire a specific invariant's protection | `gov-rule` |
| Synchronize docs/generated material for an identified change | `gov-doc-sync` |
| Review an identified commit, PR or working-tree candidate | `gov-check` |
| Review or repair ongoing governance drift across docs, tools and rules | `gov-maintain` |

Load the selected skill from its actual available location, without assuming sibling paths. All six skills remain directly usable without this router. If a selected skill is unavailable, complete useful native investigation within scope and state the unavailable workflow; do not invent its installer, silently install dependencies, or treat missing optional integration as a failed required check.

Carry a small handoff in conversation: outcome/operation, candidate identity and relevant content/config fingerprints, scope traced, tool/environment observations, reviewed commands/results, unknowns and the reason for the next step. Validate incoming evidence against the current state. Reuse fresh evidence; invalidate affected results after source/config/command changes or relevant toolchain, environment or external-input changes. Extend only missing investigation. Do not persist a routing state file or put run logs in the rule registry.

Start with the relevant scope and expand for shared contracts, dependencies, generators, governance/CI changes or uncertain consumers; diff size alone does not establish low impact. For mixed findings, lifecycle operations, depth selection or freshness decisions, read [routing details](references/routing.md). A scope label or `command.paths` is not a dependency graph or proof that checks can be skipped.

Re-route only when new evidence changes the required work. Pass concrete substeps and their evidence forward; leaf workflows must not recurse through this router or repeat a full audit without a reason. Finish the chosen work and required validation, then report its scoped outcome, evidence and limitations. Do not append every governance skill to every task.
