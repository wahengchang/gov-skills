---
name: gov-setup
description: Adopt, preview, update or remove owned repository governance tooling after skill installation, or configure explicitly requested Codex feedback hooks. Use for runtime/config/CI lifecycle operations; choose preflight for the requested operation. Missing runtime during an ordinary review is not a setup trigger. Use gov-rule for one invariant and gov-check for a candidate review.
---

# Adopt governance into an existing repo

## Orient

Resolve the requested operation first. Use this installed skill's intact bundled CLI, `node "<skill>/runtime/cli.mjs" status --root "<repo>" --json`, to inspect an older or damaged target without importing its runtime. State and suggestions are evidence, not permission to change the requested operation. `ready-to-activate` names possible report-mode candidates; only an authorized adoption task may select a complete batch, revalidate it and activate. Preview, update, removal and hook-only tasks do not activate checks. Reconcile ownership/config conflicts before an authorized update.

Use the actual installed directory containing this SKILL.md as `<skill>`. All required code is bundled here; no source checkout, sibling skill, package install or home-directory script is needed. Read [the runtime contract](references/runtime.md) before editing config, rules or invoking tools.

Resolve the requested operation and explicit target root before choosing work. Preserve preview-only and removal scopes; do not run adoption steps for every lifecycle request. Read applicable instructions, Git/dirty state, installed ownership and affected integration. Reuse relevant in-context evidence after checking its current revision, content and config; no sibling skill or router is required.

For initial adoption, perform a fresh read-only audit or validate an existing one: inspect navigation, native tools/CI and one representative entrypoint → implementation → consumer → test path. For an update, focus on owned runtime changes, project contracts, hooks/CI compatibility and affected checks. For removal, inspect owned paths and hook/CI references. For hooks, read the hook contract only when requested. Expand investigation when new evidence makes impact uncertain. Review registered native commands and side effects before execution; arbitrary commands can mutate files or access the network.

## Adopt or preview deployment

Choose a small useful batch grounded in that audit. Reuse authoritative docs and native type/lint/architecture/test commands; select explicit paths and explain each check. No generic docs hierarchy or fixed instruction budget. Product behavior changes/refactors need a separate task; keep newly adopted dependent checks in report, retain already-enforced gates, and finish independent work.

Run the bundled installer against the explicit target root:

```sh
node "<skill>/scripts/setup.mjs" preview --root "<repo>"
node "<skill>/scripts/setup.mjs" apply --root "<repo>"
```

Preview is read-only; a preview-only request ends with its findings before apply, config or CI edits. For adoption, review the actual changes and apply within the user's existing authorization; preview is not an automatic new approval checkpoint. Apply installs versioned runtime and a reference-integrity check in report mode. Config and rules belong to the project. Add the selected checks to that config, respecting its strict schema; never auto-discover then execute package scripts.

The tool refuses unowned destination collisions, changed/missing owned runtime and symlink paths. Reconcile such conflicts explicitly; do not use reset, stash, force overwrite or delete extra files. Writes are preflighted and ordinary failures roll back; process death or disk failure may need manual reconciliation. Preserve HEAD/index, dirty content, hooks, CI and user docs.

Run `node .governance/runtime/cli.mjs report --root "<repo>" --json`. Repair factual governance drift within scope. Keep product repairs separate. After the whole selected batch has completed with no findings/errors, activate it together with `activate --checks id,id`; then run `check`. Failed or incomplete activation leaves all modes unchanged. Never introduce a baseline, skip or lowered threshold to get green.

Integrate `node .governance/runtime/cli.mjs check --root .` into the existing CI after its normal dependencies/tool setup. For a new GitHub workflow, adapt [the minimal template](assets/governance.yml); register required native checks first. Preserve existing jobs and permissions. Local command success is not a verified remote required gate. Add only useful navigation pointing to existing authorities and the adopted commands.

## Update, remove or configure hooks

To update, review a fresh `preview`, then run `update` using the newly installed skill's setup script. To remove tooling, inspect the owned manifest and affected integration, remove the optional hook first, then `uninstall`. The installer's preview describes deployment, not an uninstall plan. Neither update nor uninstall deletes project config, rules, docs, CI or extra user files; reconcile CI references during removal. Review the resulting diff and rerun relevant checks, reusing unaffected fresh evidence.

Hooks are optional. Only when requested, read [hook integration](references/hooks.md). Skills and CI work without them.

Finish with actual changes, batch modes/findings, commands and exits, ownership conflicts, separate product tasks and verification gaps. Do not claim all checks enforce, all skill behavior tested, hooks trusted or remote CI green from file creation alone.
