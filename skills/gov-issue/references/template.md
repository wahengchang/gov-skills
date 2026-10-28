# Ticket template

Copy the block below. Keep every heading and the order. Replace each `<...>`. Lines marked (optional) are deleted when they do not apply to the Type; nothing else is removed.

```markdown
## Summary

<One or two sentences: what changes and why it matters.>

**Type:** <feature | bug | docs | rule | maintenance>

## Reproduction (optional: bug only)

- Steps: <exact commands or actions>
- Expected: <...>
- Actual: <...>

## Scope

- In: <repo-relative paths and behaviors this ticket changes>
- Out: <what this ticket deliberately does not touch>

## Change map

| Path | Action | Governing source | Protection |
| --- | --- | --- | --- |
| <repo-relative path> | <create \| update \| delete> | <source path (rule id), or `none found`> | <check id and mode; `text only: <reason>`; `none`> |

## Acceptance criteria

- [ ] <observable result, checked by a command, a test or a document statement>
- [ ] <...>

## Workflow

This ticket is delivered by one pull request.

- [ ] Develop on a branch. For a bug, first add a test that fails for the reported reason.
- [ ] Before push, run `node .governance/runtime/cli.mjs check --root .` and the project's tests. (If the toolkit is not installed, run the project's own checks only.)
- [ ] Before opening the PR, run `$gov-check` on the branch against the base, read-only.
- [ ] (optional) Behavior or documents changed: run `$gov-doc-sync`.
- [ ] (optional: maintenance only) Run `$gov-maintain` for the drift described in Scope.
- [ ] Open the PR. CI runs the governance `check`; fix any red result before merge.
- [ ] After merge, answer the invariant question below. If yes, run `$gov-rule`: add it in report mode, clear every finding, then `activate`.

## Governance impact

- Consumers touched: <callers, schemas, caches, validation, UI, docs that depend on this; say what was traced>
- New "must never break" invariant? <yes: state it, its owner and the proposed proof | no: one line why>
- Governance state when filed: <status state, or "toolkit not installed">

## Risks and unknowns

- <open question, near-duplicate issue, or failing precondition, each with what resolves it>
```

## Change map notes

- One row per path the pull request will create, update or delete. A path you cannot yet name goes under Risks and unknowns instead.
- Governing source is the document or rule that says how that path must look or behave: the `source` of a `.governance/rules.json` entry whose `scope` covers the path, otherwise the project doc or instruction file that applies. Write `none found` when there is none. Never guess one.
- Protection is what fails if the path breaks the source: a registered check with its mode (`report` findings do not fail CI; execution and configuration errors still do), `text only` with the rule's `textReason` when no registered check covers the path, or `none`. Checks run independently of rules, so look at every check's `paths`, not only the rule's `enforcement`. A named check is not proof that its script covers the requirement.
- `delete` rows also name every rule, link or consumer that references the path (`scope`, `source` or `proof` in `rules.json`, check `paths` in `config.json`, Markdown links, imports). Deleting a referenced path makes the `registry` check report a finding; that fails CI only once the check is in `enforce` mode. A missing path in any check's `paths` is an error and fails `check` in every mode.
- A row whose Protection is `none` or `text only` is repeated under Risks and unknowns as review-only coverage.

## Type notes

| Type | Starts from | Notes |
| --- | --- | --- |
| `feature` | New or changed behavior | Governance impact is mandatory: list what the feature must stay consistent with. |
| `bug` | A reproducible defect | Keep Reproduction. The first Acceptance item is the failing test that now passes. |
| `docs` | Documents that disagree with behavior or each other | Name both sides. Acceptance says which one is authoritative. |
| `rule` | A recurring failure or invariant | State the invariant, owner and the proof that must fail on a bad case. Delivered with `$gov-rule`. |
| `maintenance` | Governance drift or tool upgrades | Replaces the `$gov-doc-sync` line with `$gov-maintain`. Product behavior changes belong to a separate ticket. |
