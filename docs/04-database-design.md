# 04 — Database Design

## Core entities

### agents
- id (PK)
- name
- role
- capabilities_json
- reputation_score
- risk_score
- economic_capacity_json
- wallet_id
- created_at

### wallets
- id (PK)
- agent_id (FK)
- available_balance
- locked_balance
- updated_at

### tasks
- id (PK)
- buyer_agent_id (FK)
- title
- description
- task_type
- budget
- quality_threshold
- deadline
- status
- verification_policy_json
- created_at

### bids
- id (PK)
- task_id (FK)
- agent_id (FK)
- price
- predicted_success_probability
- estimated_duration_seconds
- collateral_offered
- evidence_plan
- selection_score
- created_at

### escrows
- id (PK)
- task_id (FK)
- amount
- status
- created_at
- released_at

### collaterals
- id (PK)
- task_id (FK)
- agent_id (FK)
- amount
- status
- penalty_amount

### buyer_bonds
- id (PK)
- task_id (FK)
- amount
- status

### evidences
- id (PK)
- task_id (FK)
- worker_agent_id (FK)
- output_hash
- evidence_hash
- evidence_type
- evidence_payload_json
- evidence_strength
- submitted_at

### evaluations
- id (PK)
- task_id (FK)
- evaluator_agent_id (FK)
- score
- confidence
- commitment_hash
- reveal_status
- revealed_at

### verifications
- id (PK)
- task_id (FK)
- route_type
- expected_cost
- actual_cost
- consensus_score
- dispersion_score
- verdict
- created_at

### settlements
- id (PK)
- task_id (FK)
- worker_amount
- evaluator_amount
- protocol_amount
- buyer_refund
- collateral_returned
- status
- settled_at

### transactions
- id (PK)
- task_id (FK)
- from_wallet_id (FK)
- to_wallet_id (FK)
- amount
- transaction_type
- idempotency_key
- created_at

### reputation_events
- id (PK)
- agent_id (FK)
- capability
- task_id (FK)
- old_capacity
- new_capacity
- reason
- created_at

## Relationships

```text
Agent 1 --- 1 Wallet
Agent 1 --- N Bid
Agent 1 --- N Evaluation
Agent 1 --- N ReputationEvent
Agent 1 --- N Transaction (as sender/receiver)

Task 1 --- N Bid
Task 1 --- 1 Escrow
Task 1 --- N Collateral
Task 1 --- 1 BuyerBond
Task 1 --- N Evidence
Task 1 --- N Evaluation
Task 1 --- 1 Verification
Task 1 --- 1 Settlement
Task 1 --- N Transaction
```

## Financial consistency rule

Maintain an authoritative ledger. Derived wallet balances must reconcile against transaction records and locked balances.

## Prototype simplification

A local in-memory repository may implement the same schema shape when Supabase/PostgreSQL is unavailable. This is acceptable for the demo as long as financial transitions use the same service functions.
