# 10 — Test Plan

## Test objectives

Verify financial correctness, workflow correctness, verification correctness, and failure recovery.

## Happy-path tests

### T01 Normal deterministic task
Expected: worker selected, escrow funded, work verified, settlement completed.

### T02 Subjective task with Blind Jury
Expected: five evaluators commit/reveal, consensus is computed, settlement follows threshold.

### T03 Successful worker capacity update
Expected: capability-specific economic capacity increases according to policy.

## Financial tests

### T04 Buyer insufficient funds
Expected: task cannot be funded.

### T05 Worker insufficient collateral
Expected: worker cannot accept.

### T06 Escrow release
Expected: exact amount transferred once.

### T07 Refund
Expected: escrow returned to buyer exactly once.

### T08 Collateral return
Expected: collateral returned only once.

### T09 Duplicate settlement
Expected: second request is a safe no-op or explicit already-settled response.

## Verification tests

### T10 Evidence hash mismatch
Expected: verification rejected.

### T11 Worker low-quality output
Expected: FAIL and penalty/refund path.

### T12 Partial quality
Expected: partial settlement according to task policy.

### T13 Evaluator disagreement
Expected: disagreement metric increases and may trigger escalation.

### T14 Evaluator timeout
Expected: non-revealing evaluator penalized and fallback/replacement path triggered.

### T15 No quorum
Expected: transaction moves to defined fallback state, never permanent lock.

## Abuse tests

### T16 Buyer defective specification
Expected: SPEC_DEFECTIVE path can compensate worker and penalize buyer bond.

### T17 False buyer dispute
Expected: dispute requires evidence/verification and buyer credibility may be reduced.

### T18 Sybil attempt
Expected: newly created agents remain low exposure.

### T19 Worker exit attempt
Expected: exposure is bounded by a minimum collateral floor and transaction cap.

## State-machine tests

For every valid transition, verify the expected next state. For every invalid transition, return `INVALID_TASK_STATE`.

## Financial invariants

1. No negative wallet balance.
2. No double settlement.
3. No money created by a UI-only action.
4. Escrow amount equals the funds actually locked.
5. Total ledger movement reconciles with wallet changes.
6. Every timeout has a terminal/fallback state.

## Demo acceptance test

The complete transaction should run from:

```text
Start Autonomous Transaction
-> Discovery
-> Competition
-> Financial Layer
-> Escrow
-> Collateral
-> Execution
-> Evidence
-> Verification
-> Clearing
-> Settlement
-> Wallet update
-> Ledger
-> Capacity update
```

without manual database edits.
