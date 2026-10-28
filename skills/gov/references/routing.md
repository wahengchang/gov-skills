# Adaptive routing decisions

## Intent and operation

Keep the primary workflow separate from permission to edit. A request to review a commit stays read-only even when the investigation finds stale docs. A request to repair governance permits the relevant reversible governance changes already authorized. Product behavior changes remain within their separately established scope. No route grants installation, hook setup, a new scheduler or a product refactor.

When wording is ambiguous, begin useful read-only discovery. Infer ordinary implementation choices from the request and existing context; ask only when a missing product decision or unclear change authorization materially changes the action. Do not ask again for permission already given.

Specific tasks do not need a router hop: a commit review selects `gov-check`, a requested docs update selects `gov-doc-sync`, and a named rule change selects `gov-rule`. A broad maintenance request can use several methods while keeping `gov-maintain` as the primary workflow.

## Capability fallback

| Observed state | Action |
| --- | --- |
| No toolkit, sufficient reviewed native checks | Use native tools; report absent integration without installing it. Native evidence can satisfy the requested coverage. |
| Missing required tool or invalid adopted config | Complete independent analysis; mark the affected conclusion blocked/partial, never pass. |
| Optional tool or sibling skill absent | Use the available workflow's own instructions; report only the relevant limitation. |
| Selected workflow unavailable | Perform useful native investigation; identify the missing capability without synthesizing an installer. |
| No execution capability | Inspect source/contracts and available exact-candidate CI evidence; state what could not be run. |
| Locally edited owned runtime | Preserve it; use setup's ownership conflict handling when update is authorized. |

Review command definitions, cwd and side effects before execution. Never auto-execute package scripts discovered during capability inventory. A present proof file and a cached green result do not establish current protection.

## Investigation depth

| Depth | Evidence that calls for it |
| --- | --- |
| Focused | Identified local change, known authority and traceable consumers; inspect and verify the relevant contract. |
| Impact-expanded | Shared API/schema/types, dependencies, generated sources, CI/governance changes or uncertain consumers; follow affected paths beyond the initial diff. |
| Full governance audit | Requested repo-wide coverage, initial adoption without adequate audit evidence, or unresolved authority/coverage across the repo. |

These are investigation scopes, not fixed file-count thresholds or alternative CI policies. `command.paths` records adopted scope and checks path existence; the command itself determines coverage. Use observed contracts/imports/consumers to investigate impact. Do not automatically prune checks from filename matches. Preserve required CI coverage and explicitly state unexamined areas.

## Evidence-driven substeps

| Finding | Next step within existing authorization |
| --- | --- |
| Factual doc drift | Use doc-sync classification, repair source docs or generator inputs, then validate affected outputs. |
| Runtime/tool drift | Use setup preview/update ownership handling for runtime changes; repair reviewed native integration where appropriate. |
| Stale/duplicate rule | Use rule retirement/replacement proof; keep existing enforce protection until a proven replacement is active. |
| Product regression | Retain the valid promise/gate and report the separate product repair; continue independent governance work. |
| Ambiguous product intent | Ask for that decision; do not rewrite the promise to match observed behavior. |
| Review finding without write authorization | Return the finding and concrete correction; do not turn the review into repair. |

For setup, use adoption evidence for adoption, ownership/config/compatibility evidence for updates, and ownership plus hook/CI references for removal. A deployment preview does not apply changes or claim to preview uninstall. Optional hooks require the explicit hook request and normal host trust workflow.

## Reuse and invalidation

Pass candidate identity (including selected working content), scope, relevant fingerprints, commands/cwd/results, non-sensitive tool/environment observations and external-input assumptions in context. A receiving workflow checks freshness and fills gaps; it does not restart the entire investigation. Keep one primary workflow and a reason for each additional substep. Leaves do not call `gov` again.

When relevant source, config, command definitions, toolchain, environment or external inputs change, invalidate affected evidence and rerun necessary verification. Unchanged source alone does not make a result fresh under changed execution conditions. When a previously unknown consumer appears, expand that part of the investigation. Unaffected static investigation can be reused. Re-identify the final candidate after authorized repairs; neither an old HEAD pass nor a whole-repo claim based on sampled coverage is valid.

Stop when the requested outcome and declared required coverage are complete, or when the remaining conclusion is explicitly blocked/partial. Do not add a full audit, rule, docs change or setup step merely because the corresponding skill is installed.
