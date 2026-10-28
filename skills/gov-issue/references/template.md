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

## Type notes

| Type | Starts from | Notes |
| --- | --- | --- |
| `feature` | New or changed behavior | Governance impact is mandatory: list what the feature must stay consistent with. |
| `bug` | A reproducible defect | Keep Reproduction. The first Acceptance item is the failing test that now passes. |
| `docs` | Documents that disagree with behavior or each other | Name both sides. Acceptance says which one is authoritative. |
| `rule` | A recurring failure or invariant | State the invariant, owner and the proof that must fail on a bad case. Delivered with `$gov-rule`. |
| `maintenance` | Governance drift or tool upgrades | Replaces the `$gov-doc-sync` line with `$gov-maintain`. Product behavior changes belong to a separate ticket. |
