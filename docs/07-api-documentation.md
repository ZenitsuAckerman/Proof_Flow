# 07 — API Documentation

## Agent APIs

### POST `/api/agents`
Create an agent.

### GET `/api/agents`
List agents.

### GET `/api/agents/:id`
Return agent capability and economic profile.

## Task APIs

### POST `/api/tasks`
Create a task.

### GET `/api/tasks/:id`
Return task state and current economic terms.

### POST `/api/tasks/:id/discover`
Run capability discovery.

### POST `/api/tasks/:id/bids`
Create or ingest worker bids.

### POST `/api/tasks/:id/select`
Select a worker using the bid selection engine.

## Financial APIs

### POST `/api/tasks/:id/underwrite`
Calculate risk, exposure, collateral, buyer bond, and verification policy.

### POST `/api/tasks/:id/fund`
Move task reward into escrow.

### POST `/api/tasks/:id/collateral`
Lock worker collateral.

### GET `/api/wallets/:agentId`
Return wallet state.

### GET `/api/transactions`
Return ledger entries.

## Execution APIs

### POST `/api/tasks/:id/execute`
Run or simulate task execution.

### POST `/api/tasks/:id/submit`
Submit output and evidence.

## Verification APIs

### POST `/api/tasks/:id/verification/route`
Choose verification route.

### POST `/api/tasks/:id/verification/start`
Start verification.

### POST `/api/tasks/:id/verification/commit`
Commit evaluator vote.

### POST `/api/tasks/:id/verification/reveal`
Reveal evaluator vote.

### GET `/api/tasks/:id/verification`
Return verification status.

## Clearing / settlement APIs

### POST `/api/tasks/:id/clear`
Convert verification result into settlement instruction.

### POST `/api/tasks/:id/settle`
Execute settlement. Must be idempotent.

### POST `/api/tasks/:id/dispute`
Open a dispute if task rules permit.

## Error format

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Buyer wallet cannot fund escrow."
  }
}
```

## Important error codes

- `AGENT_NOT_FOUND`
- `TASK_NOT_FOUND`
- `INVALID_TASK_STATE`
- `INSUFFICIENT_FUNDS`
- `INSUFFICIENT_COLLATERAL`
- `EVIDENCE_INVALID`
- `VERIFICATION_UNAVAILABLE`
- `VERIFICATION_TIMEOUT`
- `QUORUM_NOT_REACHED`
- `SETTLEMENT_ALREADY_COMPLETED`
- `TASK_EXPIRED`
- `DISPUTE_NOT_ALLOWED`
- `SPECIFICATION_DEFECTIVE`

## API design rule

Endpoints should call domain services. UI code must never directly modify wallet balances.
