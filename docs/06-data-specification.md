# 06 — Data Specification

## Task object

```json
{
  "taskId": "TASK-1028",
  "title": "Fix payment calculation bug",
  "description": "Fix the identified calculation error.",
  "taskType": "code",
  "budget": 10000,
  "qualityThreshold": 90,
  "deadlineSeconds": 180,
  "verificationPolicy": {
    "preferred": "deterministic",
    "allowJuryFallback": true
  }
}
```

## Bid object

```json
{
  "taskId": "TASK-1028",
  "agentId": "AGENT-B",
  "price": 8500,
  "predictedSuccessProbability": 0.88,
  "estimatedDurationSeconds": 150,
  "collateralOffered": 1500,
  "evidencePlan": ["hidden-tests", "sandbox-replay", "artifact-hash"]
}
```

## Evidence object

```json
{
  "taskId": "TASK-1028",
  "workerAgentId": "AGENT-B",
  "outputHash": "sha256:...",
  "evidenceHash": "sha256:...",
  "evidenceType": "reproducible-test-report",
  "evidenceStrength": 0.94,
  "payload": {
    "passedTests": 98,
    "totalTests": 100,
    "sandboxReplay": true
  }
}
```

## Evaluation object

```json
{
  "taskId": "TASK-1028",
  "evaluatorAgentId": "EVAL-1",
  "score": 92,
  "confidence": 0.94,
  "commitmentHash": "sha256:...",
  "revealStatus": "REVEALED"
}
```

## Verification result

```json
{
  "taskId": "TASK-1028",
  "route": "deterministic",
  "consensusScore": 98,
  "dispersion": 0,
  "verdict": "PASS"
}
```

## Settlement instruction

```json
{
  "taskId": "TASK-1028",
  "verdict": "PASS",
  "workerAmount": 8500,
  "evaluatorAmount": 500,
  "protocolAmount": 500,
  "buyerRefund": 500,
  "collateralReturn": 1500
}
```

## Data integrity

- Every task has one canonical ID.
- Evidence is tied to a task and worker.
- Settlement has an idempotency key.
- Hashes are used for artifact/evidence integrity where appropriate.
- Financial amounts use fixed-precision decimal representation or integer minor units in production.
