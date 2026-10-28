# Getting started

A first run in a new project, in order. Every command and output below comes from a real run of the installed skills in a temporary repository; your project's findings will differ.

For day-to-day use after adoption, see [usage scenarios](usage-scenarios.md). If something looks wrong, see [troubleshooting](troubleshooting.md).

## Before you begin

- A Git repository you can write to, and Codex.
- Node.js >=22.20.0 for the toolkit itself. Your project keeps its own tools and Node version.
- Know the two layers. They are installed separately:

| Layer | What it is | How it gets there |
| --- | --- | --- |
| Skills | Instructions Codex follows (`$gov-audit`, `$gov-setup`, ...) | `npx skills add` |
| Runtime | A small checker copied into your repo as `.governance/` | `$gov-setup` |

Installing skills changes nothing in your project's governance. Nothing runs until you invoke a skill.

Two rules shape everything else:

- **New checks start in `report` mode.** They list findings but never fail a build.
- **A batch becomes `enforce` only when a fresh run finds zero findings.** There is no baseline and no way to suppress a finding.

## Step 1: Install the skills

```sh
npx skills add wahengchang/gov-skills --agent codex
```

This writes the skills to `.agents/skills/` and creates a `skills-lock.json`. Decide with your team whether to commit them. You can install only setup with `--skill gov-setup`.

## Step 2: Audit first (recommended, read-only)

In Codex, inside the project:

```text
$gov-audit
```

It maps which files are authoritative, how real behavior reaches its consumers, and which native checks (types, lint, tests, CI) already protect it. It installs nothing and changes no files. Expect a list of facts, inferences, unknowns and suggested adoption batches.

An audit that reports many problems does not block the next step. Product defects it finds are separate work. Setup can proceed while they are fixed.

## Step 3: Set up the runtime

```text
$gov-setup Preview first and wait for my OK before applying.
```

Setup runs a read-only preview and shows what it would create. In a fresh repo that is nine runtime modules plus three project files:

```text
.governance/runtime/{cli,commands,core,hook,hooks,io,markdown,scope,status}.mjs
.governance/config.json
.governance/rules.json
.governance/manifest.json
```

Approve it and setup applies it. The installer itself never stages or commits, and it leaves your existing docs, CI and hooks alone; CI integration is a separate step below.

| File | Owner | Purpose |
| --- | --- | --- |
| `.governance/runtime/*.mjs` | toolkit | The checker. Hash-pinned in the manifest; local edits block later updates. |
| `.governance/manifest.json` | toolkit | Which runtime files the toolkit owns, and their hashes. |
| `.governance/config.json` | you | Which checks exist, their mode, and their paths. |
| `.governance/rules.json` | you | One entry per protected invariant, pointing at real files. Starts as `[]`. |

## Step 4: Look at the state

```sh
node .governance/runtime/cli.mjs status --root .
```

```text
status: ready-to-activate (installed toolkit 0.2.0)
adoption: report; verification: complete
registry [report] registry pass
activatable (built-in, zero findings): registry
-> gov-setup: if adoption is requested, select and revalidate the complete batch before activation
Status is a hint; it runs no registered commands and does not replace report/check.
```

`ready-to-activate` right after setup only means the single starter check is clean. That check only validates references inside `rules.json`, which is empty. Do not stop here: you have no real protection yet.

`status` never runs registered commands. The meaning of each state is in [troubleshooting](troubleshooting.md#reading-status).

## Step 5: Choose your first batch

Ask Codex to add a small batch grounded in the audit, for example:

```text
$gov-setup Add one check to .governance/config.json: validate Markdown links under README.md and docs.
Keep it in report mode. Do not activate anything yet.
```

The entry it adds looks like this:

```json
{ "id": "docs", "kind": "links", "mode": "report", "reason": "Keep README and docs navigation valid", "paths": ["README.md", "docs"] }
```

There are four check kinds:

| Kind | Use it for |
| --- | --- |
| `registry` | Rule references in `rules.json` still point at real files. |
| `links` | Relative Markdown links, images and heading anchors. No network. |
| `size` | File size or line budgets you justify for this repo. |
| `command` | Your own tool, run as an explicit `argv` array with no shell: typecheck, lint, an architecture test. |

Prefer `command` to reuse tools the project already has. Review what a command does before registering it: it can write files or use the network, and the runner is not a sandbox. The full schema is in the [runtime contract](../skills/gov-setup/references/runtime.md).

## Step 6: Read the report

```sh
node .governance/runtime/cli.mjs report --root .
```

```text
report: issues (exit 0)
registry [report] pass scope=.governance/rules.json
docs [report] issues scope=README.md,docs
  README.md:3: missing anchor #usage
```

Exit code 0 with `issues` is normal in `report` mode. It is not a pass. `report` does run `command` checks, so review them first.

## Step 7: Fix the findings, then enforce the batch

Fix every finding for the batch. Product behavior changes are separate tasks: leave those checks in `report` and enforce the independent ones.

Then enable the whole batch together:

```sh
node .governance/runtime/cli.mjs activate --root . --checks registry,docs
node .governance/runtime/cli.mjs check --root .
```

If any member still has a finding, `activate` exits 1 and changes no modes. On success:

```text
activate: pass (exit 0)
registry [report] pass scope=.governance/rules.json
docs [report] pass scope=README.md,docs
activated: registry,docs
```

From now on `check` exits 1 if an enforced check has a finding:

```text
check: issues (exit 1)
docs [enforce] issues scope=README.md,docs
  README.md:3: missing anchor #usage
```

## Step 8: Put `check` in CI

Ask `$gov-setup` to integrate it. It adapts your existing CI, or the bundled template if you have none. Existing jobs stay. The line that matters:

```yaml
- run: node .governance/runtime/cli.mjs check --root .
```

Two requirements:

- It must run on Node >=22.20.0. If your pipeline tests Node 18, add the governance step to a separate job on a newer Node.
- Install your project's own dependencies first, so registered `command` checks can run.

Passing locally does not verify a required check on your Git host. Configure and verify branch protection separately.

## Step 9 (optional): Edit feedback hook

If you want advisory feedback while Codex edits files, ask `$gov-setup` for the hook. It runs only the quick built-in checks, stays silent when they pass, and cannot block anything. It needs Codex's normal trust review. Details: [hook integration](../skills/gov-setup/references/hooks.md).

## Cheat sheet

| Command | Runs registered commands? | Exit codes |
| --- | --- | --- |
| `cli.mjs status --root .` | No | 0 diagnosed, 2 unreadable root |
| `cli.mjs report --root .` | Yes | 0 completed (findings may remain), 2 error |
| `cli.mjs check --root .` | Yes | 0 ok, 1 enforced finding, 2 error |
| `cli.mjs activate --root . --checks a,b` | Yes | 0 activated, 1 findings (nothing changed), 2 error |

All commands accept `--json`. `setup.mjs preview|apply|update|uninstall` lives in the installed `gov-setup` skill at `.agents/skills/gov-setup/scripts/setup.mjs`.
