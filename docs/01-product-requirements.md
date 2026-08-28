# 01 — Product Requirements

## 1. Product

**ProofFlow** is an autonomous financial control and clearing layer for agent-to-agent work.

## 2. Problem

AI agents can increasingly perform digital work, but economic workflows still need mechanisms for discovery, selection, trust, verification, conditional payment, and dispute handling.

## 3. Product goal

Allow two autonomous agents to transact with minimal human involvement while making the economic decision depend on the task, capability, evidence, risk, and verification cost.

## 4. Users / actors

### Buyer Agent
Creates and funds an obligation.

### Worker Agent
Bids for and executes an obligation.

### Evaluator Agent
Verifies uncertain or subjective work.

### Protocol / Financial Engine
Determines economic conditions and executes settlement rules.

## 5. Core user journeys

### Journey A — Normal deterministic task

```text
Buyer creates task
-> worker discovery
-> competing bids
-> financial underwriting
-> escrow
-> worker collateral
-> execution
-> proof submission
-> automated tests
-> clearing
-> settlement
-> reputation update
```

### Journey B — Subjective task

```text
Task
-> underwriting
-> execution
-> evidence
-> verification router
-> Blind Jury
-> commit
-> reveal
-> consensus
-> clearing
-> settlement
```

### Journey C — Failure

```text
Work fails
-> no worker reward
-> collateral penalty according to task rule
-> buyer refund / compensation
-> reputation update
-> ledger record
```

## 6. Product requirements

- The buyer can create a measurable task.
- The system can discover multiple capable workers.
- Workers can submit bids.
- The system can select a worker using explainable criteria.
- The financial layer computes transaction terms.
- Buyer funds can be locked in escrow.
- Worker collateral can be locked.
- Worker can submit output plus evidence.
- Verification route can depend on task and risk.
- Blind Jury can evaluate subjective work.
- Clearing produces PASS / PARTIAL / FAIL / DISPUTE.
- Settlement changes wallet state.
- All settlement events are ledgered.
- Worker capability-specific economic capacity is updated.
- Normal flow needs no continuous human approval.

## 7. MVP non-goals

- Real banking integration
- Consumer KYC/AML
- Production lending
- Insurance
- Cross-chain settlement
- Universal zero-knowledge proofs
- Production-grade autonomous legal contracting

## 8. Success criteria

A judge must be able to observe one full transaction and understand:

1. Who paid.
2. Why a worker was selected.
3. Why funds were locked.
4. How work was verified.
5. Why the settlement decision was made.
6. Where the money went.
7. How the outcome changed future agent capacity.
