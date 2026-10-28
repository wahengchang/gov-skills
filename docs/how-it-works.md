# How protection works

This page explains what protects a repository, how a violation gets noticed, and where each kind of protection stops. Read it to learn what you can rely on and what you must still review yourself.

## The one idea

Gov Skills governs how an AI engineer changes code. It does this in two layers that fail in different ways:

| Layer | What it is | Strength | Weakness |
| --- | --- | --- | --- |
| Runtime and CI | `.governance/runtime/*.mjs` runs registered checks. CI runs them on every push and pull request. | Deterministic. The same input gives the same result. The AI cannot talk its way past it. | Sees only what was registered. It cannot judge meaning. |
| Skills | `SKILL.md` instructions the AI follows: `gov-check`, `gov-audit`, `gov-rule` and the rest. | Can judge meaning, intent and consistency. | They are instructions. Nothing forces the AI to follow them, and they have not been measured in fresh sessions. |

A violation is caught mechanically only when someone turned the rule into a registered check. Otherwise it depends on review.

## Three kinds of protection

When a rule matters, `gov-rule` picks the strongest kind that fits, in this order.

| Order | Kind | How it protects | Example | Strength |
| --- | --- | --- | --- | --- |
| 1 | **Design** | The invalid state cannot be written or cannot exist. | A type that has no way to express the bad value. A module that exports only its public entry. | Strongest. Nothing to run and nothing to forget. |
| 2 | **Mechanical** | A registered check fails when the rule is broken. | A lint rule, an architecture test, an import-rule script, a link check. | Hard when the check is in `enforce` mode and CI is required. |
| 3 | **Semantic** | A written rule that review judges against its source document. | "New modules follow the pattern in `docs/cms-pattern.md`." | Soft. Review is the only coverage. |

Choosing the order is a design decision, not a formality:

- Prefer removing the possibility of the mistake over detecting it.
- Use text-only protection only with a specific reason why a mechanical check is unsuitable. It is recorded as `textReason`.
- Reuse or improve an existing check before adding a second one.

## What the files hold

| File | Role | Owned by |
| --- | --- | --- |
| `.governance/config.json` | The **detectors**: which checks exist, what they run, their mode. | Your project |
| `.governance/rules.json` | The **register**: which invariant matters, who owns it, which document states it, which file proves it, and which check enforces it. | Your project |
| `.governance/runtime/*.mjs` | The engine that runs the checks. | The toolkit (updated by `gov-setup`) |

A rule points at a check. A check can exist without a rule, but a rule needs a check or a `textReason`.

```json
{
  "id": "cms-handler-pattern",
  "owner": "cms-team",
  "scope": ["cms/modules"],
  "source": ["docs/cms-pattern.md"],
  "proof": ["scripts/check-cms-pattern.mjs"],
  "enforcement": { "check": "cms-pattern" }
}
```

| Field | Meaning |
| --- | --- |
| `scope` | Which paths the invariant covers. Real repo-relative paths, no globs. |
| `source` | The document that states the rule. A reviewer judges a change against it. |
| `proof` | The file that demonstrates the rule is effective, usually a test or script. |
| `enforcement` | Either `{ "check": "<id>" }` or `{ "textReason": "why a check is unsuitable" }`. |

## The four check kinds

| Kind | Fails when | Cost to set up |
| --- | --- | --- |
| `registry` | A path named in `rules.json` no longer exists. | Built in. |
| `links` | A Markdown link points to a missing file or heading. | Built in. |
| `size` | A file exceeds `maxBytes` or `maxLines`. | Built in. |
| `command` | The command you register exits non-zero. | You write the script or test. |

Only `command` can express a rule about meaning or design, such as "no module imports another module's internals". The other three check structure. If you want the machine to catch a design pattern, you need a script that fails on a bad case.

## Modes and exit codes

| Mode | Effect | CI |
| --- | --- | --- |
| `report` (default for a new check) | Findings are listed. | Exit 0. CI stays green. |
| `enforce` | Findings fail the check. | Exit 1. CI turns red. |

An error in the tool itself, such as a bad config or a command that cannot start, exits 2.

A new check starts in `report`. `activate` turns a selected batch to `enforce` only after a fresh complete run shows zero findings. There is no baseline file and no way to excuse an existing violation. If old code violates the rule, fix it or keep the check in `report`.

## How a change is identified

A change is matched to protection by path, in three different ways:

| Matching | Used by | How |
| --- | --- | --- |
| Check `paths` | The runtime and the optional hook | The check declares where it looks. The hook runs a quick check when an edited file overlaps those paths. `registry` also runs for a path a rule references, and `links` runs for any edit in the repository. |
| Rule `scope` | `gov-check`, `gov-issue` | The rule declares which paths its invariant covers. A reviewer maps each changed path to the rules whose scope contains it, then reads their `source`. |
| Consumers | `gov-audit`, `gov-check` | The AI traces real callers, schemas, configuration and docs. A declared scope seeds this and does not prove completeness. |

Three outcomes follow for any changed path:

| Path is... | Covered by | What a review can say |
| --- | --- | --- |
| In a rule's scope with a check | The check, plus review of the `source` | Mechanical result and semantic judgment, kept separate |
| In a rule's scope with `textReason` | Review only | "No mechanical protection exists" |
| In no rule's scope | Nothing | "Impact unknown". It is not a pass. |

## When a violation can be noticed

```text
edit ──► hook ──► local check ──► $gov-check ──► CI ──► branch protection ──► merge
          │            │              │           │              │
       advisory      you run        AI judges   automatic     blocks the merge
       quick checks  everything     meaning     enforce → red  (GitHub setting)
```

| Stage | Runs | Blocks? | Notes |
| --- | --- | --- | --- |
| Hook, as the AI edits | `registry`, `links`, `size` only | No | Never runs `command` checks, so a pattern script is silent here. Output is context for the AI, exit is always 0. |
| `check` before push | Every registered check, including `command` | Only if you act on it | Run it yourself: `node .governance/runtime/cli.mjs check --root .` |
| `$gov-check` before the PR | Native checks plus semantic review | No | The AI reads rule sources and consumers. Its result is `pass`, `issues`, `blocked` or `partial`. |
| CI on push and pull request | `check --root .` | Marks the commit red for `enforce` findings | Report-mode findings do not fail it. |
| Branch protection | Requires the CI check to pass | Yes | A GitHub setting outside this repository. Without it, a red check can still be merged. |
| `$gov-maintain`, periodic | Rule and check health | No | Finds rules with no protection, stale proofs and drift. |

## Worked example: a file that breaks a pattern

Setup: every module under `cms/modules` must `export default createHandler(...)`, as written in `docs/cms-pattern.md`. A pull request adds `cms/modules/news/newFiles.js`, which uses `require` and a raw function. This was run in a throwaway repository with the real runtime.

| Situation | Result |
| --- | --- |
| No rule or check for the pattern | `check` passes, exit 0. Nothing is noticed mechanically. |
| A `command` check exists, mode `report` | The finding is listed, exit 0. CI is green and the file can merge. |
| The same check in mode `enforce` | `cms/modules/news/newFiles.js: must export default createHandler(...)`, exit 1. CI is red. |
| The check is enforced and the AI edits the file | The hook stays silent. It does not run `command` checks. |
| Only a `textReason` rule points at the document | Mechanically a pass. `gov-check` should read the source, flag the file, and state that review was the only coverage. |

The path from idea to blocked merge:

```text
docs/cms-pattern.md        the rule in words
        │ write a script that fails on a bad case
scripts/check-cms-pattern.mjs
        │ register it
.governance/config.json    kind: command, mode: report
.governance/rules.json     scope, source, proof, enforcement.check
        │ clear every finding, then activate
mode: enforce
        │ pull request
CI runs check ──► exit 1 ──► branch protection blocks the merge
```

## What each skill adds

| Skill | Contribution to protection |
| --- | --- |
| `gov-setup` | Installs the runtime, config, CI and optional hook. Never runs by itself. |
| `gov-audit` | Finds which authorities, behavior and consumers exist and what already protects them. |
| `gov-rule` | Chooses the protection kind, proves it with a failing bad case and a passing good case, records it. |
| `gov-check` | Reviews a candidate against rule sources and consumers, runs native checks, and reports where only review covered a path. |
| `gov-doc-sync` | Reconciles documents with changed behavior. |
| `gov-maintain` | Repairs governance drift and consolidates rules without weakening protection. |
| `gov-issue` | Files a ticket with a Change map: each path to create, update or delete, its governing source and its protection. |

## What this cannot do

| Limit | Consequence |
| --- | --- |
| It does not learn your design patterns. | Every pattern must be written as a script or a documented rule first. |
| Skills are instructions. | An AI can skip a step. Only the runtime and CI are hard. Skill behavior has not been measured in fresh sessions. |
| A check is as good as its script. | A regex that looks for `createHandler` is satisfied by a comment containing that word. |
| Rule `scope` is trusted. | The runtime checks that scope paths exist, not that they cover what the rule claims. |
| `report` mode never blocks. | A rule left in `report` protects nothing. |
| CI does not stop a merge by itself. | Branch protection must require the check. |
| The hook is feedback. | It runs only quick checks and always exits 0. |
| `registry` checks references, not behavior. | It catches a deleted proof file and nothing about whether the proof is good. |

A passing result means the declared checks passed. It does not mean the code is correct.

## A short checklist for a new rule

1. State the invariant, its owner and the document that holds the rule.
2. Prefer removing the mistake by design. If that is not possible, write a script or test that fails on a bad case and passes on a good one.
3. Register the check in `report` mode and record the rule in `rules.json`.
4. Clear every finding. Then `activate` the batch.
5. Make sure CI runs `check` and that branch protection requires it.
6. If a mechanical check is unsuitable, record a `textReason` and accept that review is the only coverage.

See [usage scenarios](usage-scenarios.md) for commands, [getting started](getting-started.md) for the first run, and [troubleshooting](troubleshooting.md) when something looks wrong.
