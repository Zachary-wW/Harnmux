# Additive task contract

Create input adds acceptanceCriteria?: string[] (max 20, each 1–2000 chars); continuation accepts
optional acceptanceCriteria to deliberately revise the contract for a new turn. Old packets stay unchanged.
GET /v1/tasks/:id/packet?turn=N returns {digest, packet, reviews}; default current turn; same read scope as task.
POST /v1/tasks/:id/review {turn, digest, decision, note}. decision: accept/request_changes/recommend_accept.
Admin: accept/request_changes. Task Leader: recommend_accept/request_changes for own children only.
All decisions require inactive current terminal turn and matching digest. Acceptance/recommendation additionally
require completed execution, complete captured diff and completed/sealed member references. request_changes
is permitted for failed/incomplete terminal packets. 409 on stale,
missing or incomplete packet; 403 on wrong role. Preserve receipts; no code execution or merge.
CLI: harnmux run/dispatch [--criterion TEXT ...]; continue ID [--criterion TEXT ...]; packet ID [--turn N];
review ID --turn N --digest HASH --decision DECISION --note TEXT. Task state also exposes deliveryDigest,
leaderReview and acceptance. These are not substitutes for native command approval or unread acknowledgment.
