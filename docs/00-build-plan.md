# ProofFlow — 5–6 Hour Hackathon Build Plan

## Objective

Build one reliable vertical slice that demonstrates the ProofFlow thesis:

> An autonomous agent earns the right to control economic value through verifiable performance, while the financial layer determines how much value is safe to expose and when settlement is final.

Do not attempt to build the full production protocol during the hackathon.

## Core vertical slice

```text
Buyer Agent
  ↓
Task Creation
  ↓
Agent Discovery
  ↓
Competition / Bidding
  ↓
Financial Underwriting
  ↓
Wallet + Escrow + Collateral
  ↓
Worker Execution
  ↓
Proof-Carrying Output
  ↓
Adaptive Verification
  ├── Deterministic verifier for the main demo
  └── Blind Jury for the subjective/fallback demo
  ↓
Clearing
  ↓
Conditional Settlement
  ↓
Wallet + Ledger Update
  ↓
Capability-Specific Economic Capacity Update
```

## Scope rule

### Must be real

- Wallet balance changes
- Escrow lock/release/refund
- Collateral lock/return/slash
- Task lifecycle/state machine
- Bid/selection logic
- Verification result
- Clearing result
- Settlement
- Ledger entries
- Economic-capacity update

### Can be deterministic/mock

- Agent discovery network
- Candidate bids
- Simulated evaluator agents
- Risk inputs
- Seeded agent history

### AI-assisted where useful

- Task interpretation
- Capability matching explanation
- Worker result generation
- Evaluator reasoning for the Blind Jury route

The application must still work without the Gemini API by using deterministic fallback logic.

## Recommended demo tasks

### Primary: Python code bounty

Use a deterministic coding task because verification can be cheap and objective.

Example:

- Task value: ₹10,000
- Worker bid: ₹8,500
- Minimum quality: 80–90%
- Verification: hidden tests / sandbox replay
- Evidence: code hash, test output, execution trace

### Secondary: research task

Use this only to demonstrate the Adaptive Verification Router choosing the Blind Jury route.

Example:

- Task value: ₹5,000
- Minimum quality: 80%
- Evidence: sources + claim/evidence mapping
- Verification: 5 independent evaluators
- Commit → reveal → median/consensus

## Build order

### Hour 0–1: foundation

1. Create Next.js + TypeScript + Tailwind app.
2. Establish project structure.
3. Define domain types.
4. Define task state machine.
5. Create seeded agents/tasks.

### Hour 1–2: financial core

1. Wallet repository/service.
2. Escrow repository/service.
3. Collateral repository/service.
4. Atomic settlement service.
5. Idempotency protection.
6. Ledger events.

### Hour 2–3: agent economy

1. Task creation.
2. Discovery.
3. Bid generation.
4. Explainable worker selection.
5. Financial underwriting.

### Hour 3–4: execution + evidence

1. Deterministic task executor.
2. Proof/evidence package.
3. Evidence integrity/hash check.
4. Verification router.
5. Automated verifier.

### Hour 4–5: Blind Jury + clearing

1. Five evaluators.
2. Commit phase.
3. Reveal phase.
4. Consensus calculation.
5. PASS / PARTIAL / FAIL / UNCERTAIN clearing outcomes.
6. Settlement instruction generation.

### Hour 5–6: polish + failure paths

1. Wallet animations.
2. Escrow movement visualization.
3. Verification timeline.
4. Ledger view.
5. Economic-capacity update.
6. Malicious-worker scenario.
7. Timeout/fallback scenario.
8. Final demo rehearsal.

## Financial rules for MVP

Use transparent policy rules rather than pretending the MVP has a statistically calibrated production risk model.

Example inputs:

- capability reliability
- evidence strength
- calibration quality
- verification difficulty
- task value
- collateral

Example outputs:

- safe exposure
- worker collateral requirement
- buyer specification bond
- verification route
- settlement terms

Use a fixed minimum collateral floor. High reputation may reduce friction, but never reduce collateral to zero.

## Verification rules

The router should prefer the cheapest sufficiently reliable path:

```text
if deterministic verifier exists:
    use deterministic verifier
elif reliable reference/gold data exists:
    use reference verifier
else:
    use Blind Jury
```

Also reject or reprice tasks when verification cost is economically irrational for the task value.

## Blind Jury MVP

Use exactly 5 evaluators.

- independent evaluation
- commit
- reveal
- median score
- disagreement measurement
- timeout handling

Do not automatically mark every minority evaluator as malicious. High disagreement should produce `UNCERTAIN` and a fallback/escalation path.

## Settlement rules

Example policy:

- quality >= 90% → full worker reward
- 60–89% → proportional/partial settlement
- quality < 60% → failed settlement + refund + penalty policy

Settlement must be idempotent.

## Required failure scenarios

1. Buyer has insufficient funds.
2. Worker has insufficient collateral.
3. Worker misses deadline.
4. Worker submits invalid/low-quality work.
5. Evidence hash mismatch.
6. Evaluator does not reveal.
7. Jury disagreement is too high.
8. Verification path unavailable.
9. Buyer raises an invalid/abusive dispute.
10. Settlement endpoint is called twice.
11. Task expires.
12. Verification cost exceeds task-value policy.

## Definition of done

A single click should run the happy-path transaction from task creation to settlement.

The final screen must show:

- task
- selected worker
- financial assessment
- escrow
- collateral
- verification evidence/result
- clearing decision
- worker payment
- buyer balance change
- evaluator rewards
- ledger transaction
- capability-specific economic capacity update

A second control should run a failure scenario and show the financial consequences.

## Final demo narrative

```text
Agents can transact.
But transactions need economic trust.
ProofFlow prices that trust.
The worker provides evidence.
The protocol chooses how to verify it.
Capital is released only when the obligation clears.
The result changes the agent's future economic capacity.
```
