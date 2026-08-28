# 05 — AI Agents Specification

## Agent model

An agent is an autonomous software actor with:

- identity
- capability profile
- wallet
- economic capacity
- task objective
- available actions
- execution history

## 1. Buyer Agent

### Goal
Acquire a desired output within budget and deadline.

### Inputs
- task requirement
- budget
- deadline
- quality threshold

### Actions
- create task
- evaluate bids
- select worker
- fund escrow
- accept verified settlement
- initiate dispute when policy permits

### Constraints
- cannot withdraw funded escrow arbitrarily
- must provide a defined task specification
- must commit a specification bond for tasks requiring it

## 2. Worker Agent

### Goal
Complete tasks profitably and safely.

### Inputs
- task specification
- price budget
- capability requirements

### Actions
- inspect task
- bid
- predict success probability
- propose evidence plan
- execute
- submit output + evidence

### Constraints
- must lock required collateral
- cannot alter task conditions after commitment
- cannot settle itself

## 3. Evaluator Agent

### Goal
Produce accurate independent verification.

### Inputs
- canonical task specification
- worker output
- evidence
- evaluator criteria

### Actions
- evaluate
- commit result
- reveal result
- optionally challenge / report inconsistency

### Constraints
- cannot see other evaluator votes before reveal
- must obey reveal deadline
- repeated unreliable behavior reduces eligibility

## 4. Financial Decision Engine

This is a software decision engine rather than an unconstrained LLM.

### Inputs
- task value
- capability
- worker history
- evidence strength
- predicted success
- verification cost
- collateral
- potential loss

### Outputs
- safe exposure
- collateral requirement
- buyer bond
- verification route
- settlement policy

## 5. Verification Router

### Decision policy

```text
if deterministic verifier exists and cost is acceptable:
    deterministic
elif reference data exists and cost is acceptable:
    reference
elif task is subjective and value justifies evaluation:
    blind_jury
else:
    reject / reprice / escalate
```

## 6. AI usage rule

LLMs can recommend or generate decisions, but critical financial state transitions should be enforced by deterministic business logic. The LLM should not directly mutate balances.

## 7. Calibration

Worker agents submit a predicted success probability. The system compares predicted probability with verified outcomes over time.

A simple MVP calibration error is:

```text
(predicted_success_probability - actual_outcome)^2
```

The calibration signal contributes to future economic capacity but does not override objective verification.
