# Governance routing acceptance corpus

[routing-cases.json](routing-cases.json) contains behavioral acceptance cases for skill selection, authorized operations, capability fallback and evidence reuse. It is a test specification, not a record of successful model runs. Structural validation of this JSON and passing runtime unit tests do not establish routing behavior, model accuracy or host skill discovery.

Each case has a raw user `prompt`, fixture `setup`, acceptable `expectedPrimary` workflow(s), requested `operation`, `requiredEvidence`, `allowedWrites` and `forbiddenActions`. The optional `gov` router may be an entrypoint; the primary workflow is the leaf that owns the requested outcome. Alternatives are allowed where both direct workflows can correctly honor the task, rather than forcing one hidden preferred answer.

## Evaluate a case

1. Record the exact candidate commit, model/host version and installed skill set. Build a fresh isolated repository from the case's setup facts, with real source/contracts/consumers, deterministic offline native commands and explicit Git state. Capture initial file contents, modes, index and HEAD. Do not run fault cases in a user repository.
2. Give a fresh session only the installed skills as the host normally exposes them, the raw user prompt, relevant source artifacts and any case-specified prior evidence. Keep `expectedPrimary`, `requiredEvidence`, `allowedWrites`, `forbiddenActions` and evaluator conclusions outside that session. Do not preselect a skill unless the raw prompt does so.
3. Let the session perform the task with its real tools. Capture skill loads, command argv/cwd/exits, relevant outputs, tool failures, candidate identities and the final response. Preserve final content/mode/index/HEAD snapshots. A written plan without the required execution does not demonstrate execution behavior.
4. Compare the trace and actual diff with the oracle fields. Check whether the chosen workflow served the requested intent, every write stayed authorized, required evidence is fresh, missing required tools prevented an unconditional pass, and any reroute or repeated investigation had an evidence-based reason. Inspect outcomes rather than relying only on the model's self-report.
5. Record pass/fail/blocked per obligation, actual observations and untested aspects. Use a fresh fixture/session for repetition. Retain raw evidence outside the rule registry; do not commit private logs or label the whole corpus validated from a few spot checks.

Native tests can create disposable outputs outside the reviewed repository when required; `allowedWrites: []` means the requested work must not change the repository's source, configuration, index or HEAD. Tool-generated artifacts inside a fixture must be identified and assessed for the task's read-only contract, not silently excluded from the diff.

For the freshness case, create the earlier passing evidence by running the real command, then perform the specified content change before the subject session. Supply the raw earlier output and fingerprints without an evaluator explanation. For replacement protection, record the ordered operations as well as the final config: a final enforce mode alone cannot show that the original gate stayed active throughout.

## Installation and discovery coverage

Run the relevant cases with the full toolkit and with only the specified leaf installed. The setup adoption/update/removal, native-check fallback and rule cases exercise standalone use; no sibling path may be assumed. Keep leaves other than `gov-setup` eligible for ordinary implicit selection; `gov-setup` is explicit-only (`agents/openai.yaml`), so cases expecting it must reach it through `$gov` or a named `$gov-setup` invocation, and the trace should record which. An explicit invocation test does not prove implicit selection, and neither proves that all hosts discover the same metadata.

The corpus also covers a root commit, read-only bilingual requests, approved generated-doc updates, mixed maintenance, missing required tools, shared-schema impact and stale evidence. Change-dependent selection must not treat `command.paths` as a dependency graph or prune required CI checks automatically.

If fresh model sessions or the required host are unavailable, report the corpus as unexecuted and state which structural/runtime checks did run. Do not invent routing success percentages, latency improvements or unverified platform support.
