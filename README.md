# Flatmate TrustVault

**A shared-rental deposit that no single person can move.**

RMIT GenAI & Cybersecurity Hackathon 2026 · TideCloak Challenge 2

A single-page dashboard where three students and one landlord protect a **$1,200 bond** using TideCloak Emergent Authority. No master key. No admin override. Authority exists only while a live 2/3 consensus exists.

![Flatmate TrustVault dashboard](artifacts/v-home-top.png)

---

## The five questions

### 1. What problem are you solving?

Shared rental deposits are held by one person, usually the lead tenant. Roommates hand over cash and hope. Landlords face the same asymmetry from the other side: they can withhold a bond without evidence. In student share-houses, the "trust me" bond is the norm, and nobody holds a shared record of who paid what.

### 2. What is your solution?

Flatmate TrustVault turns a $1,200 bond into a policy-bound escrow vault. Each tenant's $400 stays cryptographically bound to them. No single wallet, not the lead tenant's and not the landlord's, can move a dollar. Funds are released only when an evidence-backed claim satisfies one written policy: the landlord's signature plus two of three tenant approvals.

### 3. How does TideCloak enable it?

TideCloak supplies identity and authorization. Every persona receives a role-bound ES256 session, and every sensitive action is signed with browser-held keys. The release policy is evaluated from live signatures at settlement time, so authority is computed on demand rather than stored. There is no admin override and no master key to steal.

### 4. What happens when people disagree?

Two tenant rejections block the deduction and engage a partial freeze. The undisputed $1,050 is refunded immediately; only the disputed $150 waits for TideCloak's neutral arbitration panel. The landlord receives nothing in the meantime.

### 5. Why does it matter?

It replaces brokered trust with verifiable consent. Every attempt, including blocked ones, lands in a hash-chained audit trail, giving roommates and landlords one shared source of truth. The same primitive also fits club treasuries, family savings, freelance escrow and on-chain DAO payouts.

---

## Run it locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

Production check:

```bash
npm run typecheck
npm run build
npm run preview
```

### Demo mode (default)

No Docker or realm required. The app boots a local policy realm and registers four browser-held identities, then asks you to sign in. Choosing an identity mints a fresh role-bound ES256 session; every approval is signed in the browser. Open **http://localhost:3000** and choose an identity. Add `?as=minh` (or `lan`, `tuan`, `bay`) to deep-link straight into a role for automated capture.

### Live TideCloak realm (optional)

The app calls the official `@tidecloak/js` SDK. Provide either a `tidecloak.json`-style adapter on `window.__TIDECLOAK__` or a `.env` file:

```bash
cp .env.example .env
# VITE_TIDECLOAK_URL=https://your-tidecloak-host
# VITE_TIDECLOAK_REALM=tide-demo
# VITE_TIDECLOAK_CLIENT_ID=trustvault
```

If the realm is unreachable the app logs a warning and continues in demo mode, so judges are never blocked by infrastructure.

## Demo script (90 seconds)

1. **Sign in as Minh (lead tenant)** — TideCloak mints a role-bound ES256 session.
2. Minh tries *Withdraw all · $1,200* → `403 NO_MASTER_KEY`.
3. **Mr. Bảy (landlord)** tries *Force-deduct $300* → `403 MISSING_CONSENSUS`.
4. As Mr. Bảy, submit the prefilled **$150 broken faucet** claim with photo evidence.
5. Switch to **Lan**, sign → 1 of 2. Switch to **Tuấn**, sign → **⚡ EMERGENT AUTHORITY UNLOCKED**.
6. Watch the atomic payout: $150 to the landlord, $350 back to each tenant, vault closed.
7. Hit **Reset demo**, then **Trigger dispute**: two rejections refund $1,050 instantly and freeze only the disputed $150.

The session card shows the token's role scope and a **Sign out** control. Signing out clears session tokens from memory; signing back in mints a new token.

Automated verification: `node scripts/flow.mjs` (requires Chrome and a running dev server).

## How it works

| Layer | Implementation |
| --- | --- |
| Sign-in | Identity picker mints a fresh role-bound ES256 session per user; each switch rotates the token |
| Identity | Non-extractable ECDSA P-256 keys generated in-browser; tokens are JWT-shaped and signed locally |
| Access | Role-scoped tokens: landlord files claims, tenants co-sign, nobody holds a move-funds scope |
| Policy | `tide.bond.release.v1` — 1 landlord signature + 2 of 3 tenant approvals, zero master keys |
| Consensus | Each approval is a detached ECDSA signature over the claim payload; verified before counting |
| Settlement | Single atomic state transition; one-time authority is revoked after payout |
| Dispute | Rejection threshold engages a partial freeze; undisputed balance refunds immediately |
| Data protection | Sessions live in memory only; evidence is SHA-256 committed; audit entries are hash-chained |
| Red team | Withdrawal and force-deduct paths return signed 403 receipts instead of moving funds |

Key files: `src/tidecloak/client.ts` (SDK init), `src/tidecloak/policy.ts` (release rules), `src/lib/crypto.ts` (signing), `src/hooks/useTrustVault.ts` (state machine).

## Scope

- Funds are simulated; no payment rails are connected.
- The demo identity provider mints real ES256 signatures but is not a production identity provider; a live TideCloak realm can replace it.
- Arbitration is represented by a frozen balance and case ID, not a live panel workflow.

## Credits

- Evidence photo: free-to-use stock image from [Pexels](https://www.pexels.com/license/), cropped for the demo.
- Icons: [Lucide](https://lucide.dev).
- Built with React 19, Vite, Tailwind CSS v4, and `@tidecloak/js` 0.14.41.

## Video

`demo.mp4` in this repository walks through both the consensus and dispute paths in under two minutes.

## License

MIT
