# TCG Data Layer (Backend)

This module provides a provider-agnostic catalog and pricing pipeline for TCG data.

## Design goals

- Read APIs serve only from DB/cache (never provider calls in request path).
- Background jobs hydrate DB from providers.
- Add new games/providers without schema refactors.

## Key pieces

- `types.ts`: provider interface + normalized record contracts.
- `config.ts`: feature flags and operational tuning values.
- `providerRegistry.ts`: maps `game.slug` to provider implementation.
- `providerRawCache.ts`: DB JSON cache for raw provider responses.
- `tcgUpsertService.ts`: upsert helpers for sets/cards/prices/history.
- `tcgSyncPipeline.ts`: orchestration for sets/cards/prices sync.
- `adapters/pokemonTcgProvider.ts`: Pokemon provider implementation.
- `adapters/disabledProvider.ts`: explicit placeholders for disabled/unimplemented providers.

## Runtime behavior

- Enabled now: `pokemon` (via `pokemontcg.io`).
- Scaffolded/disabled: `mtg`, `yugioh`.
- Jobs:
  - sets daily
  - cards daily (recent/new sets)
  - recent prices every 6h
  - older prices daily

### Manual sync observability

- `POST /api/admin/tcg/sync` starts a background sync run and returns `202` with `runId`.
- `GET /api/admin/tcg/sync/status` returns `idle|running|completed|failed` plus current/last run metadata.
- Full-sync logs include per-stage durations (sets/cards/prices) and set-card failure samples.

## Environment flags

- `TCG_SYNC_ENABLED=true` enables cron jobs.
- `TCG_POKEMON_ENABLED=true|false` toggles Pokemon provider.
- `TCG_MTG_ENABLED=true|false` / `TCG_YUGIOH_ENABLED=true|false` reserved for future adapters.
- `POKEMON_TCG_API_KEY` optional for higher limits.
- Optional tuning:
  - `TCG_RECENT_SET_WINDOW_DAYS`
  - `TCG_CARD_SYNC_CONCURRENCY`
  - `TCG_PRICE_CHUNK_SIZE`
  - `POKEMON_TCG_TIMEOUT_MS`
  - `POKEMON_TCG_RETRIES`
  - `POKEMON_TCG_RETRY_BASE_MS`

