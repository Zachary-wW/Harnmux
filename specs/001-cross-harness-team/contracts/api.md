# Local API and CLI contract v1

Bound to 127.0.0.1 ephemeral port, Bearer authenticated, endpoint discovery file 0600. Reject browser
Origin headers, non-loopback Host values, >1 MiB bodies and unknown fields. JSON errors include
error text. Administrator is the local user; no endpoint mutates harness accounts/router/plugins.

GET /v1/tasks → task summaries (admin all, task token scoped).
POST /v1/tasks → {requestId,entry,profile,instructions,repo,baseRef?,allowedWorkers?}; admin creates
Leader. Leader-scoped callers submit {requestId,profile,instructions} and inherit repo/base and
allowed profiles; server assigns parent/worker role. Return 201 for first creation, 200 dedup, 409
conflict. Body cannot set arbitrary commands, credentials, parent role or filesystem execution cwd.
GET /v1/tasks/:id → {task,events,approvals,children}; secrets excluded.
POST /v1/tasks/:id/continue {instructions} → explicit new turn; admin/own parent Leader.
POST /v1/tasks/:id/cancel {} → cancellation request; admin/own parent Leader.
POST /v1/tasks/:id/ack {} → marks persisted notice read; admin.
POST /v1/approvals/:id {optionId} → once-only native decision; admin only, stale 409.
GET /v1/capabilities → supported/unsupported/unverified per profile and operation.
POST /v1/shutdown {} → admin-only service shutdown; cancellation requests precede closure.

CLI: harnmux start (detached/idempotent); harnmux serve (foreground); harnmux stop;
harnmux doctor; harnmux run --repo PATH --leader PROFILE --workers PROFILE,...
--entry LABEL --request-id KEY --task TEXT [--base REF]; harnmux dispatch --profile PROFILE --task
TEXT --request-id KEY (Leader env); harnmux list; harnmux status ID; harnmux result ID; harnmux
wait ID [--timeout SECONDS]; harnmux continue ID --task TEXT; harnmux cancel ID; harnmux approve
APPROVAL_ID --option OPTION_ID; harnmux ack ID. JSON stdout; warnings/errors stderr.

HARNMUX_HOME chooses bridge state only. HARNMUX_URL/HARNMUX_TOKEN child env selects scoped API;
profiles are read from HARNMUX_HOME/config.json only. URLs are loopback-only. Agent integration
must query after timeout, never repeat with a new submission ID to guess whether a task started.
