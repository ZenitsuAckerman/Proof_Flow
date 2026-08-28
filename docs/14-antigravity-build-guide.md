# ProofFlow — Antigravity Build Automation Guide

## Goal

Use Antigravity as an implementation agent, but drive it with a controlled sequence rather than asking it to build the whole project in one vague prompt.

The safest workflow is:

```text
Architecture docs
    ↓
Implementation plan
    ↓
Vertical slice
    ↓
Tests
    ↓
UI polish
    ↓
Demo verification
```

## 1. Recommended Antigravity model

Use the strongest current Gemini coding/agent model exposed by your Antigravity environment. If Gemini 3.7 Flash is available, use it for the main implementation loop. If the environment exposes Gemini 3.1 Pro Preview instead, use that. Do not redesign the architecture just to change models.

## 2. Give Antigravity the repository context

At the start of the session, tell Antigravity to read these files before changing code:

1. `README.md`
2. `docs/00-build-plan.md`
3. `docs/01-product-requirements.md`
4. `docs/02-system-requirements.md`
5. `docs/03-architecture.md`
6. `docs/04-database-design.md`
7. `docs/05-ai-agents-spec.md`
8. `docs/06-data-specification.md`
9. `docs/07-api-documentation.md`
10. `docs/08-ui-ux.md`
11. `docs/09-security.md`
12. `docs/10-test-plan.md`
13. `docs/12-risks.md`

Do not ask it to read every roadmap/future-looking document before coding if time is critical.

## 3. Global build instruction

Paste this as the master instruction in the Antigravity project context:

```text
You are implementing ProofFlow, a hackathon MVP for autonomous financial infrastructure for agent-to-agent work.

Before editing code, read README.md and the core docs listed in docs/00-build-plan.md.
Treat those documents as the source of truth for the architecture and terminology.

Build one complete, working vertical slice rather than a broad but shallow system.

Core flow:
Buyer Agent → Task Creation → Discovery → Bidding → Financial Underwriting → Wallet/Escrow/Collateral → Execution → Proof-Carrying Evidence → Adaptive Verification → Clearing → Conditional Settlement → Ledger → Capability-Specific Economic Capacity Update.

The MVP must work without external AI or database credentials. Use deterministic fallback data/logic when Gemini or Supabase is unavailable.

Financial state must be real application state, not animation-only state.
Settlement must be idempotent.
No money may be created or lost accidentally.
No task may be settled twice.
Escrow cannot remain permanently locked because of a normal timeout.

Do not add unnecessary infrastructure, microservices, blockchain, insurance, DAO governance, complex credit markets, or production-grade zero-knowledge systems.

Use a deterministic code-bounty task as the primary verification demo. Keep Blind Jury as a second adaptive-verification route for subjective work.

Do not claim that a jury proves objective truth. High evaluator disagreement must become UNCERTAIN and use a safe fallback.

Use capability-specific economic capacity instead of one global reputation score.
Reputation reduces friction but never reduces required collateral to zero.

After each implementation phase:
1. run the type checker/linter/tests,
2. fix all errors,
3. verify the app can start,
4. summarize what changed,
5. continue to the next phase without waiting for manual confirmation unless a required credential is missing.
```

## 4. Phase prompts

### Phase A — domain and state machine

```text
Implement only the domain layer and state machine first.
Create strongly typed entities for agents, tasks, bids, wallets, escrow, collateral, evidence, evaluations, verification, clearing, settlement, transactions, and reputation/capacity events.
Implement the canonical task lifecycle and all defined failure transitions.
Add seeded demo data.
Run typecheck/tests and fix all failures.
Do not polish UI yet.
```

### Phase B — financial engine

```text
Implement the financial layer.
Create wallet, escrow, collateral, buyer-bond, ledger, risk/exposure, and settlement services.
Enforce atomic/idempotent state transitions.
Implement insufficient-funds, insufficient-collateral, expiry, duplicate-settlement, and refund handling.
Add unit tests for balance conservation and settlement idempotency.
Run tests and fix failures before continuing.
```

### Phase C — agent economy

```text
Implement task creation, capability-based discovery, bidding, explainable worker selection, and financial underwriting.
Use deterministic seed data first.
Every selection should expose the scoring factors used.
Do not introduce external model dependencies unless already configured.
Add tests for selection and underwriting.
```

### Phase D — execution and evidence

```text
Implement the primary deterministic Python bug-fix demo.
Create an execution result and a proof-carrying evidence package containing output/artifact information, test results, execution trace, and integrity/hash metadata.
Implement the verification router and automated verifier.
Add tests for valid evidence, invalid evidence, failed tests, and verification-cost rejection.
```

### Phase E — Blind Jury

```text
Implement five independent evaluator agents for the subjective/fallback path.
Implement commit state, reveal state, timeout handling, median/consensus calculation, disagreement detection, and UNCERTAIN fallback.
Do not slash evaluators merely because their vote is a minority.
Make the jury flow deterministic enough for a stable demo while preserving the architecture of independent evaluation.
Add tests for normal consensus, high disagreement, missing reveal, and replacement/fallback.
```

### Phase F — clearing and settlement

```text
Implement the clearing engine with PASS, PARTIAL, FAIL, and DISPUTED/UNCERTAIN outcomes.
Translate verification results into settlement instructions.
Execute worker rewards, evaluator rewards, protocol fee, refund, and collateral return/slashing according to the configured rules.
Update wallets, ledger, reputation, and capability-specific economic capacity in one consistent transaction flow.
Add invariant tests.
```

### Phase G — UI

```text
Build one minimalistic command-center dashboard.
Show the current transaction pipeline:
Discovery → Competition → Financial → Execution → Verification → Clearing → Settlement.
Show the Autonomous Financial Layer as a prominent panel.
Show wallet balances, escrow, collateral, evidence, Blind Jury state, consensus, ledger, and economic-capacity update.
Use centralized design tokens so future uploaded brand colors can replace the palette quickly.
Use restrained motion only for state transitions and money movement.
```

### Phase H — demo and hardening

```text
Add one-click “Run Autonomous Transaction”.
Add one-click “Run Failure Scenario”.
Verify the happy path and every high-priority failure path.
Run build, lint, typecheck, and tests.
Fix every runtime/compile issue.
Do not add new features after this point unless they are required for demo reliability.
```

## 5. Automated verification loop

After every major Antigravity phase, use this sequence:

```text
FORMAT/LINT
    ↓
TYPECHECK
    ↓
UNIT TESTS
    ↓
BUILD
    ↓
START APP
    ↓
SMOKE TEST
    ↓
NEXT PHASE
```

Do not let Antigravity accumulate errors across five phases.

## 6. Suggested shell commands

Adapt to the actual package manager selected by the generated project.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

If the project uses another package manager, use its equivalent commands.

## 7. Git checkpoints

Create a commit after each stable phase:

```text
feat: establish proofFlow domain model
feat: implement financial layer
feat: implement agent discovery and bidding
feat: implement proof and verification
feat: implement blind jury
feat: implement clearing and settlement
feat: implement dashboard
chore: harden demo and tests
```

This also gives you a clean story for any AI-assisted-development/Trace Commerce AI judging track.

## 8. What to do when Antigravity gets stuck

Do not give it a larger prompt immediately.

Use:

```text
Stop adding features.
Read the failing test/error.
Identify the smallest root cause.
Fix only that cause.
Run the smallest relevant test.
Then run the full validation suite.
```

If the error is architectural, ask Antigravity to inspect the relevant source-of-truth document before changing the implementation.

## 9. Color/design handoff

Do not hard-code a final brand palette into individual components.
Use central CSS variables/design tokens. When the team's reference colors arrive later, change the tokens once rather than editing every component.
