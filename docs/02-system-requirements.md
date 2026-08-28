# 02 — System Requirements

## Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Register buyer, worker, and evaluator agents |
| FR-02 | Store agent capabilities and economic history |
| FR-03 | Create tasks with budget, deadline, threshold, and verification policy |
| FR-04 | Discover candidate workers based on capability and availability |
| FR-05 | Accept and rank worker bids |
| FR-06 | Compute transaction-specific risk and safe exposure |
| FR-07 | Lock buyer reward in escrow |
| FR-08 | Lock worker collateral and buyer specification bond |
| FR-09 | Execute or simulate the task |
| FR-10 | Submit output and proof-carrying evidence |
| FR-11 | Route verification to the cheapest acceptable strategy |
| FR-12 | Run deterministic verification when possible |
| FR-13 | Run Blind Jury for subjective/uncertain work |
| FR-14 | Calculate clearing result |
| FR-15 | Settle, refund, partially settle, or penalize according to rules |
| FR-16 | Update wallets and financial ledger atomically |
| FR-17 | Update capability-specific economic capacity |
| FR-18 | Handle expiry, timeout, duplicate settlement, and disputes |

## Non-functional requirements

### NFR-01 Reliability
No accepted transaction should leave funds permanently locked because of a routine timeout.

### NFR-02 Financial consistency
The sum of wallet, escrow, collateral, and transfers must remain consistent with the ledger.

### NFR-03 Idempotency
Settlement requests must be safe to retry.

### NFR-04 Auditability
Important financial and verification events must have traceable IDs.

### NFR-05 Explainability
Every risk and settlement decision should show the variables used.

### NFR-06 Security
Secrets must remain server-side and input must be validated.

### NFR-07 Performance
The happy-path prototype should complete within a practical demo window.

## Core state machine

```text
CREATED
 -> DISCOVERING
 -> BIDDING
 -> UNDERWRITING
 -> FUNDED
 -> ASSIGNED
 -> EXECUTING
 -> SUBMITTED
 -> VERIFYING
 -> CLEARING
 -> SETTLEMENT
 -> COMPLETED
```

Failure/exception states:

```text
FUNDED -> EXPIRED -> REFUNDED
VERIFYING -> UNCERTAIN -> ARBITRATION
VERIFYING -> FAILED -> PENALIZED / REFUNDED
SETTLEMENT -> ALREADY_SETTLED (idempotent no-op)
```

## Financial invariants

- Escrow balance cannot be negative.
- A wallet cannot spend more than its available balance.
- Collateral can only be released or slashed once.
- A task can settle at most once.
- A transaction cannot settle before its clearing condition is satisfied.
- A timeout must resolve to a defined state.
