# Usage scenarios

What to say, which skill answers, and what you get back. First-time setup is in [getting started](getting-started.md).

## Which skill for which situation

| You want to... | Invoke | Changes files? |
| --- | --- | --- |
| Understand what governance already exists and what is missing | `$gov-audit` | No |
| Install, preview, update or remove the toolkit; wire CI or the hook | `$gov-setup` | Yes, owned runtime and config |
| Review a commit, PR or working tree before merge | `$gov-check` | No, unless you ask for fixes |
| Bring docs and generated files in line with a behavior change | `$gov-doc-sync` | Yes, docs and generated output |
| Protect one invariant that broke before | `$gov-rule` | Yes, tests, checks and rules |
| Repair drift and tidy rules after many changes | `$gov-maintain` | Yes, within your scope |
| Open a ticket for planned work | `$gov-issue` | Creates the issue only |
| Unsure, or the task spans several of the above | `$gov` | Depends on the chosen skill |

Naming the skill (`$gov-check ...`) always works. A plain request can also be matched to a skill automatically. Whether a request changes anything depends on what you asked for: a review or an audit stays read-only even when it finds problems.

If the runtime is installed, `node .governance/runtime/cli.mjs status --root .` shows the repository state and suggests a skill. Treat it as a hint. See [reading status](troubleshooting.md#reading-status).

## 1. First adoption in an existing repo

```text
$gov-audit
$gov-setup Preview first, then apply the smallest useful batch from the audit in report mode.
```

You get a map of authorities and protections, then `.governance/` with a report-only batch. Nothing is enforced and CI is unchanged until you ask. Product problems found by the audit are reported as separate tasks, not fixed.

## 2. Review a change before merge

```text
$gov-check Review the staged changes. Do not modify files.
$gov-check Review this branch against main, including the docs.
```

It identifies the exact candidate (revision and dirty files), traces callers and docs, runs your existing checks, and returns one outcome:

| Outcome | Meaning |
| --- | --- |
| `pass` | Required coverage completed, nothing relevant open, evidence fresh. |
| `issues` | Supported problems, each with file, impact and a correction. |
| `blocked` | A needed tool, decision or input is missing, so no conclusion. |
| `partial` | A useful subset was checked and the gaps are listed. |

It will not call a result `pass` on a stale earlier run, or when a required tool is missing.

## 3. Docs went stale after a behavior change

```text
$gov-doc-sync The API rename in this commit is approved. Update the affected docs and generated guides.
$gov-check Did this staged change make any docs stale? Just tell me.
```

For generated material it finds the real generator and reruns it instead of editing the output. If the change looks like a regression rather than an intended change, it reports that as a product task and keeps the promise intact. A question phrased as "just tell me" stays read-only.

## 4. The same bug came back

```text
$gov-rule This public export was removed twice. Add a guard so it fails if it happens again.
```

It prefers types or architecture rules, then existing lint, tests or CI, and reuses an existing check before adding one. It proves the guard on an isolated bad case that must fail and a good case that must pass, without breaking your working tree. Durable references go in `.governance/rules.json`:

```json
{
  "id": "public-exports",
  "owner": "api-team",
  "scope": ["src/index.ts"],
  "source": ["docs/api.md"],
  "proof": ["tests/exports.test.ts"],
  "enforcement": { "check": "unit" }
}
```

Paths are real repo-relative files. The named check must already be in `config.json`. A rule that cannot be checked mechanically uses `"enforcement": { "textReason": "why" }` instead.

## 5. Cleanup after a stretch of changes, or CI went red

```text
$gov-maintain Review governance drift in docs and check commands. Repair what is governance-only. Leave product behavior alone.
```

It classifies each finding as doc drift, tool drift, a product regression or unclear intent. It repairs governance drift you authorized, keeps existing enforced gates enforced, and reports product regressions separately. The result is `clean`, `changed`, `partial` or `blocked`, with the coverage it actually had. A sampled review is never reported as a full-repo clean.

## 6. Not sure where to start

```text
$gov I want to know whether our docs and checks are in good shape, and fix cheap things.
```

The router picks one primary workflow from your request, what is installed and what you allowed, then hands evidence forward instead of repeating work. Naming a specific skill skips it.

## 7. Update the toolkit

```sh
npx skills update
```

Then in Codex:

```text
$gov-setup Preview the runtime update.
```

The preview lists what would change in `.governance/runtime/`. Apply it only after reviewing. Your `config.json`, `rules.json`, docs and CI are never overwritten. If someone edited a runtime file by hand, the update stops and reports it. There is no force option: restore the file or ask `$gov-setup` to reconcile it.

## 8. Remove the toolkit

```text
$gov-setup Remove the toolkit's runtime and hook. Keep our rules, docs and native checks.
```

It removes an installed hook first, then the owned runtime. Your config, rules, docs and extra files stay. Delete any CI step that calls `.governance/runtime/cli.mjs` yourself, or ask for it as part of the cleanup.

## 9. Plan new work as a ticket

```text
$gov-issue Add a "retry" node type to the flow engine.
```

It creates one GitHub issue directly, with no confirmation step, from a fixed template: summary and type, scope, acceptance criteria, a workflow checklist, governance impact, and risks. The checklist is the everyday loop: develop, run `check` and your tests before push, `$gov-check` before the PR, `$gov-doc-sync` if behavior or docs changed, CI, and after merge the question "did this create something that must never break?" (if yes, `$gov-rule`).

- It adds a Change map: every path to be created, updated or deleted, with the document or rule that governs it and what would fail if it were broken. Rows whose protection is `none` or `text only` are called out as review-only, so the reviewer knows no check will catch them. A path it cannot ground in the repository is listed as unknown, never guessed.
- One ticket is one pull request. If your request needs several, it proposes the split and waits for your OK before creating any ticket.
- It searches open issues first and stops with a link if one already covers the work.
- If `.governance/` is installed it reads `status` and records the state in the ticket. It never runs `check`, edits files or adds labels, assignees or milestones unless you ask.
- Default tracker is GitHub through `gh`; without `gh` it uses the GitHub tool the session already has. For Jira, Linear or others it uses a connector only if one is available, otherwise it gives you the text to paste and says nothing was created.

## Good habits

- Name the outcome and the limit: "review, do not edit", "report mode only", "do not touch product code".
- Keep batches small. Add one or two checks, clear them, then enforce them.
- Trust exit codes over summaries. `check` exits 1 for an enforced finding; `report` exits 0 even with findings.
- A machine pass covers only the declared checks. It is not a statement that the code is correct.
