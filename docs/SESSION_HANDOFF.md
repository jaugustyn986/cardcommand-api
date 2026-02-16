# Session Handoff - Start Here

**Last updated:** 2026-02-15

## Current State

- Monorepo workspace with two active repos:
  - `cardcommand-api` (Railway production)
  - `cardcommand-frontend` (Vercel production)
- Releases tab is intentionally **sealed-product only** (`packs/boxes/bundles/tins/etc.`).
- Top chases now use a **hybrid strategy**:
  - Primary: deterministic price-ranked from internal TCG card prices.
  - Fallback: trusted editorial list when priced-card coverage is too thin.
- Price provenance is shown in UI (matched listing context, chase source labels).

## What Was Just Shipped

- Hybrid top-chase fallback layer added (editorial fallback with provenance).
- Releases API now returns chase provenance fields used by frontend:
  - `setTopChasesSource`
  - `setTopChasesSourceUrl`
  - `setTopChasesAsOf`
- Sealed pricing lookup improved with multi-pass query variants.
- Guardrail added: concrete sealed SKUs do not intentionally downgrade to unrelated pricing strategies.
- Both repos were cleaned, committed, and pushed; production sync runs were validated.

## Hybrid Design Notes (Why It Looks Like This)

- The original deterministic-only chase model failed for sets where card inventory existed but prices were sparse/missing.
- Editorial fallback was introduced to preserve user value while still keeping deterministic data as primary.
- Provenance is explicit so users can distinguish:
  - `price_ranked`
  - `editorial_fallback`
- For sealed pricing, strict product-kind matching is required for SKU rows to avoid misleading pack-vs-box pricing.

## What To Watch Out For

- Sync status is in-memory run state; after redeploy, prior run history can reset.
- Long syncs can remain `running` for extended periods; verify completion with data checks, not status alone.
- `set_default` rows are placeholders and should not override concrete SKU behavior.
- If marketplace data is poor, `No market price` is preferred over a misleading number.

## If Starting Fresh (New Agent Checklist)

1. Read:
   - `docs/SESSION_HANDOFF.md` (this file)
   - `docs/AI_HANDOFF.md`
   - Other repo: `cardcommand-frontend/docs/AI_HANDOFF.md`
2. Verify deploy status:
   - Railway API service healthy and on latest deployment.
   - Vercel frontend built from latest `main`.
3. Trigger and monitor release sync:
   - `POST /api/admin/releases/sync` (auth required)
   - `GET /api/admin/releases/sync/status`
4. Validate production data:
   - `GET /api/releases/products` and inspect Ascended rows for price context + chase provenance.

## Recommended Next Work

- Add secondary sealed fallback (e.g., eBay sold median) to improve coverage when TCGPlayer is sparse.
- Persist sync run state to DB (instead of in-memory) for durable observability.
- Extend hybrid strategy pattern to individual-card surfaces (Deals/Top Chases) with explicit provenance tiers.
