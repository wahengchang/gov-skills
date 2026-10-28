# Gov Skills

Reusable engineering governance for Codex in existing repositories, using the project's own language, framework and native checks. New checks report first; a selected batch becomes enforce only after a fresh complete run finds zero violations. There is no legacy baseline.

## Install and use

Requires Node.js >=22.20.0 for the skills CLI and bundled tooling. Target repositories keep their own native tool dependencies.

Install from GitHub:

```sh
npx skills add wahengchang/gov-skills --agent codex
```

For adoption, invoke `$gov-setup` in the target repo. Installing skills makes instructions and bundled resources available; setup audits the repo and deploys its independent runtime/config/CI integration. It does not run automatically during skill installation. You can install only setup with `--skill gov-setup`.

| Skill | Use |
| --- | --- |
| [gov](skills/gov/SKILL.md) | Choose and coordinate workflows for an ambiguous or multi-step governance request. Optional; clear tasks can go directly to a specialist. |
| [gov-audit](skills/gov-audit/SKILL.md) | Trace authoritative sources, real behavior, consumers and existing protection. |
| [gov-setup](skills/gov-setup/SKILL.md) | Adopt, preview, update or remove owned tools; integrate project-specific CI. |
| [gov-rule](skills/gov-rule/SKILL.md) | Place an invariant in suitable native protection, with a failing counterexample. |
| [gov-doc-sync](skills/gov-doc-sync/SKILL.md) | Reconcile changed behavior with source docs and generated material. |
| [gov-check](skills/gov-check/SKILL.md) | Review an identified candidate with fresh mechanical and semantic evidence. |
| [gov-maintain](skills/gov-maintain/SKILL.md) | Repair governance drift, consolidate rules and preserve useful protection. |

An individual daily skill can investigate with native tools without the toolkit installed. It reports missing integration instead of silently installing it. Governance tasks complete authorized reversible governance changes; product behavior changes/refactoring remain separate work.

## Adaptive routing

Use `$gov` when the request crosses workflows or its primary governance task is unclear. An explicit specialist invocation or a clear single task goes directly to that skill. The router selects a primary workflow from the requested outcome, existing authorization, available tools and observed impact. It is an instruction workflow, not a background service or a new runtime command.

- Review a commit or PR: `gov-check`; investigate unclear existing coverage: `gov-audit`.
- Adopt/update/remove tooling: `gov-setup`; reconcile an approved change with docs: `gov-doc-sync`.
- Add/revise/retire an invariant: `gov-rule`; repair adopted governance drift: `gov-maintain`.

Investigation can stay focused, expand to affected consumers, or become a full audit when warranted. Missing toolkit integration does not trigger setup, and read-only review does not become repair because it finds drift. New evidence can justify a specific handoff; specialists do not recurse into the router. Reuse current evidence in the conversation and invalidate affected results when the candidate, relevant configuration, commands or environment change. See the [routing contract](skills/gov/references/routing.md).

New checks start in report. Existing enforce gates retain their protection during repair or replacement: prove and activate a replacement before retiring the old gate. Routing never changes modes or skips required CI checks merely because a changed path does not overlap `command.paths`; those paths are not a dependency graph.

## Project runtime

Setup installs `.governance/runtime/` and `.governance/manifest.json`, and creates project-owned `config.json` and `rules.json` if absent. Its initial batch checks registry references in report mode. Adopt additional precise paths and reviewed native commands after the audit. There is no mandatory docs hierarchy or universal AGENTS size limit.

```sh
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

Conflicts, locally edited/missing owned runtime and symlinks abort before writes. There is no force overwrite. Uninstall preserves project config/rules/docs/CI and extra user files; remove obsolete CI references as part of the authorized cleanup. Replacements and rollback preserve existing POSIX file permission bits; new files follow the process umask. No staging, committing or cleaning dirty work is performed. Ordinary I/O failures roll back; process interruption or filesystem failure may need manual reconciliation.

Optional [Codex edit feedback hooks](skills/gov-setup/references/hooks.md) reuse only quick built-in checks and remain advisory. They require Codex's normal trust review and real-trigger verification. Remove the owned hook before uninstalling runtime. CI and skills work independently of hooks.

## Develop and verify

```sh
npm run validate
npm test
# Optional networked check: real skills CLI installation into a temporary project
node scripts/test-install.mjs
```

No npm package publication or dependency installation is needed for ordinary tests. The test suite uses Node and a Python fixture to exercise distinct target tools. All fixtures are temporary; tests do not execute commands in another user repository. Product instructions and code are independently written.

The [routing acceptance cases](evals/README.md) specify behavioral checks for fresh sessions, including read-only requests, absent tools, stale evidence and existing enforce gates. `npm run validate` checks corpus structure, not model routing behavior. The reviewed release list in `scripts/entrypoints.mjs` is shared by structural and real-install validation.

See [validation status](docs/validation.md) for exact evidence and limits, including remote verification. No license selection or universal platform validation is implied.
