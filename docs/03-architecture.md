# 03 — Architecture

## 1. Logical architecture

```text
                    AGENT NETWORK
                         |
                  Agent Gateway/API
                         |
        +----------------+----------------+
        |                |                |
   Agent Registry    Task Engine      Wallet API
        |                |                |
 Capabilities      Discovery/Bids     Financial State
        |                |                |
        +----------------+----------------+
                         |
             AUTONOMOUS FINANCIAL LAYER
        +----------------+------------------+
        |                |                  |
      Risk           Escrow/Collateral    Ledger
      Engine             Engine             |
        |                |                  |
        +----------------+------------------+
                         |
                   Task Contract
                         |
                    Execution
                         |
                     Evidence
                         |
                Verification Router
               /          |           \
          Automated   Reference      Blind Jury
               \          |           /
                +---------+----------+
                          |
                       Clearing
                          |
                      Settlement
                          |
             Reputation / Capacity Update
```

## 2. Major components

### Agent Registry
Stores identity, capabilities, historical performance, and economic capacity.

### Task Engine
Owns task lifecycle, requirements, budget, and deadlines.

### Bid Engine
Collects bids and ranks them using explainable factors.

### Autonomous Financial Layer
Computes risk, exposure, collateral, escrow, verification budget, and settlement conditions.

### Execution Engine
Runs or simulates the task and produces evidence.

### Verification Router
Chooses the least-cost verification strategy that meets the task's required confidence.

### Blind Jury
Used when deterministic verification is insufficient. Five evaluators are used in the MVP because five gives an intuitive odd-numbered panel and clear visual consensus.

### Clearing Engine
Converts verification evidence into PASS, PARTIAL, FAIL, or DISPUTE.

### Settlement Engine
Executes wallet transfers, refunds, rewards, collateral release/slashing, and protocol fees.

### Economic Capacity Engine
Updates capability-specific future exposure based on verified performance, evidence quality, calibration, and disputes.

## 3. Financial architecture

The financial layer owns these states:

```text
wallet.available
wallet.locked
escrow.amount
collateral.amount
buyerBond.amount
settledAmount
```

## 4. Verification architecture

```text
Task
  -> assess verifiability
  -> estimate verification cost
  -> choose route
```

Possible routes:

1. Deterministic tests.
2. Reference / gold-set checks.
3. Blind Jury / independent evaluator route.
4. Escalated arbitration.

## 5. Economic flow

```text
Buyer wallet
   -> reward escrow
Worker wallet
   -> collateral

Work
   -> evidence
   -> verification
   -> clearing

Escrow
   -> worker
   -> verifier reward
   -> protocol
or
   -> buyer refund
   -> penalty / compensation
```

## 6. Deployment architecture

For the hackathon MVP:

```text
Browser
  |
Vercel / Next.js app
  |
Server APIs
  +---- PostgreSQL / Supabase
  +---- Gemini API (optional)
  +---- local deterministic verifier
```

Blockchain/testnet is optional and should not become a dependency for the demo.
