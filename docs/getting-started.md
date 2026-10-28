# Getting started

## What this does for you

Think of it as a spell-checker for project rules. You write down things that must not break, and an automatic check enforces them on every push. If a rule is broken, CI turns red and says which file and line. If not, nothing happens.

Examples of rules it can enforce:

- Links in your README and docs still point at real files and headings.
- Your type checker or lint still passes.
- A folder is only imported through its public entry point.

The skills (`$gov-audit`, `$gov-setup`, ...) are helpers that inspect your project, choose these rules with you, and install the checker. After that the checker runs by itself.

## When do I need to do something?

Most of the time, nothing. You write code as usual and CI guards it. You only step in at these moments:

| When | What you do |
| --- | --- |
| Once, at the start | Follow the steps below. About 10 minutes. |
| Every push | Nothing. CI runs the check. Green means fine; red means read the message and fix it. |
| The same bug comes back | `$gov-rule`: turn that lesson into an automatic check. |
| Before merging a big change | `$gov-check`: have Codex review it. |
| You changed behavior and docs may be stale | `$gov-doc-sync`. |
| Every few weeks, or after many changes | `$gov-maintain`. |
| You want more protection | Add a new small batch of checks (see [Step 5](#step-5-choose-your-first-batch)). |
| You are not sure what to do | Run `node .governance/runtime/cli.mjs status --root .`. It tells you the state and a suggested next step. |

You do not have to remember this table. Everything after setup is a reaction to something that happens. More examples are in [usage scenarios](usage-scenarios.md), and symptoms are in [troubleshooting](troubleshooting.md).

Every command and output below comes from a real run of the installed skills in a temporary repository; your project's findings will differ.

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

Commit the whole `.governance/` directory, with your CI and `AGENTS.md` changes. CI runs the vendored checker, and teammates need the same config and rules. Stage specific files rather than `git add -A` if you have unrelated uncommitted work. `.agents/` and `skills-lock.json` are optional: commit them only if the team should share the same skill versions.

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

A "batch" is the first few things to check. You do not have to invent it. The audit from Step 2 already lists what your project has, and Codex can propose the batch from it.

Ask for a proposal first. Nothing is changed by this:

```text
$gov-audit Based on your audit, propose a first batch of at most 3 checks.
For each: kind, paths, why, whether running it has side effects, and how many findings you expect.
Propose only. Do not edit any file.
```

Read the proposal, then have it added in `report` mode:

```text
$gov-setup Add the batch you proposed to .governance/config.json in report mode. Do not activate anything yet.
```

If you want to judge a proposal yourself, look for things the project already has:

| The project already has | Check kind | Example |
| --- | --- | --- |
| A script that does not rewrite files (type check, lint, architecture test) in `package.json`, a Makefile or your CI | `command` | `npm run typecheck` |
| Markdown files that link to each other | `links` | `README.md`, `docs` |
| A bug that happened twice | a rule, via `$gov-rule` | a public export that was removed by mistake |
| A file size limit with a real reason | `size` | only if you can justify the number |

`registry` is installed by default; you do not add it.

Good first batches are small (one to three checks), use existing commands, and are already clean or nearly clean, so they can be enforced quickly. A check whose findings need product changes stays in `report`; do not wait for it.

An entry in `.governance/config.json` looks like this:

```json
{ "id": "docs", "kind": "links", "mode": "report", "reason": "Keep README and docs navigation valid", "paths": ["README.md", "docs"] }
```

Review what a `command` does before registering it: it can write files or use the network, and the runner is not a sandbox. The full schema is in the [runtime contract](../skills/gov-setup/references/runtime.md).

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
