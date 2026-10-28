---
name: gov-issue
description: Open a ticket (a GitHub issue by default) for one piece of work from a fixed template that follows the governance workflow from development and check through review, doc sync and CI to the new-invariant question. Use when asked to file, open or write up an issue or ticket for a feature, bug, doc fix, rule or maintenance task. Use gov-rule to implement a rule and gov-audit to find what work is needed.
---

# File one ticket for one pull request

## Scope

A ticket describes the work; it does not do it. Do not edit source, docs, config or `.governance/`, create branches, or install anything. The only write is the ticket itself. A request to open an issue is the authorization to create it: do not stop to ask for confirmation of the draft. Ask only for a decision that changes the ticket and cannot be inferred from the request or the repository.

## One ticket, one pull request

Size the ticket so one pull request can deliver and verify it. If the request needs several pull requests, do not create any ticket yet: propose the split as titles with their order and dependencies, and create after the user confirms. This is the single exception to creating directly. A vague request that names no deliverable gets a question about the deliverable, not a guessed ticket.

## Gather facts (read-only)

1. Resolve the target: the repository from the current Git remote, or the one the user named. Never file into a repository the user did not name or that is not the current remote.
2. Search open issues for a duplicate with `gh issue list --search "<key words>" --state open`. A clear duplicate: report its link and stop; do not create a second ticket. A near match: create the ticket and cite it under Risks and unknowns.
3. If `.governance/runtime/cli.mjs` exists, run `node .governance/runtime/cli.mjs status --root <repo> --json` and record the `state`. It runs no registered command. An `enforce-failing`, `invalid-contract` or `runtime-drift` state goes under Risks and unknowns as a precondition, because it will fail the pull request's governance check. If the runtime is absent or predates `status`, record "toolkit not installed" and use the project's own test command in the workflow instead of `check`; do not install or repair anything and do not run `check` just to fill a field.
4. Read what the request touches: the authoritative docs, the real consumers and the existing protection. Name concrete paths in Scope and build the Change map: for each path that will be created, updated or deleted, find its governing source and its protection (see below). If the change adds or alters something other code depends on (a new node or entity type, a schema field, a public export, a cache key, a validation or UI surface), list those consumers under Governance impact. Do not claim a consumer list is complete; say what was traced.

## Change map

Every path the pull request will create, update or delete gets one row: action, governing source, protection. A later reviewer, human or `$gov-check`, can only judge a change against a source it is told about, so this is the most important part of the ticket.

- Create: look at sibling files for the established pattern and find the document or rule that states it.
- Update: find what the current file is bound by (rule, schema, contract doc) before describing the change.
- Delete: list everything that references the path (rule `scope`, `source` or `proof`, check `paths` in `.governance/config.json`, links, imports) and say what happens to each. A missing check path is an error in every mode.
- List only paths you can ground in the repository. Mark a planned new path as proposed, and put a path you cannot name yet under Risks and unknowns. Do not ask the user for paths.
- If `.governance/rules.json` exists, match rules whose `scope` covers the path (it equals the path or is a parent directory; no globs) and copy their `source` and `enforcement`: a check id, with its mode taken from the `status` output or `config.json`, or `textReason`. A report-mode check does not fail CI. A `textReason` rule has no mechanical protection.
- Write `none found` or `none` when nothing applies. Do not invent a source or protection to fill a cell. Repeat every `none` and `text only` row under Risks and unknowns as review-only coverage, and when it exposes a pattern nobody guards, say so in the invariant question.

## Fill the template

Use [the template](references/template.md) exactly: same headings, same order, every heading present. Choose one Type: `feature`, `bug`, `docs`, `rule` or `maintenance`. The template explains which optional lines apply to which type; delete only lines marked optional that do not apply, never a heading.

- Title: `[type] short summary`, at most 72 characters.
- Write the body in the language of the request. Headings stay as in the template so tickets remain uniform.
- Acceptance criteria are observable and testable: a behavior, a command and its expected result, a document that must say something. Not "works well".
- Keep Scope concrete: paths in, paths and behaviors explicitly out.
- For each create or update row that has a governing source, add a criterion that names the specific requirement from that source and how it is verified: a check id, or "review against <source>". Skip rows marked `none found`.
- Do not invent facts. Unknowns go under Risks and unknowns with the question that resolves them.
- Do not copy secrets, tokens or private logs into the body.

## Create the ticket

Default tracker is GitHub. Write the body to a temporary file outside the repository and run:

```sh
gh issue create --repo <owner>/<repo> --title "<title>" --body-file <file>
```

If `gh` is missing or not authenticated, use the GitHub tool the session already has for creating issues; do not install a CLI or ask for credentials. If the user names another tracker (Jira, Linear, GitLab and so on), use that tracker's connector or CLI only if the session already has one, mapping the same sections. With none available, output the finished title and body in a Markdown block for pasting and say plainly that nothing was created.

Do not add assignees, milestones, projects or labels unless the user asked. Do not close, edit or comment on other issues. After creating, verify by reading the ticket back (`gh issue view <number> --repo <owner>/<repo>`) and report its link, the Type, the recorded governance state and anything left as an unknown. If creation fails, report the error and give the body for manual use; never claim a ticket exists without its link.
