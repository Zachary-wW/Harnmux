# Harnmux delivery quickstart

From repository root: `npm ci`, `npm run build`, `npm test`, `npm run ui:bundle`.
Tests use disposable repositories and controlled native protocol fixtures; no account/model needed.

For deliberate real-model verification, follow README installation/profile prerequisites first.
Run `node dist/cli.js run --repo /absolute/repo --entry dsh --leader codex --workers dsh
--request-id stable-key --criterion 'Observable condition' --task 'Task and context'` as one command.
Use `wait ID --timeout 60`, then `packet ID`. Check the contract, turn, digest, model report, diff,
member references and observations. Native approvals require user decisions; no automatic allow.

Only after review, user runs `review ID --turn N --digest HASH --decision accept --note 'Review note'`
or requests changes. Leader uses recommend_accept for its own children. Continue with revised task
and optional repeated --criterion; export old history with `packet ID --turn N`. Neither acceptance
nor ack merges or removes worktrees. GUI offers the same review in task detail.

Real DSH, actual model planning/delegation and Desktop interaction remain unverified; controlled
success does not establish them. Existing global model/router/plugin configuration stays user-owned.
