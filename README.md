# Gov Skills

Reusable engineering governance for Codex in existing repositories, using the project's own language, framework and native checks. New checks report first; a selected batch becomes enforce only after a fresh complete run finds zero violations. There is no legacy baseline.

## Install and use

Requires Node.js >=22.20.0 for the skills CLI and bundled tooling. Target repositories keep their own native tool dependencies.

Install from GitHub:

```sh
npx skills add wahengchang/gov-skills --agent codex
```

Then invoke `$gov-setup` in the target repo. Installing skills makes instructions and bundled resources available; setup audits the repo and deploys its independent runtime/config/CI integration. It does not run automatically during skill installation. You can install only setup with `--skill gov-setup`.

| Skill | Use |
| --- | --- |
| [gov-audit](skills/gov-audit/SKILL.md) | Trace authoritative sources, real behavior, consumers and existing protection. |
| [gov-setup](skills/gov-setup/SKILL.md) | Adopt, preview, update or remove owned tools; integrate project-specific CI. |
| [gov-rule](skills/gov-rule/SKILL.md) | Place an invariant in suitable native protection, with a failing counterexample. |
| [gov-doc-sync](skills/gov-doc-sync/SKILL.md) | Reconcile changed behavior with source docs and generated material. |
| [gov-check](skills/gov-check/SKILL.md) | Review an identified candidate with fresh mechanical and semantic evidence. |
| [gov-maintain](skills/gov-maintain/SKILL.md) | Repair governance drift, consolidate rules and preserve useful protection. |

### Which skill?

In a target repo that already has the runtime, `node .governance/runtime/cli.mjs status --root . --json` reports the governance state and suggests a skill. It is read-only, runs no registered command, and the hint never overrides the task you ask for.

| State | Suggested skill |
| --- | --- |
| `not-installed` | `gov-audit`, then `gov-setup` |
| `partial`, `runtime-drift` | `gov-setup` (preview, reconcile) |
| `invalid-contract` | `gov-maintain` |
| `enforce-failing` | `gov-check` for a recent change, `gov-maintain` for drift |
| `ready-to-activate` | `gov-setup` (activate the verified batch) |
| `adopting` | `gov-audit`, `gov-rule` |
| `healthy` | by task: `gov-check`, `gov-doc-sync`, `gov-rule`, `gov-maintain` |

`gov-setup`, `gov-rule` and `gov-maintain` change repository files, so they ship an `agents/openai.yaml` with `allow_implicit_invocation: false` and run only when named. `gov-audit`, `gov-check` and `gov-doc-sync` may be chosen from the task description.

An individual daily skill can investigate with native tools without the toolkit installed. It reports missing integration instead of silently installing it. Governance tasks complete authorized reversible governance changes; product behavior changes/refactoring remain separate work.

## Project runtime

Setup installs `.governance/runtime/` and `.governance/manifest.json`, and creates project-owned `config.json` and `rules.json` if absent. Its initial batch checks registry references in report mode. Adopt additional precise paths and reviewed native commands after the audit. There is no mandatory docs hierarchy or universal AGENTS size limit.

```sh
node .governance/runtime/cli.mjs status --root . --json
node .governance/runtime/cli.mjs report --root . --json
# Fix all findings for the chosen batch, then revalidate and enable it together:
node .governance/runtime/cli.mjs activate --root . --checks registry,docs
node .governance/runtime/cli.mjs check --root .
```

`docs` above is an example adopted check, not part of the initial config. `report` preserves all findings; exit 0 can still mean issues. `check` gates enforce findings. Execution/config errors return 2 in every mode. Activation with any finding/error changes no modes. A machine pass covers declared mechanical checks, and does not establish complete semantic coverage.

Read the [config/rule schema and command contract](skills/gov-setup/references/runtime.md) before changing config. Registered commands run without shell expansion, with explicit cwd/argv/timeout and captured exits; review their side effects first. The runner is not a sandbox. Use native generator check modes for generated-consistency checks.

CI runs the vendored command after native dependencies are ready. Setup adapts existing CI or the bundled [GitHub template](skills/gov-setup/assets/governance.yml); existing jobs remain. Remote required checks need separate verification.

## Update and remove

Update installed skills using the skills CLI, then invoke `$gov-setup` to review and update the target repo's owned runtime. To operate directly, resolve `<installed-gov-setup>` from the actual installed skill location:

```sh
node "<installed-gov-setup>/scripts/setup.mjs" preview --root "<repo>"
node "<installed-gov-setup>/scripts/setup.mjs" update --root "<repo>"
node "<installed-gov-setup>/scripts/setup.mjs" uninstall --root "<repo>"
```

Conflicts, locally edited/missing owned runtime and symlinks abort before writes. There is no force overwrite. Uninstall preserves project config/rules/docs/CI and extra user files; remove obsolete CI references as part of the authorized cleanup. No staging, committing or cleaning dirty work is performed. Ordinary I/O failures roll back; process interruption or filesystem failure may need manual reconciliation.

Optional [Codex edit feedback hooks](skills/gov-setup/references/hooks.md) reuse only quick built-in checks and remain advisory. They require Codex's normal trust review and real-trigger verification. Remove the owned hook before uninstalling runtime. CI and skills work independently of hooks.

## Develop and verify

```sh
npm run validate
npm test
# Optional networked check: real skills CLI installation into a temporary project
node scripts/test-install.mjs
```

No npm package publication or dependency installation is needed for ordinary tests. The test suite uses Node and a Python fixture to exercise distinct target tools. All fixtures are temporary; tests do not execute commands in another user repository. Product instructions and code are independently written.

See [validation status](docs/validation.md) for exact evidence and limits, including remote verification. No license selection or universal platform validation is implied.
