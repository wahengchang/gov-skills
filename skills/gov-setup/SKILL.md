---
name: gov-setup
description: Adopt or update repository governance after installing these skills, deploying bundled checks, project configuration and CI safely into an existing repo. Also use to preview or remove owned tooling or configure optional Codex feedback hooks. Not for writing individual rules (gov-rule) or reviewing a change (gov-check).
---

# Adopt governance into an existing repo

## Orient

If the target already has `.governance/runtime/cli.mjs`, run `node .governance/runtime/cli.mjs status --root "<repo>" --json` before `preview`. `partial`, `runtime-drift` and `invalid-contract` mean reconcile before `update`; `ready-to-activate` means the next step is `activate` for the whole verified batch, not another install. Its `suggestions` are routing hints only.

Use the actual installed directory containing this SKILL.md as `<skill>`. All required code is bundled here; no source checkout, sibling skill, package install or home-directory script is needed. Read [the runtime contract](references/runtime.md) before editing config, rules or invoking tools.

Perform a fresh read-only audit, or validate available audit evidence against the current revision and dirty files. You can do this without `gov-audit` installed: inspect applicable instructions, navigation, native tools/CI and one representative entrypoint → implementation → consumer → test path. Separate facts, inferences and unknowns. Review any existing registered native commands before running them; arbitrary native commands can mutate files or access the network.

Choose a small useful batch grounded in that audit. Reuse authoritative docs and native type/lint/architecture/test commands; select explicit paths and explain each check. No generic docs hierarchy or fixed instruction budget. Product behavior changes/refactors need a separate task; keep newly adopted dependent checks in report, retain already-enforced gates, and finish independent work.

Run the bundled installer against the explicit target root:

```sh
node "<skill>/scripts/setup.mjs" preview --root "<repo>"
node "<skill>/scripts/setup.mjs" apply --root "<repo>"
```

Preview is read-only. Review its actual changes and apply within the user's existing authorization; preview is not an automatic new approval checkpoint. It installs versioned runtime and a reference-integrity check in report mode. Config and rules belong to the project. Add the selected checks to that config, respecting its strict schema; never auto-discover then execute package scripts.

The tool refuses unowned destination collisions, changed/missing owned runtime and symlink paths. Reconcile such conflicts explicitly; do not use reset, stash, force overwrite or delete extra files. Writes are preflighted and ordinary failures roll back; process death or disk failure may need manual reconciliation. Preserve HEAD/index, dirty content, hooks, CI and user docs.

Run `node .governance/runtime/cli.mjs report --root "<repo>" --json`. Repair factual governance drift within scope. Keep product repairs separate. After the whole selected batch has completed with no findings/errors, activate it together with `activate --checks id,id`; then run `check`. Failed or incomplete activation leaves all modes unchanged. Never introduce a baseline, skip or lowered threshold to get green.

Integrate `node .governance/runtime/cli.mjs check --root .` into the existing CI after its normal dependencies/tool setup. For a new GitHub workflow, adapt [the minimal template](assets/governance.yml); register required native checks first. Preserve existing jobs and permissions. Local command success is not a verified remote required gate. Add only useful navigation pointing to existing authorities and the adopted commands.

To update, review a fresh `preview`, then run `update` using the newly installed skill's setup script. To remove tooling, remove the optional hook first, then `uninstall`. Neither command deletes project config, rules, docs, CI or extra user files; reconcile CI references during removal. Review the resulting diff and rerun relevant checks.

Hooks are optional. Only when requested, read [hook integration](references/hooks.md). Skills and CI work without them.

Finish with actual changes, batch modes/findings, commands and exits, ownership conflicts, separate product tasks and verification gaps. Do not claim all checks enforce, all skill behavior tested, hooks trusted or remote CI green from file creation alone.
