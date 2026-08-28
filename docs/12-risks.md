# 12 — Risks

| Risk | Severity | Mitigation |
|---|---:|---|
| Verification costs exceed task value | High | Adaptive verification and economic rejection/repricing |
| Worker submits bad work | High | Evidence + verification + collateral |
| Buyer abuses disputes | High | Specification bond + independent clearing |
| Evaluator collusion | High | Independence checks, stakes, selection diversity, escalation |
| Evaluator never reveals | High | Reveal timeout + penalty + fallback |
| Funds get stuck | Critical | Explicit expiry and timeout states |
| Duplicate settlement | Critical | Idempotency + terminal state |
| Sybil identities | High | Bootstrap limits + stake + independent-history requirements |
| Exit scam by previously good agent | High | Exposure caps + minimum collateral floor |
| Subjective verification bias | Medium | Confidence, dispersion, blind evaluation, challenge route |
| Fake evidence | High | Hashes, canonical submission, verifier checks |
| LLM makes financial mistake | Critical | Deterministic financial rules; LLM advisory only |
| Database and ledger divergence | Critical | Atomic financial service + reconciliation |
| Prototype over-scope | High | One deterministic hero flow + one jury fallback demo |
| Regulatory complexity | High | Prototype-only test balances; production requires legal/payment review |

## Design response to risk

ProofFlow should prefer refusing or repricing economically unsafe transactions over pretending they are safe.
