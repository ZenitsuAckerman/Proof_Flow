# 11 — Deployment

## Recommended MVP deployment

```text
Frontend + API: Next.js on Vercel
Database: Supabase PostgreSQL
AI: Gemini API
Optional testnet settlement: separate integration
```

## Environment variables

```text
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Optional blockchain variables should be added only when needed.

## Local development

```bash
npm install
npm run dev
```

## Production checks

```bash
npm run lint
npm run build
npm start
```

## Fallback mode

If Supabase or Gemini is unavailable, the app must start in deterministic mock mode.

Mock mode must still implement:

- agents
- tasks
- bids
- financial state
- verification
- settlement
- ledger

## Deployment principles

- Never expose secrets to browser code.
- Never let the browser mutate balances directly.
- Server-side settlement service owns financial state transitions.
- Log deployment version and transaction IDs for debugging.
