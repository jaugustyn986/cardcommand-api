# CardCommand API - Runbook

> Operational runbook for local/dev/prod release intelligence workflows.

---

## 1) Local Setup

```bash
cd cardcommand-api
npm install
npx prisma generate
npm run dev
```

Required local env:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

Recommended for release features:
- `POKEMON_TCG_API_KEY`
- `OPENAI_API_KEY`
- `TCG_SYNC_ENABLED=true`
- `TCG_POKEMON_ENABLED=true`

---

## 2) Build and Sanity

```bash
npm run build
```

If TypeScript fails with missing Prisma models:
```bash
npx prisma generate
npm run build
```

---

## 3) Deploy (Railway)

Primary path:
- push to `main` (auto deploy)

Manual path:
```bash
npx @railway/cli login
npx @railway/cli status
npx @railway/cli deployment up
npx @railway/cli deployment list
```

---

## 4) Release Sync Operations

### Trigger

`POST /api/admin/releases/sync` (JWT required)

### Status

`GET /api/admin/releases/sync/status` (JWT required)

Notes:
- run-state is currently in-memory
- `lastRun` can be `null` after deploy restart
- long runs can stay `running` for several minutes

### Production quick-check

```bash
curl "https://cardcommand-api-production.up.railway.app/api/releases/products?category=pokemon&perPage=200"
```

Verify:
- sealed SKUs present (`booster_box`, `booster_bundle`, `elite_trainer_box`)
- no misleading cross-kind price matches
- top chase fields and provenance fields are present

---

## 5) Pricing + Chase Troubleshooting

### Symptom: SKU shows wrong match type (pack on box/ETB)

Check:
- `marketPriceContext.matchedProductType`
- `marketPriceContext.matchedProductName`

Expected:
- concrete SKU rows are kind-strict
- if no safe match exists, SKU should show no market price

### Symptom: no top chases for a set

Check:
- TCG card prices availability for the set
- fallback editorial mapping in `src/services/release/editorialTopChases.ts`

Expected:
- price-ranked when enough priced cards exist
- editorial fallback otherwise

---

## 6) Rollback

Fast rollback:
1. `git revert <bad_commit>`
2. push to `main`
3. confirm Railway deployment success

Manual rollback:
- Railway dashboard -> deployments -> redeploy prior successful deployment

---

## 7) High-Value Endpoints

- `GET /api/releases/products`
- `GET /api/releases/changes`
- `POST /api/admin/releases/sync`
- `GET /api/admin/releases/sync/status`
- `POST /api/admin/tcg/sync`
- `GET /api/admin/tcg/sync/status`
- `GET /api/tcg/games`
- `GET /api/tcg/:game/sets`
- `GET /api/tcg/:game/sets/:setId/cards`

---

## 8) What To Improve Next

- Persist run state to DB for durable status.
- Add explicit pricing-attempt telemetry per SKU/query.
- Add secondary market fallback (e.g., sold-listing median) with explicit provenance.
- Reuse hybrid provenance model for individual-card recommendation surfaces.

---

*Last Updated: 2026-02-15*
