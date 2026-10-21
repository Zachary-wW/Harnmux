# Validation quickstart

1. npm ci && npm run build && npm test.
2. npm run ui:build; npm run ui:bundle produces dist/Harness Bridge.app.
3. Start node dist/cli.js serve. In a separate terminal run node dist/cli.js doctor.
4. Install/authenticate Codex and DSH independently; confirm doctor paths and limits. No account
or plugin config is changed by this project. Choose supported native model IDs in bridge profiles.
5. In a committed disposable repository, run hbridge run with --entry dsh --leader codex
--workers dsh and --task describing a tiny isolated change. This step may consume model quota;
run deliberately. Observe a Leader native session, scoped dispatch, new DSH worktree and result.
6. Approve/reject native requests from the menu bar or hbridge approve; inspect result/diff.
7. Close the menu panel: task should continue. Cancel a running child and verify confirmation.
8. Restart service: saved results remain; active tasks become interrupted, stale approvals expire,
no task replays automatically. Native session continuation is explicit and adapter-dependent.

Native Desktop wakeup is not included. The shared Skill teaches the current harness to query/wait
and display saved results. Tests with fake executables do not certify real model/Desktop behavior.
