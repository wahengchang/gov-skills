# Troubleshooting

Symptoms in the order people usually hit them. For the normal flow see [getting started](getting-started.md).

## Reading status

```sh
node .governance/runtime/cli.mjs status --root .
```

`status` is read-only and runs no registered command. Its suggestions are hints, not instructions.

| State | Meaning | Next step |
| --- | --- | --- |
| `not-installed` | No `.governance/` in the repo. | `$gov-audit`, then `$gov-setup`. |
| `partial` | Manifest, config or rules exist, but not all three. | `$gov-setup` preview. Reconcile; do not overwrite. |
| `runtime-drift` | An owned runtime file was edited, removed or cannot load. | `$gov-setup` preview. Restore or reconcile it. |
| `invalid-contract` | `config.json` or `rules.json` breaks the schema. | `$gov-maintain`, or fix the reported field. |
| `enforce-failing` | An enforced check has findings. | `$gov-check` for a recent change; `$gov-maintain` for drift. |
| `ready-to-activate` | Report-mode built-in checks have zero findings. | Only with an adoption goal: pick the whole batch, revalidate, `activate`. |
| `adopting` | Report-mode checks remain, or have findings. | `$gov-audit` for the next batch; `$gov-rule` for one invariant. |
| `enforced-unverified` | Everything is enforced, but some commands were not run by status. | Run `check`, or `$gov-check`. |
| `healthy` | Enforced, verified and clean for the declared checks. | Pick a skill by task. |

The JSON output has two separate fields: `adoption` (report, mixed, enforced, unknown) and `verification` (not-run, partial, complete, error). `healthy` covers only declared checks, not semantic correctness.

## Installation

**The skills are installed but `.governance/` does not exist.**
That is expected. Skills are instructions; the runtime is copied into the repo only when you invoke `$gov-setup` and it applies. Check with `ls .governance`.

**`$gov-setup` is not offered or not found.**
Confirm the files exist with `ls .agents/skills` and `npx skills list`. If they do, start a new Codex session in the project so it re-reads the skills. How Codex discovers skills is host behavior this repository's tests do not verify.

**`node .governance/runtime/cli.mjs` fails with "Cannot find module".**
Either the runtime is not installed, or it predates a command you ran (`status` was added in 0.2.0). The installed setup skill carries its own copy and can diagnose without the repo's runtime:

```sh
node .agents/skills/gov-setup/runtime/cli.mjs status --root .
```

**Setup refuses with "unowned destination conflict" or "owned runtime modified".**
Setup never overwrites files it does not own or that someone edited, and there is no force flag. Look at the named file. Restore it, move it aside, or ask `$gov-setup` to reconcile. Run `preview` again afterwards.

**`skills-lock.json` and `.agents/` showed up in `git status`.**
The skills CLI created them. Commit them if the team should share the same skill versions, or ignore them.

## Findings and exit codes

**`report` printed `issues` but exited 0.**
By design. In `report` mode findings are information. Only `check` fails on enforced findings.

**`activate` exited 1 and nothing changed.**
At least one check in the batch still has findings or errors. Fix them all, rerun `report`, then `activate` the whole batch. A partial activation never happens.

**Exit 2 and `ERROR config has unknown fields (baseline is not supported)`.**
The config uses a field the contract does not allow. There is no baseline, suppression or skip option. Remove the field and fix the finding instead. Other exit 2 causes: a missing path, an invalid check ID, a command that timed out or could not start. Exit 2 is raised in every mode.

**A check passes but I am not sure it protects anything.**
A machine pass covers only what the check declares. Existence of a proof file does not prove behavior. Ask `$gov-check` for a semantic review, or `$gov-rule` to prove the guard with a failing counterexample.

**Link check reports a missing anchor that exists in my docs.**
The built-in checker supports a practical Markdown subset: ATX headings and HTML ids. Setext headings, MDX, HTML `href` links and framework routes need your own docs tooling. Point the check at precise paths rather than the whole repo.

## Commands

**A registered `command` check changed files or hit the network.**
The runner is not a sandbox. It runs the exact `argv` you registered, without a shell. Review commands before registering them and prefer a tool's check mode (for example a formatter's `--check`) over one that rewrites files.

**`report` ran my command but `status` says `not-run`.**
Correct. `status` never runs commands; `report`, `check` and `activate` do.

**A command passes locally but fails in CI.**
CI must install your project's own dependencies before the governance step. The runner does not install anything.

**The command times out.**
`timeoutMs` is 30000 by default and capped at 120000. A timeout is an error, not a finding. Narrow what the command runs.

## CI

**The governance job fails on an older Node.**
The runtime needs Node >=22.20.0. Put the governance step in a job on a newer Node instead of in a matrix that includes older versions.

**It passes in CI but merges are not blocked.**
A green workflow is not a required check. Configure branch protection on your Git host and verify it separately.

## Files created by your OS

**AppleDouble `._*` files break a native check on an external drive.**
macOS writes them on some external volumes (FAT, exFAT, network shares). The toolkit's own recursive scans skip them, but your native tools may not. Remove them with `dot_clean .` after reviewing, and expect them to return on the same volume. Moving the repo to a native filesystem avoids it. This is an environment problem, not a product defect.

## Hook

**The hook never says anything.**
By design it is silent when the quick checks pass or the edit does not touch a check's scope. Set `GOV_HOOK_VERBOSE=1` in the hook's environment to get a message on every event. If still nothing appears, the hook may not be trusted yet: Codex requires its normal review of project hooks. Never edit the trust store to force it.

**The hook reports an error on every edit.**
Contract errors always show, even for unrelated edits. Fix the config or restore the file it references. A deleted file that a check lists in `paths` causes this.

**The hook did not catch a problem `report` finds.**
It runs only built-in checks, never your commands, and has a four-second limit. CI and `check` are the real gates.

## Still stuck

Run `status --json` and `report --json` and keep the output. They show the exact state, the failing check and the exit code. Use `$gov-maintain` for governance drift, or `$gov-check` for a candidate change.
