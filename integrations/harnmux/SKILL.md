---
name: harnmux
description: Delegate project work to native Codex or DSH sessions, choose a Leader independently of the current harness, inspect results, and continue or cancel Harnmux tasks.
---

# Harnmux

Use `harnmux` for native harness delegation. Select entry, Leader and allowed Worker profiles
separately. Model routing stays in the chosen harness. Profiles belong to Harnmux's private
config; preserve existing harness/router/plugin settings.

## Entry workflow

1. Run `harnmux doctor`. If Harnmux is not started, run `harnmux start`. Missing harness executables
must be installed/configured by the user; never silently choose another harness or disable approval.
2. Translate the user's task into explicit instructions and acceptance criteria. Select the
requested Leader and Workers. Resolve the repository and baseline; workers see committed ref
contents, not unsaved/dirty files. Include necessary context in the task text.
3. Create exactly one run using a stable submission key:
   `harnmux run --entry dsh --leader codex --workers dsh --repo /absolute/repository --request-id stable-key --criterion 'Observable acceptance condition' --task 'Task and context'`.
   For the opposite assignment choose `--entry codex --leader dsh --workers codex`.
4. Save the returned task ID. Use `harnmux wait ID --timeout 60`, `harnmux status ID` and
`harnmux result ID`. A wait timeout is not task failure. Query the same ID; do not blindly submit
another task. A repeated identical submission key returns the existing task.
5. If approval is pending, tell the user to inspect and decide in the menu-bar app or via
`harnmux approve APPROVAL_ID --option NATIVE_OPTION_ID`. Agent callers must not approve for the
user. Summarize relevant details, exact native scope and missing information without inventing it.
6. Read `harnmux packet ID` after execution. Check the exact turn, digest, criteria, captured diff and member references. Model reports and native observations are distinct; neither automatically proves tests passed. Only the user may accept via the panel or `harnmux review ID --turn N --digest HASH --decision accept --note TEXT`. Entry agents must report the pending user decision rather than accept on their behalf. `ack` only means read.
7. Attribute the delivered plan/review to the selected Leader. Report worktree paths, actual
validation and unresolved work. Execution completion is not user acceptance or merge.
8. Further user instructions use `harnmux continue ID --task 'Additional requirements'`; explicit
cancellation uses `harnmux cancel ID`. No automatic merge or worktree removal.

## Leader workflow

The Harnmux prompt names allowed Worker profiles and provides the CLI path. Use inherited scoped
environment credentials. Never print, inspect, copy or persist authentication environment values.

- Plan, then `harnmux dispatch --profile dsh --request-id stable-child-key --task 'Concrete task, context and acceptance criteria'`.
- Workers start from the recorded baseline in separate directories. Explain needed context;
do not assume changes from the Leader worktree are already present in a Worker.
- Wait/query by returned ID. Review result, actual command outputs and retained diff. Additional
work uses `harnmux continue CHILD_ID --task 'Corrections'`.
- Read `harnmux packet CHILD_ID` and bind your recommendation to its turn/digest with `harnmux review CHILD_ID --turn N --digest HASH --decision recommend_accept --note TEXT` (or `request_changes`). Your recommendation does not mark user acceptance. Failed/incomplete packets may receive change requests but cannot receive acceptance recommendations.
- Query reports expose child worktrees; read them for review. Do not merge without user instruction.
- If no Worker is available, report why. Workers cannot recursively dispatch more members.

## Limits

Harnmux does not attach to the existing Desktop session tree or automatically wake the entry
conversation. Results persist; use wait/status/result to retrieve them. Native plugins remain
owned by DSH; no plugin migration is performed. Process/API role scoping is not an OS sandbox.
