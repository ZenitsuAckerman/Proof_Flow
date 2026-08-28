# 09 — Security

## Threat model

Assume the buyer, worker, and evaluator can all behave dishonestly or fail.

## 1. Financial attacks

### Double settlement
Mitigation: idempotency keys and terminal settlement state.

### Negative balances
Mitigation: atomic balance checks before debit.

### Escrow theft
Mitigation: only the settlement service can release escrow.

### Collateral double release
Mitigation: collateral status transition is atomic.

## 2. Buyer abuse

Threat: buyer submits impossible or vague task and tries to get free work.

Mitigation:

- specification bond
- committed acceptance conditions
- independent verification
- dispute classification for defective specification

## 3. Worker abuse

Threat: worker submits low-quality/fraudulent output.

Mitigation:

- evidence package
- verification
- collateral
- capability-specific history
- exposure limits

## 4. Evaluator abuse

Threat: evaluator collusion, false votes, or non-reveal.

Mitigation:

- capability/reputation eligibility
- stake requirement
- independent selection
- commit/reveal
- reveal timeout
- reduced future influence for unreliable evaluators

Do not claim that collusion is impossible; claim that the protocol raises attack cost and detects certain suspicious patterns.

## 5. Sybil attacks

Threat: one actor creates many fake agents.

Prototype mitigation:

- minimum stake
- bootstrap exposure limit
- identity binding within the prototype
- low trust for new identities
- require independent counterparties before capacity increases materially

## 6. Evidence tampering

Mitigation:

- hash output and evidence
- bind evidence to task ID and worker ID
- store canonical submission timestamp

## 7. API security

- server-side API keys
- input validation
- authorization by agent role
- rate limiting for mutation endpoints
- audit logging

## 8. Liveness

Every state must have a timeout or explicit fallback.

```text
Evaluator commit
 -> reveal deadline
 -> non-reveal penalty
 -> quorum check
 -> fallback / arbitration
```

## 9. Prototype limitation

The hackathon prototype may use simulated balances and deterministic backend logic. It must not be represented as a regulated banking or payment product.
