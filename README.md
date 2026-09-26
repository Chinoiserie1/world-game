# World Game ○△□

**Weekly elimination mini-games for verified humans.** One human, one seat, one USDC prize pool.

World Mini App built for **ETHGlobal Tokyo 2026** — World track ([Best Use of IDKit](https://ethglobal.com/events/tokyo2026/prizes/world)).

Players pay a small USDC ticket (MiniKit `pay`) into an on-chain **PrizePool** on World Chain. Every week a new
mini-game opens; the players who don't survive it are eliminated. The last humans standing split the pool.
No NFTs: a seat is an Orb-verified World ID, not a token you can buy or farm.

**Sponsors can top up the pool.** Anyone signed in (player or not) can add USDC to the season's prize pool from the
app (MiniKit `pay`), or on-chain via `PrizePool.topUp()`. Top-ups grow the prize for the survivors and show on a
sponsor leaderboard. They never buy a seat.

| Week | Game | Survival rule |
|------|------|---------------|
| 1 | **Rock · Paper · Scissors** — first to 3 wins vs. the Game Master | win the duel |
| 2 | **Minesweeper** — 8×8, 10 mines, 3 min | best 50% by cleared cells |
| 3 | **Glass Bridge** — 12 rows, left or right | best 50% by rows crossed |
| 4 | **Minority Game** — red or blue | only the minority side survives |

Weeks 1–2 are the requested games; weeks 3–4 are proposals that fit the elimination format (the final one is the
game where Sybil resistance matters most — with fake accounts you could steer the majority).

---

## The trust moments (why World ID)

| When | Proof | What it prevents |
|------|-------|------------------|
| **Entry** | IDKit **uniqueness proof**, action `world-game-s{season}-entry`, `signal = wallet`. Nullifier stored under `UNIQUE(action, nullifier)`. | Buying several "lives" with several accounts (Sybil). A proof can't be replayed on another wallet (signal check). |
| **Lock** | IDKit **session** created right after entry, `session_id` bound to the seat (never silently replaced). | Establishes continuity for the rest of the season. |
| **Every week** (checkpoint before the elimination game) | **Session proof** of the saved session; per-proof `session_nullifier` stored UNIQUE. | A bot, a friend, or a buyer playing a seat that was sold after entry. |
| **Prize claim** | Session proof again, then on-chain payout. | Someone else collecting the prize. |

**Credential choice: Orb-verified World ID only.** *Proof of Human* is the only credential that gives a strict
one-person-one-seat guarantee, which is exactly what a paid elimination game with a shared pot needs. Selfie Check,
passport and device credentials are rejected server-side (`credential_not_accepted`), for both entry and sessions.

**Blocked paths (the meaningful alternatives).** Every protected action fails closed with an explicit error:
duplicate nullifier (a second wallet with the same human), a proof bound to another wallet, a non-Orb credential,
a session proof from a different World ID at the weekly checkpoint, a replayed session proof, or a claim by a
non-survivor.

## Architecture

```
World App ──MiniKit walletAuth (SIWE)──▶ /api/auth/siwe ─▶ httpOnly session cookie
          ──IDKit (native transport)───▶ /api/world-id/{rp-signature,enter,lock,checkpoint}
          │                                   └─ forwards proof untouched ─▶ developer.world.org/api/v4/verify/{rp_id}
          ──MiniKit pay (USDC)────────────▶ PrizePool.sol  ◀── payout(to, amount, claimId) ── operator
            (entry ticket or top-up)      /api/{payments,topup}/confirm ─▶ Developer Portal tx check (ref, to, token, amount, from)
Sponsor wallet ──PrizePool.topUp()────────▶ PrizePool.sol (on-chain sponsorship, ToppedUp event)
          ──moves─────────────────────────▶ /api/game/{start,move}  (server-authoritative engines)
Game master ─────────────────────────────▶ /admin → /api/admin/round (open / close & eliminate)
```

* **Server-authoritative, provably-fair games.** Each play gets a secret seed; `sha256(seed)` is shown before the
  first move and the seed is revealed when the play ends, so the browser checks the board/house moves weren't changed.
  Minesweeper's first click is always safe yet still verifiable (mines = f(seed, first click)).
* **Pure engines** (`src/lib/games`) — immutable state machines, no I/O.
* **Service layer** (`src/lib/service`) — all business rules, injected deps, tested against in-memory SQLite.
* **Storage** — libSQL: local file in dev, Turso in production. Nullifiers stored as canonical decimals under UNIQUE.
* **Payments** — every payment reference has a kind (`entry` or `topup`); a top-up reference can never be used to
  buy a seat, and every confirmed payment (tickets + top-ups) counts toward the prize split.
* **Contract** (`contracts/`) — `PrizePool.sol`: USDC custody, public `topUp()`, operator-only payouts, one payout per
  claim id, per-claim cap, pausable, **no owner withdrawal**.

```
src/lib/games      rps · minesweeper · glass-bridge · minority · rng (commit/reveal)
src/lib/worldid    IDKit proof verification (uniqueness + session)
src/lib/payments   MiniKit pay verification
src/lib/service    identity · entry · topup · rounds · admin · claims · overview
src/app/api        route handlers ({ success, data, error } envelope, rate limited)
src/components     UI (mobile-first, World App webview)
contracts/         Foundry: PrizePool.sol + tests + deploy script
```

## Setup

```bash
pnpm install
cp .env.example .env.local        # fill it in (see below)
pnpm dev
```

### Developer Portal (https://developer.world.org)

1. Create a **Mini App**, enable **World ID 4.0** → note `app_id`, `rp_id`, and store the **signing key** as
   `RP_SIGNING_KEY` (server-only, shown once).
2. Create the action **`world-game-s1-entry`** in the environment you test (`production` for real phones,
   `staging` + [simulator](https://simulator.worldcoin.org) for desktop). `WORLD_ID_ENV` must match.
3. Create an API key → `DEV_PORTAL_API_KEY` (payment verification).
4. Whitelist the PrizePool address for **Pay**, set the app URL (ngrok/Vercel) and open it in World App.

### Contract

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-git
forge test
# World Chain USDC.e: 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1 (verify on docs.world.org before deploying)
USDC_ADDRESS=0x79A0… POOL_OWNER=0x… POOL_OPERATOR=0x… MAX_PAYOUT=1000000000 \
  forge script script/Deploy.s.sol --rpc-url worldchain --broadcast --account deployer
```

Set `PRIZE_POOL_ADDRESS` to the deployed address and (optionally) `OPERATOR_PRIVATE_KEY` so claims pay out
automatically; without it claims stay `pending` for a manual payout.

### Running a season

Open `/admin`, enter `ADMIN_SECRET`:
* **Open next game** — closes registrations on week 1 and starts the week (duration configurable for demos).
* **Close & eliminate** — applies the week's survival rule; players who didn't play are eliminated. After week 4
  the survivors become winners and can claim.

### Demo mode (judging without World App)

`DEMO_MODE=true` enables a throwaway wallet, simulated World ID and simulated payments, clearly labelled in the UI.
It is off by default and every demo route re-checks the flag server-side; demo seats can't claim real payouts,
and demo top-ups are only simulated.

## Tests

```bash
pnpm test            # 82 unit + integration tests (engines, World ID verify, payments, top-ups, season flow, attacks)
pnpm test:coverage   # ≥ 80% on src/lib
pnpm test:e2e        # Playwright: demo player → entry → top-up → checkpoint → week 1 → verdict
cd contracts && forge test   # PrizePool incl. fuzzing
```

## Known limitations (MVP)

* Rate limiting is in-memory per instance — use Redis/Upstash when scaling out.
* `allow_legacy_proofs` is on for Proof of Human, as recommended, so legacy (3.0) Orb users can enter. Legacy
  and 4.0 nullifiers are different values, so one person could in theory enter twice (once with each). Sessions
  are 4.0-only, so a legacy-only user must upgrade before locking their seat.
* Users without an Orb verification can't play (by design) — they can still sponsor the pool.
* Payouts depend on a trusted operator (capped per claim, one payout per claim id, pausable).
* If everyone is eliminated, the pool stays in the contract for the next season.

## IDKit integration feedback

* **Time to success:** ~1 h from reading the docs to a verified proof flow in the backend. The `SKILL.md` +
  `llms.txt` docs made it straightforward to pick the 4.0 APIs.
* **Friction points:** the React session widget takes `constraints` (`CredentialRequest(...)`) while the session guide
  uses `.preset(...)`, so it's unclear which to use. Sessions are v4-only while Proof of Human recommends
  `allow_legacy_proofs`, which leaves legacy users able to enter but unable to lock a session.
* **Capability gaps:** we'd like a way to link a legacy nullifier to its 4.0 nullifier for the same action (to close
  the double-entry gap), and an official test-vector fixture for session results.
* **Priority improvements:** (1) align the session docs and the React types, (2) add a mock-verifier mode for unit
  tests, (3) a documented way to require a 4.0 Proof of Human while still guiding legacy users to upgrade.
