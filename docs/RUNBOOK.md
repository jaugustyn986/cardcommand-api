[RUNBOOK.md](https://github.com/user-attachments/files/25184059/RUNBOOK.md)
# CardCommand Center - Runbook

> **Purpose:** Step-by-step procedures for running, deploying, migrating, and rolling back the CardCommand Center application.

---

## Table of Contents

1. [Local Development](#1-local-development)
2. [Database Operations](#2-database-operations)
3. [Deployment](#3-deployment)
4. [Rollback Procedures](#4-rollback-procedures)
5. [Troubleshooting](#5-troubleshooting)
6. [External API Setup](#6-external-api-setup)

---

## 1. Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Git

### Backend Setup

```bash
# 1. Clone and navigate
git clone <your-backend-repo>
cd cardcommand-api

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your values:
# DATABASE_URL="postgresql://user:pass@localhost:5432/cardcommand"
# JWT_SECRET="your-secret-key"
# JWT_EXPIRES_IN="7d"

# 4. Set up database
npx prisma migrate dev
npx prisma generate

# 5. Seed database (optional)
npx prisma db seed

# 6. Start development server
npm run dev
# Server runs on http://localhost:3001
```

### Frontend Setup

```bash
# 1. Clone and navigate
git clone <your-frontend-repo>
cd cardcommand-frontend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env:
# VITE_API_URL="http://localhost:3001/api"

# 4. Start development server
npm run dev
# App runs on http://localhost:5173
```

### Verify Local Setup

```bash
# Backend health check
curl http://localhost:3001/health

# Test API
curl http://localhost:3001/api/releases

# Frontend should load and show deals
open http://localhost:5173
```

---

## 2. Database Operations

### Create Migration

```bash
# After modifying schema.prisma
npx prisma migrate dev --name add_new_feature

# This will:
# 1. Create migration file in prisma/migrations/
# 2. Apply migration to database
# 3. Regenerate Prisma client
```

### Apply Migrations (Production)

```bash
# In Railway or production environment
npx prisma migrate deploy

# This applies pending migrations without creating new ones
```

### Reset Database (⚠️ Destructive)

```bash
# ⚠️ WARNING: This deletes all data!
npx prisma migrate reset

# Use for:
# - Local development reset
# - Fresh start after schema changes
```

### View Database

```bash
# Open Prisma Studio (GUI)
npx prisma studio

# Or use psql
psql $DATABASE_URL
```

### Backup Database

```bash
# Using pg_dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# In Railway:
# 1. Go to Railway dashboard
# 2. Select PostgreSQL service
# 3. Click "Backups" tab
# 4. Click "Create Backup"
```

### Restore Database

```bash
# From SQL file
psql $DATABASE_URL < backup_20240209.sql

# In Railway:
# 1. Go to Railway dashboard
# 2. Select PostgreSQL service
# 3. Click "Backups" tab
# 4. Select backup and click "Restore"
```

---

## 3. Deployment

### Backend Deployment (Railway)

#### Automatic Deployment
```
1. Push to main branch
2. Railway auto-detects and deploys
3. View logs in Railway dashboard
```

#### Manual Deployment
```bash
# Using Railway CLI
npm install -g @railway/cli
railway login
railway link
railway up
```

#### Environment Variables (Railway)
```
Required:
- DATABASE_URL (auto-set by Railway PostgreSQL)
- JWT_SECRET (generate: openssl rand -base64 32)
- JWT_EXPIRES_IN="7d"
- NODE_ENV="production"

Optional:
- POKEMON_TCG_API_KEY (for Pokemon sync)
- OPENAI_API_KEY (for AI extraction in scrape stage)
- OPENAI_EXTRACTION_MODEL (optional model override)
- TCG_SYNC_ENABLED="true" (enable TCG data layer cron jobs)
- TCG_POKEMON_ENABLED="true" (enabled unless set to false)
```

#### Health Check
```bash
# After deployment
curl https://cardcommand-api-production.up.railway.app/health

# Should return: { "status": "ok" }
```

### Frontend Deployment (Vercel)

#### Automatic Deployment
```
1. Push to main branch
2. Vercel auto-detects and deploys
3. View build logs in Vercel dashboard
```

#### Environment Variables (Vercel)
```
Required:
- VITE_API_URL="https://cardcommand-api-production.up.railway.app/api"
```

#### Manual Deployment
```bash
# Using Vercel CLI
npm install -g vercel
vercel login
vercel --prod
```

---

## 4. Rollback Procedures

### Backend Rollback

#### Option 1: Revert Commit
```bash
# Revert last commit
git revert HEAD

# Push to trigger new deployment
git push origin main
```

#### Option 2: Railway Dashboard
```
1. Go to Railway dashboard
2. Select your service
3. Click "Deployments"
4. Find previous working deployment
5. Click "Redeploy"
```

#### Option 3: Railway CLI
```bash
railway logs  # View recent logs
railway down  # Stop service (emergency)
railway up    # Restart service
```

### Frontend Rollback

#### Option 1: Revert Commit
```bash
git revert HEAD
git push origin main
```

#### Option 2: Vercel Dashboard
```
1. Go to Vercel dashboard
2. Select your project
3. Click "Deployments"
4. Find previous working deployment
5. Click "..." → "Promote to Production"
```

### Database Rollback

#### Rollback Migration
```bash
# ⚠️ WARNING: May cause data loss!
# Rollback last migration
npx prisma migrate resolve --rolled-back <migration-name>

# Or reset and reapply
npx prisma migrate reset
npx prisma migrate deploy
```

#### Restore from Backup
```bash
# Restore from SQL backup
psql $DATABASE_URL < backup_20240209.sql
```

---

## 5. Troubleshooting

### Backend Issues

#### Build Fails
```bash
# Check TypeScript errors
npm run build

# Common fixes:
# 1. Missing types
npm install --save-dev @types/node @types/express

# 2. Prisma client not generated
npx prisma generate

# 3. Clean install
rm -rf node_modules package-lock.json
npm install
```

#### Database Connection Fails
```bash
# Test connection
npx prisma db pull

# Check DATABASE_URL format
# postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Verify PostgreSQL is running
pg_isready -h localhost -p 5432
```

#### API Returns 500
```bash
# Check Railway logs
railway logs

# Common causes:
# 1. Missing environment variables
# 2. Database connection issue
# 3. Unhandled exception
```

### Frontend Issues

#### Build Fails
```bash
# Check TypeScript errors
npm run build

# Common fixes:
# 1. Missing types
npm install --save-dev @types/react @types/react-dom

# 2. Import path issues
# Check tsconfig.json paths

# 3. Clean install
rm -rf node_modules package-lock.json
npm install
```

#### API Calls Fail (CORS)
```bash
# Check CORS configuration in backend
# Should include frontend URL:
# origin: ['https://cardcommand-frontend.vercel.app']
```

### Database Issues

#### Migration Fails
```bash
# Check migration status
npx prisma migrate status

# Mark migration as applied (if manually fixed)
npx prisma migrate resolve --applied <migration-name>

# Reset (⚠️ destructive)
npx prisma migrate reset
```

#### Data Corruption
```bash
# Restore from backup
psql $DATABASE_URL < backup_file.sql

# Or contact Railway support for point-in-time recovery
```

---

## 6. External API Setup

### Pokémon TCG API

#### Get API Key (Optional but recommended)
```
1. Go to https://pokemontcg.io/
2. Click "Get API Key"
3. Sign up for free tier (1000 requests/day)
4. Copy API key
```

#### Configure
```bash
# Add to backend .env
POKEMON_TCG_API_KEY="your-api-key"
TCG_SYNC_ENABLED="true"
TCG_POKEMON_ENABLED="true"

# Redeploy backend
railway up
```

#### Test
```bash
# Trigger sync
curl -X POST https://cardcommand-api-production.up.railway.app/api/admin/releases/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check status
curl https://cardcommand-api-production.up.railway.app/api/admin/releases/status

# Verify data in app
# - Open frontend: https://cardcommand-frontend.vercel.app
# - Switch to Releases tab
# - Filter by category (e.g. Pokemon, MTG) and confirm recent sets appear with correct dates/hype scores

# TCG Data Layer endpoints (DB-backed reads)
curl https://cardcommand-api-production.up.railway.app/api/tcg/games
curl "https://cardcommand-api-production.up.railway.app/api/tcg/pokemon/sets?sort=release_date_desc"
# replace <setId> with a real set row ID from response
curl "https://cardcommand-api-production.up.railway.app/api/tcg/pokemon/sets/<setId>/cards?page=1&perPage=50"
# replace <cardId> with a real card ID from response
curl "https://cardcommand-api-production.up.railway.app/api/tcg/pokemon/cards/<cardId>"
```

#### Release images
- **Pokemon TCG**: Sync sets `imageUrl` from the set’s `images.logo` when syncing from the Pokemon TCG API.
- **Scryfall (MTG)**: Sync sets `imageUrl` from the set’s `icon_svg_uri` (SVG).
- The Releases UI shows `imageUrl` when present; otherwise it uses a category placeholder. Run the release sync (see Test above) so new/updated sets get images.

### Validating Live Data in the Frontend

```bash
# Deals
curl https://cardcommand-api-production.up.railway.app/api/deals

# Portfolio (requires auth)
curl https://cardcommand-api-production.up.railway.app/api/portfolio \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Trending + Heatmap
curl https://cardcommand-api-production.up.railway.app/api/trending
curl https://cardcommand-api-production.up.railway.app/api/trending/heatmap
```

- Open `https://cardcommand-frontend.vercel.app`
- Verify:
  - Deals tab shows live deals and no longer uses purely mock data
  - Portfolio tab prompts unauthenticated users to sign in and shows live items once authenticated
  - Trending tab shows live cards when available and falls back to sample data otherwise
  - Releases tab is populated from synced Pokemon/Scryfall data

### Scryfall API (MTG)

#### No API Key Required
```
Scryfall is free and requires no authentication
Rate limit: 100 req/sec burst, 10 req/sec sustained
```

#### Test
```bash
# Test API directly
curl https://api.scryfall.com/sets

# Test backend integration
curl https://cardcommand-api-production.up.railway.app/api/admin/health
```

### Release scrape (OpenAI) – product-level data

After each **Sync releases** run, the backend executes a unified release pipeline that can combine deterministic and AI-assisted extraction to produce product-level rows (ETBs, booster boxes, tins, and set-default entries when only set-level data exists).

#### Get API key
```
1. Go to https://platform.openai.com/api-keys
2. Create an API key
3. Add to Railway (or .env): OPENAI_API_KEY="sk-..."
```

#### Configure
```bash
# Backend .env or Railway variables
OPENAI_API_KEY="sk-..."                    # Required for scrape step
OPENAI_EXTRACTION_MODEL="gpt-4o-mini"      # Optional; default gpt-4o-mini
```

If `OPENAI_API_KEY` is not set, the scrape step is skipped and sync still completes using Pokemon/MTG APIs only.

#### Whitelisted sources (in code)
- Tier/source registry is defined in `src/releaseIntelSources.ts` (`RELEASE_INTEL_SOURCES`).
- Tier A includes deterministic APIs (Pokemon TCG API, Scryfall, pokemon.com expansions API).
- Tier B/C include curated pages and source-specific parsing/extraction.

### Release intel pipeline (Phase 1)

- **Source registry:** `src/releaseIntelSources.ts` – Tier A (APIs), Tier B (fetch + AI extract). Tier B runs after each “Sync releases.”
- **Change log:** When a product’s `releaseDate`, `preorderDate`, `msrp`, or `estimatedResale` changes, a row is written to `release_product_changes`.
- **APIs:**
  - `GET /api/releases/products?confidence=confirmed` – optional filter by confidence.
  - `GET /api/releases/changes?limit=50&since=ISO_DATE` – recent changes for “what changed” UX.
- **Schema:** `ReleaseProduct` has `sourceTier`, `sourceUrl`, `confidence`; new table `release_product_changes` stores field-level diffs. Run `npx prisma db push` (or migrate) after pulling.

### Release sync pipeline operations

- Manual trigger endpoint: `POST /api/admin/releases/sync`.
- Cron schedule: `06:00`, `12:00`, `18:00` UTC (`src/jobs/releaseSyncJob.ts`).
- Shared orchestration entrypoint: `src/releaseSyncPipeline.ts`.
- Pipeline stages include:
  1. Tier A sync
  2. Tier A link backfill
  3. Pokemon set-default pricing cleanup
  4. Tier B/C scrape-and-upsert
  5. strategy backfill
- If `OPENAI_API_KEY` is absent, AI extraction is skipped but deterministic stages continue.

---

### eBay API (Future)

#### Get Credentials
```
1. Go to https://developer.ebay.com/
2. Create developer account
3. Create app
4. Get App ID (Client ID) and Cert ID (Client Secret)
5. Generate OAuth tokens
```

#### Configure
```bash
# Add to backend .env
EBAY_APP_ID="your-app-id"
EBAY_CERT_ID="your-cert-id"
EBAY_DEV_ID="your-dev-id"
EBAY_REDIRECT_URI="https://your-app.com/callback"
```

---

## 7. Common Commands Reference

### Backend
```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Start production server

# Database
npx prisma migrate dev      # Create migration
npx prisma migrate deploy   # Apply migrations
npx prisma generate         # Generate client
npx prisma studio           # Open GUI
npx prisma db seed          # Run seed script

# Testing
npm test             # Run tests
npm run lint         # Run linter
```

### Frontend
```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Testing
npm test             # Run tests
npm run lint         # Run linter
```

---

## 8. Emergency Contacts

| Service | Support |
|---------|---------|
| Railway | https://railway.app/help |
| Vercel | https://vercel.com/help |
| PostgreSQL | https://www.postgresql.org/support/ |
| Prisma | https://www.prisma.io/support |

---

*Last Updated: February 9, 2026 (release intelligence sync update)*
*Maintained by: CardCommand Team*
