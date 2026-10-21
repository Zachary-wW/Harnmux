# Data model

Task: UUID id, unique requestId (1–128 chars), canonical request payload/hash, role leader|worker,
entry label, parentId, instructions (1–64000 chars), native profile, allowed Worker profiles,
source repository, resolved base commit, branch/worktree, native session ID, requested/actual model,
state, created/updated times, result/error/diff summary, unread completion, continuation generation.

States: preparing→running↔waiting_approval→completed|failed|cancelled|interrupted;
running/waiting→cancelling→cancelled or interrupted. Completed is execution success, not acceptance.
Continuation from terminal state requires an existing native session and adds a new turn.
Preparing without a native session cannot be continued; resubmit deliberately with a new request ID.

Approval: UUID id, taskId, native request method/ID reference, details <=256 KiB,
options IDs/labels, pending|answered|expired, selected option, timestamps. Live resolver exists only
in adapter memory; service interruption expires pending approvals and never replays a decision.

Event: monotonic global sequence, taskId, kind, JSON payload <=256 KiB, timestamp. Keep newest
1000 events per task. Text/result retention is bounded and reports truncation.

Profile: name (1–64), harness codex|dsh, optional model, optional executable/args and DSH profile.
Local administrative config may specify executable arrays; remote task submissions select only
configured profile names. Default codex and dsh profiles refer to existing native installation.

Authentication: service administrator token stored 0600; task-role tokens are random ephemeral
in-memory capabilities supplied only via child env. A Leader can read itself/children, dispatch
configured allowed Workers and continue its own children; a Worker can read its own state only.
Restart invalidates all task tokens. Owner/admin can manage all tasks and decide approvals.
