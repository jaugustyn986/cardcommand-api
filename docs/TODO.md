# CardCommand API - TODO

> Priority roadmap for release intelligence, pricing integrity, and hybrid provenance.

---

## P0 (current)

- [ ] Add persistence for release sync run-state (DB-backed `currentRun/lastRun`).
- [ ] Add automated tests for sealed SKU kind-strict pricing behavior.
- [ ] Add automated tests for hybrid top-chase fallback and provenance tags.
- [ ] Instrument per-query pricing diagnostics (query used, matched kind, rejection reason).

## P1 (next)

- [ ] Add secondary sealed fallback source (sold-listing median) with explicit provenance.
- [ ] Move tag-based provenance (`market_*`, `top_chases_source`) to first-class DB fields.
- [ ] Add endpoint-level metrics for sync stage durations and failures.
- [ ] Tighten source-corroboration scoring in scrape merge logic.

## P2 (forward)

- [ ] Extend hybrid provenance model to individual-card surfaces (Deals / chase intelligence).
- [ ] Add card-level confidence model (pricing confidence vs source confidence).
- [ ] Expand enabled provider set beyond Pokemon with same normalization guarantees.

## Known Caveats

- Release sync status is currently process-memory state.
- External marketplace results vary by release naming quality and listing freshness.
- `OPENAI_API_KEY` absent -> AI extraction path skips, deterministic layers still run.

---

*Last Updated: 2026-02-15*
