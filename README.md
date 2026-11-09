# ThriftRecall

A group savings (ajo / esusu) tracker that remembers who paid, who was late and whose turn is next.
Built for the Total Recall | Tatum x Walrus Memory Hackathon (Consumer Finance track).

> **Fictional demo data only. No real money moves.** Members, amounts and payouts are made up. The app never
> holds, sends or verifies money, and it has no wallet connection.

Earlier working names were AjoRecall and AjoVault. The product name is now **ThriftRecall**.

## What the page shows
- **Week 2 board (interactive, local only):** 5 fictional members, ₦5,000 each per week, ₦25,000 per weekly pot.
  The starting point mirrors the saved memories: week 1 is complete and its pot went to Amaka (Demo A); in week 2 only
  Amaka has a recorded contribution; Tunde (Demo B) is next in the agreed order. "Record sample", "Undo" and "Reset"
  change this page only. They never save or delete Walrus memories.
- **Reminder nudge:** a simple local rule. Emeka (Demo D) paid week 1 late in the saved history, so he gets a suggested
  reminder while his week 2 contribution is outstanding. No AI prediction is made and no message is sent.
- **Live panel and Circle history (read-only, Walrus Mainnet):** five connection checks, the first saved test memory
  shown word for word, all saved circle memories oldest first, and a short summary derived from them.
- **Display names:** the saved memories use "Demo A" to "Demo E". The page adds fictional labels on screen only:
  Amaka (A), Tunde (B), Ngozi (C), Emeka (D), Halima (E).
- **Currency:** amounts written by the app use the naira sign (₦5,000). Memory texts are shown exactly as saved,
  which use "NGN 5,000".

## How it uses Walrus Memory and Tatum
- **Walrus Memory (Sui Mainnet):** savings-circle events are stored as memories in the namespace `ajorecall-demo`
  (the project's earlier working name; kept because the Mainnet memories live there and cannot be renamed).
- **Circle history (read-only):** `GET /api/status` returns the saved circle memories, read with one
  `listMemories` call (inventory and status) and one `recall` call (texts). `lib/history.mjs` keeps only active
  memories marked "FICTIONAL DEMO DATA" with a project test marker, orders them oldest first, labels them
  (Contribution / Missed / Late payment / Payout / Order agreed / Swap request) and derives a short summary
  (who was late, whose payout is next) from the texts. The page renders everything as plain text (`textContent`).
  If the read fails, it shows "history unavailable" and never falls back to made-up data.
- **Tatum Sui RPC (gRPC):** `lib/live-status.mjs` reads the MemWal account object on Sui Mainnet through
  `sui-mainnet-grpc.gateway.tatum.io` to confirm the account is active and the delegate key matches.

## How the 10 memories were written
Each memory was approved by the project owner before it was saved, and written once from a local computer
(never from the website). Memory 1 was saved on 8 Nov 2026 and memories 2–10 on 9 Nov 2026, using small local scripts
with the `@mysten-incubation/memwal` SDK (`remember` → `waitForRememberJob` → `recall` to confirm the exact text).
`scripts/remember.mjs` is the cleaned-up version of that tool kept in this repo: it needs the
`--approve-mainnet-write` flag, refuses text that does not start with "FICTIONAL DEMO DATA", and refuses duplicates.

| # | Event | Walrus blob ID |
|---|---|---|
| 1 | Contribution (Demo A, week 1) | `e7A4R1pBbv_ybC9LMyN2brOGKQA6SZYsFXR3hphs6S8` |
| 2 | Contribution (Demo B, week 1) | `HOzjCX9doBlQKDc2KvY6JKKwyiocrotEZo6KMrplLgM` |
| 3 | Contribution (Demo C, week 1) | `LdyhGwnv72sgaJWuQQ43tC5OWfaUbsQUYN9meJn2USs` |
| 4 | Missed (Demo D, week 1) | `1T_X2Hess6PbY-NSzrbYDeE0avBe16pW2KpZ2_m1NCo` |
| 5 | Contribution (Demo E, week 1) | `19-v1hGK85-M0uzsUf738BZZgCKWdDUS0jY69XAOHGg` |
| 6 | Late payment (Demo D, week 1) | `4FGd-HsTma11JKGi4x95czLhCQakStdwdi96le4a5jU` |
| 7 | Payout (week 1 pot to Demo A) | `oAqRY_-aLkJupRsToXQ0zemkwjcXDwnajRnkiZF8k5U` |
| 8 | Order agreed (B → C → D → E) | `89M3dDaVloZ3KF48CeJlT056IWYjtusVsyAx3aDalIQ` |
| 9 | Contribution (Demo A, week 2) | `68pk4eF0N_2mUnjk7zxYvtIP4mg0NqPesptEn57Ivzw` |
| 10 | Swap request (Demo C ↔ Demo D, pending) | `DM2FdfBIf8quuBsMFoKOgzxY5bgk0ZATg0Tewv8q8cE` |

## Safety
- The deployed site is read-only: the only API route is `GET /api/status` (live checks + circle history). There are no write routes.
- Results are cached for 5 minutes (per server instance and on the Vercel CDN); query strings and unusual `Accept`
  headers are rejected so the cache cannot be bypassed, and cross-site requests are refused.
- Security headers (CSP, no framing, no referrer, nosniff) are set in `vercel.json`.
- Keys live only in server-side environment variables (`MEMWAL_PRIVATE_KEY`, `TATUM_API_KEY`). See `.env.example`.
  They are never returned to the browser or logged.

## Run locally
```
npm install
MEMWAL_PRIVATE_KEY=... TATUM_API_KEY=... npm run dev   # http://127.0.0.1:40611
npm test                                               # offline tests, no keys needed
```
The offline tests cover the route guards, the cache, the history filter and order, the derived summary, the week 2
board math (record / undo / reset), the reminder rule and the page text checks.
