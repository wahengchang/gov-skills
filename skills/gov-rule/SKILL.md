---
name: gov-rule
description: Turn a demonstrated recurring engineering failure or invariant into the strongest suitable existing executable protection, with a failing counterexample and rule ownership. Use to add, revise or retire a governance rule. For repo-wide mapping use gov-audit, for runtime install or update use gov-setup.
---

# Place a rule where it can be enforced

## Orient

If `.governance/runtime/cli.mjs` exists, `node .governance/runtime/cli.mjs status --root <repo> --json` shows which checks are registered and their modes, so you can reuse one before adding another. `invalid-contract` must be repaired before registering a rule.

Start from the demonstrated failure, intended invariant, owner and affected consumers. Inspect existing authorities and protection. Prefer eliminating the invalid state through architecture or types, then existing lint/architecture checks, tests or CI. Hooks are optional feedback. Use text only when mechanical enforcement is unsuitable, with a specific reason. Reuse or improve an existing check before adding a second one.

Within the authorized governance scope, implement the protection and prove it using an isolated counterexample: the bad case must fail for the intended reason, and the valid/fixed case must pass. Do not inject faults into the user's live worktree. Record actual cwd/revision, argv, exits and relevant output; a proof path existing or an old green run does not demonstrate effectiveness. If proving or fixing the rule requires product behavior changes/refactoring beyond scope, report that dependency and complete independent governance work.

If `.governance/rules.json` is adopted, maintain one entry per invariant:

```json
{
  "id": "public-contract",
  "owner": "api-team",
  "scope": ["src/api"],
  "source": ["docs/api.md"],
  "proof": ["tests/api-contract.test.mjs"],
  "enforcement": { "check": "contract-tests" }
}
```

`scope`, `source` and `proof` are real repo-relative paths, no globs. The check must already be registered in `.governance/config.json`. For semantic rules use `"enforcement": { "textReason": "why mechanical enforcement is unsuitable" }`; proof may be empty in that case. Do not duplicate the full business spec in the registry. Keep durable test/config references here and one-off execution logs outside committed rules. The registry checker only validates references.

If the toolkit is absent, use the repo's native tests/docs and explain that registry/checker integration was not performed; do not silently bootstrap it. For exact config syntax use the installed gov-setup runtime reference when available, or the project's adopted config/docs. New adopted checks start report. After a selected batch is fully verified and clean, use `node .governance/runtime/cli.mjs activate --root <repo> --checks id,id`; failure must leave the batch unchanged. No baseline or weakened gate.

When retiring a rule, show the invariant is obsolete or covered by stronger protection, prove remaining regression coverage, update references, and preserve the original intent where still applicable. Age or one successful test is insufficient evidence to delete protection.

Deliver the invariant/owner, enforcement choice and reused protection, counterexample/fixed evidence, durable references, modes and outstanding limitations.
