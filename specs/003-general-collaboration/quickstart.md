# Quickstart

Build once with `npm ci && npm run build`. Start `node dist/cli.js start`. Configure native harness
executable/model profiles as in README; this does not install accounts or route models.
The following run/continue commands start native model tasks and can consume quota.

## Everyday conversation

```sh
node dist/cli.js run --entry dsh --leader codex --workers dsh \
  --request-id discussion-001 --context 'Prefer concrete comparisons with tradeoffs.' \
  --task 'Discuss two approaches; ask DSH for a second opinion if useful and synthesize.'
node dist/cli.js wait TASK_ID --timeout 60
node dist/cli.js continue TASK_ID --task 'Explain the main disagreement in simpler language.'
```

No repo/Git required. Private directories remain under HARNMUX_HOME/conversations. Use the menu-bar
“发起协作” form for the same API. Conversation acceptance is optional and requires text, not a diff.

## Exact answer / code handoff

Read `packet SOURCE_ID` and use the returned turn/digest:

```sh
node dist/cli.js run --leader dsh --request-id followup-001 \
  --input SOURCE_ID:1:SHA256_FROM_PACKET --task 'Build on this prior answer.'
```

For code, add `--repo /absolute/project`. A managed code Leader can `dispatch --profile dsh ...
--code-from SOURCE_ID:1:SHA256_FROM_PACKET`; the source must be in scope, successful, complete and
in the same repository. This references the sealed tree, not a mutable directory. Code changes stay
in retained worktrees, never auto-merge. Explicit `--base` and `--code-from` are alternatives.

## Result-report recovery

CLI/menu-bar runs enable auto-report. `--manual-results` disables it. A native Leader's active
packet read consumes a pending report. A receipt means native activity, not correctness.
`status` exposes pending/starting/delivered/observed/unknown and nextAction. Unknown does not retry.
After inspecting the session, explicitly `continue TASK_ID --input CHILD_ID:TURN:DIGEST --task TEXT`
can select an unknown report for a new receiving turn. No unspecified unknown report is replayed.
Cancelling even a completed Leader disables auto-report and requests its active members stop.

## Controlled verification (no model quota)

```sh
npm run check
npm run build
npm test
npm run ui:build
npm run ui:bundle
```

Current verification separates fixtures, earlier native handshake and unperformed real-model/UI runs.
