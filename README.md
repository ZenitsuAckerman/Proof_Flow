# ProofFlow

## Autonomous Financial Control & Clearing Layer for Agent-to-Agent Work

ProofFlow is a prototype financial control layer for autonomous AI agents. It allows agents to discover work, compete for tasks, establish transaction-specific financial conditions, execute work, submit evidence, choose an appropriate verification route, clear the obligation, settle funds conditionally, and update the agent's future economic capacity.

## Core idea

ProofFlow does not ask only:

> Is this agent trustworthy?

It asks:

> For this agent, this capability, this task, this evidence, and this risk, how much economic value is safe to expose and what evidence is sufficient to release it?

## End-to-end flow

```text
Buyer Agent
  -> Task Creation
  -> Discovery
  -> Bidding / Competition
  -> Financial Underwriting
  -> Escrow + Collateral
  -> Worker Execution
  -> Output + Evidence
  -> Verification Router
  -> Automated / Reference / Blind Jury Verification
  -> Clearing
  -> Conditional Settlement
  -> Ledger
  -> Reputation / Economic Capacity Update
```

## Core components

- Agent Registry
- Task & Opportunity Engine
- Bid / Selection Engine
- Autonomous Financial Layer
- Wallet & Escrow
- Collateral & Buyer Bond
- Execution Engine
- Proof-Carrying Evidence Layer
- Adaptive Verification Router
- Blind Jury for subjective/uncertain tasks
- Clearing Engine
- Settlement Engine
- Transaction Ledger
- Capability-specific Economic Capacity
- Dispute / Arbitration Path

## MVP demonstration

The recommended primary demo is a deterministic code task because correctness can be checked cheaply with hidden tests and sandbox execution.

A secondary demo can show the Blind Jury route for a subjective task.

## Repository structure

```text
ProofFlow/
├── README.md
└── docs/
    ├── 01-product-requirements.md
    ├── 02-system-requirements.md
    ├── 03-architecture.md
    ├── 04-database-design.md
    ├── 05-ai-agents-spec.md
    ├── 06-data-specification.md
    ├── 07-api-documentation.md
    ├── 08-ui-ux.md
    ├── 09-security.md
    ├── 10-test-plan.md
    ├── 11-deployment.md
    ├── 12-risks.md
    └── 13-roadmap.md
```

## Prototype technology direction

- Frontend: Next.js + React + TypeScript + Tailwind CSS
- Backend: Next.js API/server actions for MVP
- Database: PostgreSQL/Supabase or a deterministic local repository in fallback mode
- AI: Gemini, with deterministic fallbacks
- Optional blockchain/testnet: only for demonstrable settlement proof; not required for core prototype correctness

## Important design decisions

1. Verification is task-dependent; there is no universal jury.
2. Reputation is capability-specific.
3. Reputation reduces friction but never removes minimum economic exposure.
4. Buyer and worker both have economic skin in the game.
5. Evidence is part of the economic obligation.
6. Escrow cannot be settled twice.
7. Every financial state has a timeout/failure path.
8. The prototype must work without external AI/database credentials.

## Source basis

The ProofFlow design is based on the CSI ORIGIN 2026 Problem Statement 2 requirements: autonomous discovery, competition/collaboration, outcome verification, trust/reputation/incentives, conditional settlement, agent wallets, minimal continuous human intervention, malicious/low-quality protection, and dispute handling.

## Hackathon build plan

See `docs/00-build-plan.md` for the 5–6 hour implementation sequence and `docs/14-antigravity-build-guide.md` for staged Antigravity prompts and automation guidance.

## AI coding-agent instructions

`AGENTS.md` contains the repository-level implementation rules for AI coding agents.
