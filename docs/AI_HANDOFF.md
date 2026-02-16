# CardCommand API - AI Handoff

> Use this doc to resume API work quickly and safely.

---

## Current Focus

- Reliable release intelligence for sealed products.
- Transparent provenance in API payloads.
- Hybrid top-chase strategy (deterministic first, editorial fallback second).
- Safe pricing behavior: avoid misleading SKU pricing when market matches are weak.

## Production Snapshot

- Platform: Railway
- API base: `https://cardcommand-api-production.up.railway.app`
- Sync trigger: `POST /api/admin/releases/sync` (auth required)
- Sync status: `GET /api/admin/releases/sync/status` (auth required)
- Core products endpoint: `GET /api/releases/products`

## Core Architecture (Release Pipeline)

Primary orchestration: `src/releaseSyncPipeline.ts`

Pipeline stages:
1. Tier A release sync (`syncAllReleases`)
2. Tier A link backfill (`backfillTierALinks`)
3. Placeholder price cleanup (`backfillPokemonSetDefaultPricing`)
4. SKU creation backfill (`backfillPokemonSealedSkuRows`)
5. Sealed market pricing backfill (`backfillSealedProductMarketPricing`)
6. Top chase enrichment (`backfillReleaseTopChasesFromTcg`)
7. Tier B/C scrape ingest (`scrapeAndUpsertReleaseProducts`)
8. Strategy backfill (`backfillStrategiesForPokemon`)

## Hybrid Logic (How It Works)

### Release pricing (sealed products)

- Pricing source lookup uses `marketDataService`.
- Search strategy is multi-pass:
  - exact/normalized query variants
  - strict product-kind preference first
- Guardrail:
  - concrete SKU rows (`booster_box`, `booster_bundle`, `elite_trainer_box`, `tin`, etc.) remain kind-strict
  - `set_default` placeholders may use relaxed fallback
- Price provenance is stored in `contentsSummary` tags:
  - `[market_price:<source>:<priceType>:<asOf>]`
  - `[market_match:<kind>:<name>:<url>]`

### Top chases

- Primary: rank by card prices (`market > mid > low`) from internal TCG tables.
- Fallback: trusted editorial list when priced-card coverage is too thin.
- Provenance is stored in release `description` tag:
  - `[top_chases_source:price_ranked::]`
  - `[top_chases_source:editorial_fallback:<url>:<asOf>]`
- API exposes parsed fields for frontend:
  - `setTopChases`
  - `setTopChasesAsOf`
  - `setTopChasesSource`
  - `setTopChasesSourceUrl`

## Key Files

- `src/releaseSyncPipeline.ts`
- `src/releaseSyncService.ts`
- `src/marketDataService.ts`
- `src/controllers/releasesController.ts`
- `src/services/release/editorialTopChases.ts`
- `src/releaseScrapeService.ts`
- `src/releaseIntelSources.ts`

## Caveats / Gotchas

- Sync run-state is currently in-memory (`releaseSyncRunState`), so status history resets across deploy restarts.
- Long runs can appear as `running` for several minutes; verify with data reads too.
- If no trustworthy market match exists, API should return no price instead of forced fallback.

## Environment Variables (Release/TCG Relevant)

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `OPENAI_API_KEY` (scrape extraction; optional for deterministic-only operation)
- `OPENAI_EXTRACTION_MODEL` (optional)
- `POKEMON_TCG_API_KEY` (recommended)
- `POKEMON_TCG_TIMEOUT_MS`
- `TCG_SYNC_ENABLED`
- `TCG_POKEMON_ENABLED`
- `TCG_MTG_ENABLED`
- `TCG_YUGIOH_ENABLED`
- `TCG_RECENT_SET_WINDOW_DAYS`

## What We Would Do Differently Next

- Persist sync run state in DB instead of in-memory module state.
- Separate release metadata provenance from freeform `description`/`contentsSummary` tags into first-class columns.
- Add source scoring telemetry per query attempt so pricing misses are diagnosable without log spelunking.
- Add secondary sealed market source fallback (e.g., sold-listing median) behind explicit provenance labeling.

## Individual Card Roadmap Alignment

This hybrid pattern is intended to be reused for cards:
- deterministic card prices as primary source
- editorial/curated fallback for discovery contexts
- explicit provenance in every UI-visible value
- strict separation of "price confidence" and "content confidence"

## Quick Resume Commands

```bash
# build
npm run build

# trigger sync (auth required)
curl -X POST https://cardcommand-api-production.up.railway.app/api/admin/releases/sync \
  -H "Authorization: Bearer <JWT>"

# inspect sealed products payload
curl "https://cardcommand-api-production.up.railway.app/api/releases/products?category=pokemon&perPage=200"
```

---

*Last Updated: 2026-02-15*
