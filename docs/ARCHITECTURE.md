# CardCommand API - Architecture

> Source of truth for backend release intelligence and TCG data flows.

---

## Stack and Deployment

- Runtime: Node.js + TypeScript
- Framework: Express
- ORM: Prisma (PostgreSQL)
- Infra: Railway (`main` branch deploy)
- Auth: JWT bearer tokens

## Domain Layers

### 1) Release intelligence layer (sealed products)

Main files:
- `src/releaseSyncPipeline.ts`
- `src/releaseSyncService.ts`
- `src/releaseScrapeService.ts`
- `src/releaseIntelSources.ts`
- `src/controllers/releasesController.ts`

Responsibilities:
- ingest releases from deterministic and curated sources
- maintain sealed SKU rows
- enrich with market-price context
- enrich with top-chase context
- expose frontend-friendly trust/provenance fields

### 2) TCG normalized data layer (sets/cards/prices)

Main files:
- `src/services/tcg/*`
- `src/controllers/tcgController.ts`

Schema models:
- `Game`
- `TcgSet`
- `TcgCard`
- `PriceLatest`
- `PriceHistoryDaily`
- `ProviderRawCache`

Responsibilities:
- provider-based ingestion
- normalized DB-backed read APIs under `/api/tcg/*`
- future multi-game expansion

---

## Release Sync Pipeline (Detailed)

Order of operations in `runReleaseSyncPipeline()`:
1. Tier A release sync
2. Tier A link backfill
3. Pokemon `set_default` price cleanup
4. Pokemon sealed SKU row backfill
5. Sealed market pricing backfill
6. Top chases backfill
7. Tier B/C scrape upsert
8. Strategy backfill

Design intent:
- deterministic data first
- enrichment second
- UI-safe outputs (no fake confidence or fake prices)

---

## Hybrid Logic Decisions

### Sealed pricing

- Use TCGPlayer search API for best-effort pricing.
- Attempt multiple query variants (raw + normalized + alias).
- Enforce product-kind matching for concrete SKU rows.
- Allow relaxed fallback only for `set_default` placeholder products.
- If no trustworthy match: return no price.

Why:
- Prevents misleading `booster_pack` prices from appearing on `booster_box`/`ETB` rows.

### Top chases

- Primary source: price-ranked cards from normalized TCG tables.
- Fallback source: trusted editorial lists when price coverage is insufficient.
- Every fallback is provenance-tagged and exposed via API fields.

Why:
- Ensures high utility for users even when price hydration is incomplete.

---

## Provenance Encoding (Current)

- `contentsSummary` carries market tags:
  - `[market_price:...]`
  - `[market_match:...]`
- `release.description` carries chase-source tag:
  - `[top_chases_source:...]`

Controller parsing:
- `src/controllers/releasesController.ts`

Future improvement:
- move these tags to first-class DB columns to reduce parsing risk.

---

## Critical Rules

- Releases endpoint must remain sealed-product focused.
- Do not silently fabricate MSRP/resale.
- Low-confidence rows remain visible unless explicitly filtered.
- AI extraction assists normalization; it does not define truth alone.
- Preserve backward compatibility for frontend contract fields.

---

## Operational Risks

- Sync run state is in-memory today (non-durable across process restarts).
- Long-running syncs can appear stalled without granular progress telemetry.
- External source quality varies by set and by release window.

---

## Individual Card Expansion Alignment

For cards (Deals / card intelligence), reuse this architecture:
- deterministic prices as primary
- fallback data source with explicit provenance
- strict matching rules where SKU/type ambiguity can mislead users
- clear display of `as of`, source type, and confidence

---

*Last Updated: 2026-02-15*
