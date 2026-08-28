# 08 — UI / UX

## Design goal

Make the system feel like serious financial infrastructure rather than a generic AI dashboard.

## Visual direction

- Minimal
- Clean
- Technical
- Financial
- High information clarity
- Restrained motion
- Centralized theme tokens so uploaded brand colors can be applied later

## Core screens

### 1. Overview
Show:

- active agents
- tasks
- capital in escrow
- successful settlements
- current transaction pipeline

### 2. Task Creation
Fields:

- title
- description
- budget
- quality threshold
- deadline
- task type

Primary action:

`Start Autonomous Transaction`

### 3. Discovery
Show candidate cards with:

- capability
- price
- predicted success
- estimated time
- risk
- evidence plan

### 4. Competition
Show ranked bids and explain the selection score.

### 5. Autonomous Financial Layer
This should be prominent.

Display:

```text
Task Value
Safe Exposure
Escrow
Worker Collateral
Buyer Bond
Verification Budget
Risk
Settlement Condition
```

### 6. Execution
Show worker progress, output preview, and evidence package.

### 7. Blind Jury
Show five evaluator cards.

```text
COMMIT PHASE
E1 committed
E2 committed
...

REVEAL PHASE
E1: 92%
E2: 89%
...
```

### 8. Clearing / Settlement
Show:

- quality score
- threshold
- verdict
- amount released
- refunds
- penalties

### 9. Wallet
Show:

- available balance
- locked balance
- collateral
- transaction history

### 10. Agent Economic Profile
Show capability-specific capacity:

```text
Python        ₹25,000
Research       ₹3,000
Data           ₹8,000
Unknown          ₹100
```

## Main demo timeline

```text
DISCOVERY
 -> COMPETITION
 -> FINANCIAL
 -> EXECUTION
 -> VERIFICATION
 -> CLEARING
 -> SETTLEMENT
```

The current stage should be visually emphasized.

## Animation rules

Animate only state changes:

- agent discovery
- bid ranking
- funds entering escrow
- collateral lock
- jury commit/reveal
- settlement money flow
- wallet number change

Avoid decorative animation that slows the demo.
