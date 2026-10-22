# Additive API contract

POST /v1/tasks adds mode?, context?, duty?, inputs?: PacketRef[], codeFrom?: PacketRef, autoReport?.
PacketRef = {taskId,turn,digest}. Infer code from repo/codeFrom, otherwise conversation. Worker mode,
context and repo inherit; explicit inputs/codeFrom use dispatcher's scope. Workers cannot configure
reporting/allowedWorkers. Conversation rejects repo/baseRef/codeFrom.

POST /v1/tasks/:id/continue adds inputs?; omission retains previous inputs. Manual continuation also
consumes pending child reports. Continue in retained native session/directory. Unknown reports remain
exposed rather than being automatically replayed. Only an explicitly supplied matching input can
reserve an unknown report for a new receiving turn, after deliberate session inspection; reservation
events retain the previous state/receiving turn.

GET list/detail adds nextAction, deliveryCurrent, pendingReports; detail adds reports. Acceptance
checks current child versions; conversation does not require changes.

CLI run adds --mode conversation|code --context TEXT --duty TEXT --input ID:TURN:DIGEST (repeatable),
--code-from ID:TURN:DIGEST and --manual-results. Explicit --repo keeps code default; otherwise use
conversation. CLI enables auto-report; legacy code API defaults manual. Dispatch inherits mode/context;
may select duty/inputs/code source. Continue accepts --input. wait waits through members and pending
auto-reports, but returns pending approvals/stopped/unknown states for user action.
