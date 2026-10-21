# Reviewable delivery data model

Task adds optional acceptanceCriteria, deliveryDigest, leaderReview and acceptance. Existing rows
remain readable. Turn increments on continuation; current pointers clear while historical rows remain.

`packets(task_id, turn, digest, data)`: composite primary key, insert only through the service. Data
is the sealed JSON representation; digest is SHA-256 of exactly that representation. It contains
contract, provenance, execution/model report, captured changes, member turn/digest references,
bounded native observations and approvals. Packet storage and current digest update are atomic.

`reviews(id, task_id, turn, data)`: append-only receipts containing decision, note, actor, reviewer
identity, timestamp and packet digest. Receipt insert and latest summary update are atomic. Reviews
are exported alongside packets; later reviews do not mutate sealed JSON or its digest.

Execution state remains independent of review. Leader may recommend/request changes for own child;
user may accept/request changes. Ack changes unread only. All reviews require current inactive
terminal turn and digest. Acceptance/recommendation also requires success, complete captured changes
and completed/sealed member references. A decision never modifies source, merges or runs commands.

The digest is a local snapshot reference, not tamper-proof storage, a signature, a claim about later
worktree content or proof of correct model/test assertions. Existing event retention remains bounded;
sealed packets retain their copied events independently, with absence/truncation explicit.
