# CardCommand API - AI Handoff

> Focus area in current phase: Releases intelligence ingestion, deduplication, pricing integrity, and trust metadata for UI.

---

## 1. Current backend state

- Deployed on Railway and synced via pushes to `main`.
- Release sync is centralized in `src/releaseSyncPipeline.ts`.
- Manual sync endpoint (`POST /api/admin/releases/sync`) and cron job both call the same pipeline.
- Cron schedule is in `src/jobs/releaseSyncJob.ts`: `0 6,12,18 * * *` (UTC).
- Tier A ingestion includes:
  - Pokemon TCG API
  - Scryfall
  - `pokemon.com/api/1/us/expansions` deterministic source
- Tier B/C ingestion includes source registry + scraping/extraction flow in `src/releaseScrapeService.ts`.

## 2. Key files to know first

- `src/releaseSyncPipeline.ts` (orchestration)
- `src/releaseSyncService.ts` (Tier A sync + link/pricing cleanup helpers)
- `src/releaseScrapeService.ts` (scrape/extract/merge/confidence)
- `src/releaseIntelSources.ts` (source registry, tiers, sourceType, include flags)
- `src/controllers/releasesController.ts` (products API shaping + dedupe + derived trust fields)
- `src/releaseStrategyService.ts` (strategy prompt rules)
- `src/marketDataService.ts` (integration scaffold, not fully implemented)

## 3. Recently completed behavior

- Added source registry metadata (`sourceType`, `includeInScrape`) and expanded sources.
- Refactored scrape flow to merge candidates by normalized set name and source trust ranking.
- Added confidence derivation and status/source metadata in products API output.
- Hardened deduplication logic for naming variants (e.g., Mega Evolution ordering variants).
- Prevented misleading fallback pricing for Pokemon `set_default` products.
- Added cleanup pass `backfillPokemonSetDefaultPricing()` into pipeline.

## 4. Required product rules (must preserve)

- Keep SKU-level product records where available.
- Pricing display priority: `official MSRP` > `distributor preorder` > `retailer preorder` > no price.
- If trustworthy price is unavailable, return no price (not a fabricated placeholder).
- Low-confidence records should still be available to display.
- AI should extract/normalize/change-detect; it should not be the sole truth arbiter.

## 5. Runtime and environment notes

- Required:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
- Release intelligence related:
  - `POKEMON_TCG_API_KEY` (optional but recommended)
  - `OPENAI_API_KEY` (required for AI extraction stage; without it scrape AI extraction is skipped)
  - `OPENAI_EXTRACTION_MODEL` (optional override)

## 6. Known technical caveat

- In `src/releaseScrapeService.ts`, there is a type workaround:
  - `(prisma as any).releaseProductStrategy.count(...)`
- This bypasses a Prisma client typing mismatch while builds continue to pass.

## 7. TCG data layer (Phase 1 now implemented)

- New normalized schema models:
  - `Game`
  - `TcgSet`
  - `TcgCard`
  - `PriceLatest`
  - `PriceHistoryDaily`
  - `ProviderRawCache`
- Provider architecture:
  - shared interface and registry under `src/services/tcg/`
  - `PokemonTcgProvider` enabled
  - MTG/YGO registered as disabled placeholders for feature-flagged rollout
- Background sync jobs:
  - `src/jobs/tcgSyncJob.ts`
  - sets daily, cards daily, prices every 6h (plus older daily pass)
  - all reads are DB-only via `/api/tcg/*` endpoints
- New API endpoints:
  - `GET /api/tcg/games`
  - `GET /api/tcg/:game/sets`
  - `GET /api/tcg/:game/sets/:setId/cards`
  - `GET /api/tcg/:game/cards/:cardId`

## 8. Immediate next backend tasks

1. Finalize release-products API contract so trust/provenance fields are consistently present and typed.
2. Add/confirm source citations and change history payload shape for frontend display.
3. Keep validating no duplicate logical releases and no placeholder Pokemon pricing regression after sync.

## 9. Quick verification commands

```bash
# Build validation
npm run build

# Manual sync trigger
curl -X POST https://cardcommand-api-production.up.railway.app/api/admin/releases/sync \
  -H "Authorization: Bearer <JWT>"

# Inspect releases products payload
curl https://cardcommand-api-production.up.railway.app/api/releases/products

# Inspect TCG DB-backed APIs
curl https://cardcommand-api-production.up.railway.app/api/tcg/games
curl "https://cardcommand-api-production.up.railway.app/api/tcg/pokemon/sets?sort=release_date_desc"
```

---

*Last Updated: February 12, 2026*
