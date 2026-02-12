# CardCommand API - TODO

> Scope: backend release intelligence and trust/provenance API quality.

---

## P0 (active now)

- [ ] Finalize `/api/releases/products` contract for trust/provenance fields:
  - `status`
  - `sourceType`
  - `confidenceScore`
  - source citations/change-log payload shape used by frontend.
- [ ] Ensure pricing integrity rule is enforced everywhere:
  - `official MSRP` > `distributor preorder` > `retailer preorder` > no price.
- [ ] Add regression guardrails for duplicate set naming variants in products response.
- [ ] Verify low-confidence rows are returned (not filtered out by default).

## P1 (next)

- [ ] Add tests around dedupe identity and completeness scoring in `releasesController`.
- [ ] Add tests for Pokemon `set_default` no-placeholder-price behavior.
- [ ] Tighten source corroboration scoring and confidence normalization.
- [ ] Add structured logging around per-source scrape outcomes.

## P2 (after trust UX ships)

- [ ] Implement real market data integrations in `marketDataService.ts` (TCGPlayer/eBay).
- [ ] Wire external market prices into strategy payloads and product valuation fields.
- [ ] Expand non-Pokemon/MTG source adapters with same source-typing model.

## Known caveats

- Type workaround exists in `releaseScrapeService.ts` for `releaseProductStrategy` Prisma typing.
- AI extraction path requires `OPENAI_API_KEY`; without it, pipeline still runs Tier A and deterministic paths.

---

*Last Updated: February 9, 2026*
