# Validation status

Local candidate, 2026-10-28; Node v22.22.0, Python 3.14.4, skills CLI 1.7.4, Codex CLI 0.159.3. Validation of the original research archives is not product evidence.

| Layer | Evidence / status |
| --- | --- |
| Runtime and lifecycle | `npm test`: 28 passing tests in isolated fixtures cover config/rule errors, link/size findings, report/enforce, atomic activation, real command exits/cwd/argv/timeout, conflict protection, update/uninstall and rollback; `status` routing states, no registered command execution; quiet and path-filtered hook output. |
| Different target tools | Copied setup skill deploys to Node and Python fixtures, then report → activate → check → update/uninstall. |
| Workflow mechanics | Isolated counterexample fails and corrected case passes; doc/tool drift repair retains product regression and modes; repeated check is read-only. These are mechanical fixtures, not model behavior claims. |
| Skill structure | `npm run validate`: six entrypoints, frontmatter, status orientation and neighbouring-skill references in each skill, implicit-invocation policy, local Markdown links and JavaScript syntax. `agents/openai.yaml` keys are not checked against a real Codex host. |
| Actual skills CLI install | Verified with skills CLI 1.7.4: six entrypoints, copy and default installs, plus setup-only install in three temporary projects. Candidate removed before setup/report/activate/check. Reproduce with `node scripts/test-install.mjs`. |
| Optional hooks | Lifecycle and mock PostToolUse payloads tested, including violations, malformed config and child timeout. Missing-node launch failure also verified. Real host trust and edit-trigger acceptance remain unverified. |
| Fresh Codex skill behavior | Four actual fresh sessions on CLI 0.159.3: audit/setup preserves product work and leaves blocked adoption report; approved doc/rule change regenerates from source and proves isolated counterexamples; maintenance repairs governance while retaining enforce gates and product regression; read-only check rejects stale pass evidence and missing required tools. Fixture content assertions confirm outcomes. These sessions ran against 0.1.0 skill text; the 0.2.0 Orient sections, descriptions and `agents/openai.yaml` have not been exercised in fresh Codex sessions. |
| GitHub install / CI gate | Not covered by the local acceptance run. Publishing this commit does not itself verify remote installation, workflow execution or a required gate. |
| Independent review | Not performed. |

Known bounds: built-in Markdown parsing covers a documented subset, not a site framework; native commands are reviewed trusted entrypoints, not sandboxed; installation requires no concurrent edits and cannot guarantee rollback after process death/disk failure. No platform matrix or chosen license is claimed.
