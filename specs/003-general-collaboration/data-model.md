# Data model

Task additions: mode conversation|code (legacy repo implies code), goal/context/duty, input deliveries,
optional codeFrom, autoReport, conversation directory, resultTruncated. repo/baseRef optional only for
conversation. Profile and role authorization unchanged.

Input delivery: taskId/turn/digest plus copied exact packet report/state/provenance. Combined context
is bounded. Code delivery adds snapshotRef reachable through a Harnmux-owned Git ref.

Result report: unique childId+childTurn; parentId/digest/state, receiving Leader turn, optional reason.
starting is a reservation; delivered requires native activity or execution completion. Restart turns
starting into unknown. Unknown can be reassigned only by explicit continue input; reservation
events preserve its prior state and receiving turn. Next-action/freshness derived; historical packets and receipts immutable.
