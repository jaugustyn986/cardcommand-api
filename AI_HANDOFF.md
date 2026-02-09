# CardCommand Center - AI Handoff Document

> **Project Status:** Backend API deployed on Railway, Frontend deployed on Vercel. Core features functional (Deals, Releases, Trending tabs). Ready for live data integration and feature expansion.

---

## 1. Pages and Routes

### Frontend Routes (Vercel)

| Route | Page Component | Visibility | Description |
|-------|---------------|------------|-------------|
| `/` | `App` (tab-based) | Public | Main app with tab navigation (Deals, Portfolio, Trending, Releases) |
| N/A | `AuthModal` | Modal overlay | Login/Register modal triggered from Navbar |
| N/A | `StrategyModal` | Modal overlay | Shows deal strategy analysis |

### Backend API Routes (Railway)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | Public | User registration |
| `/api/auth/login` | POST | Public | User login |
| `/api/auth/me` | GET | Required | Get current user |
| `/api/auth/logout` | POST | Required | Logout user |
| `/api/auth/refresh` | POST | Required | Refresh JWT token |
| `/api/deals` | GET | Optional | List deals with filters |
| `/api/deals/:id` | GET | Optional | Get single deal |
| `/api/deals/:id/track` | POST | Required | Track a deal |
| `/api/deals/:id/track` | DELETE | Required | Untrack a deal |
| `/api/deals/tracked/list` | GET | Required | Get user's tracked deals |
| `/api/portfolio` | GET | Required | Get user's portfolio |
| `/api/portfolio` | POST | Required | Add portfolio item |
| `/api/portfolio/:id` | PATCH | Required | Update portfolio item |
| `/api/portfolio/:id` | DELETE | Required | Delete portfolio item |
| `/api/portfolio/stats` | GET | Required | Get portfolio statistics |
| `/api/releases` | GET | Optional | List upcoming releases |
| `/api/releases/:id` | GET | Optional | Get single release |
| `/api/releases/:id/remind` | POST | Required | Set release reminder |
| `/api/releases/:id/remind` | DELETE | Required | Remove release reminder |
| `/api/trending` | GET | Optional | Get trending items |
| `/api/trending/heatmap` | GET | Optional | Get market heatmap data |
| `/api/admin/releases/sync` | POST | Required | Trigger manual release sync |
| `/api/admin/releases/status` | GET | Required | Get release sync status |
| `/api/admin/health` | GET | Public | Check API health |

---

## 2. Component Map

### Frontend Components (`/src/components/`)

| Component | Props | Purpose | Appears On |
|-----------|-------|---------|------------|
| `Navbar` | `onLoginClick, onRegisterClick` | Top navigation with auth buttons | All pages |
| `DealCard` | `deal: Deal, onClick` | Display deal with savings % | Deals tab |
| `PortfolioCard` | `item: PortfolioItem` | Display portfolio item with profit/loss | Portfolio tab |
| `TrendingCard` | `item: TrendingItem` | Display trending card with price change | Trending tab (legacy) |
| `ReleaseCard` | `release: Release` | Display release with countdown | Releases tab |
| `StrategyBadge` | `strategy: Strategy` | Show strategy recommendation badge | DealCard |
| `Heatmap` | None | Market heatmap visualization | Trending tab |

### Frontend Sections (`/src/sections/` - Landing Page Components)

| Component | Purpose | Notes |
|-----------|---------|-------|
| `Hero` | Landing hero with CTA | Marketing page only |
| `DealFeed` | Featured deals section | Marketing page only |
| `ReleaseCalendar` | Upcoming releases preview | Marketing page only |
| `Portfolio` | Portfolio tracking showcase | Marketing page only |
| `Trending` | Trending cards + heatmap | Marketing page only |
| `GradingROI` | Grading calculator section | Marketing page only |
| `SocialSignals` | Social proof section | Marketing page only |
| `Pricing` | Pricing plans | Marketing page only |
| `FAQ` | Frequently asked questions | Marketing page only |
| `Testimonials` | User testimonials | Marketing page only |
| `FinalCTA` | Final call-to-action | Marketing page only |
| `Footer` | Site footer | Marketing page only |

### Modals (`/src/components/modals/`)

| Component | Props | Purpose |
|-----------|-------|---------|
| `AuthModal` | `mode, isOpen, onClose, onSwitchMode` | Login/Register modal |
| `StrategyModal` | `deal, onClose` | Show detailed strategy analysis |

### Shared UI Primitives

| Component | Location | Purpose |
|-----------|----------|---------|
| `Button` | `shadcn/ui` | Primary/secondary buttons |
| `Input` | `shadcn/ui` | Form inputs |
| `Card` | `shadcn/ui` | Card containers |
| `Badge` | `shadcn/ui` | Status badges |
| `Dialog` | `shadcn/ui` | Modal dialogs |
| `LoadingState` | `src/components/ui/` | Loading spinner |
| `ErrorState` | `src/components/ui/` | Error display with retry |

### Custom Hooks (`/src/hooks/`)

| Hook | Purpose | Returns |
|------|---------|---------|
| `useDeals` | Fetch deals | `{ data, isLoading, error, refetch }` |
| `usePortfolio` | Fetch portfolio | `{ data, isLoading, error, refetch }` |
| `useTrending` | Fetch trending | `{ data, isLoading, error, refetch }` |
| `useReleases` | Fetch releases | `{ data, isLoading, error, refetch }` |
| `useAuth` | Auth context | `{ user, login, register, logout, isLoading }` |

---

## 3. Data Requirements Per Page

### Deals Tab

**Data Entities:**
- `Deal` - Card deals with pricing, savings, strategy

**Operations:**
- READ: List deals with pagination, filters (category, price, grade)
- READ: Get single deal details
- WRITE: Track/untrack deal (authenticated)

**States:**
- Loading: Skeleton cards
- Empty: "No deals found" message
- Error: Retry button

### Portfolio Tab

**Data Entities:**
- `PortfolioItem` - User's card collection
- `PortfolioStats` - Aggregated statistics

**Operations:**
- READ: List portfolio items
- READ: Get portfolio stats
- WRITE: Add item
- WRITE: Update item
- WRITE: Delete item

**States:**
- Loading: Skeleton cards
- Empty: "Your portfolio is empty" CTA
- Error: Retry button

### Trending Tab

**Data Entities:**
- `TrendingItem` - Cards with price changes, volume
- `HeatmapData` - Aggregated market data

**Operations:**
- READ: List trending items
- READ: Get heatmap data

**States:**
- Loading: Skeleton + "Loading heatmap..."
- Empty: Static fallback bubbles
- Error: Retry button

### Releases Tab

**Data Entities:**
- `Release` - Upcoming card set releases

**Operations:**
- READ: List releases with filters
- WRITE: Set reminder (authenticated)

**States:**
- Loading: Skeleton cards
- Empty: "No upcoming releases"
- Error: Retry button

---

## 4. API Integrations

### External APIs (Implemented)

#### 1. Pokémon TCG API
- **URL:** `https://api.pokemontcg.io/v2/`
- **Auth:** Optional API key (free tier available)
- **Data Pulled:** Sets, cards, release dates
- **Rate Limit:** 1000 requests/day (free), 10k/day (paid)
- **Endpoints Used:**
  - `GET /sets` - List all sets
- **Sync Frequency:** Daily via admin endpoint

#### 2. Scryfall API (Magic: The Gathering)
- **URL:** `https://api.scryfall.com/`
- **Auth:** None required
- **Data Pulled:** MTG sets, release dates, card counts
- **Rate Limit:** 100 requests/second (burst), 10 requests/second (sustained)
- **Endpoints Used:**
  - `GET /sets` - List all sets
- **Sync Frequency:** Daily via admin endpoint

### Internal API (Backend)

**Base URL:** `https://cardcommand-api-production.up.railway.app/api`

**Auth Method:** JWT Bearer token
```
Authorization: Bearer <jwt_token>
```

**Example Request/Response:**
```http
GET /api/releases

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "2024-25 Panini Prizm Basketball",
      "releaseDate": "2025-02-15T00:00:00.000Z",
      "category": "basketball",
      "manufacturer": "Panini",
      "msrp": 800,
      "estimatedResale": 1200,
      "hypeScore": 9.2,
      "topChases": ["Victor Wembanyama Rookie", "Chet Holmgren Silver"],
      "isReleased": false
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalCount": 50,
    "totalPages": 3
  }
}
```

---

## 5. Auth + Roles

### User Roles

| Role | Permissions |
|------|-------------|
| `free` | View deals, releases, trending; Track limited deals (5); Basic portfolio |
| `premium` | Unlimited deal tracking; Full portfolio; Release reminders; Advanced analytics |
| `pro` | All premium features + API access; Priority support; Custom alerts |

### Protected Routes

| Route | Required Auth | Notes |
|-------|---------------|-------|
| `/api/portfolio/*` | JWT Required | User-specific data |
| `/api/deals/:id/track` | JWT Required | User-specific tracking |
| `/api/releases/:id/remind` | JWT Required | User-specific reminders |
| `/api/admin/*` | JWT Required | Admin operations |

### Onboarding Flow

1. User lands on marketing page
2. Clicks "Get Started" → Opens AuthModal (register mode)
3. Registers → Auto-login → Redirect to Deals tab
4. Optional: Upgrade to premium via Pricing page

---

## 6. DB Schema Proposal

### Current Schema (PostgreSQL + Prisma)

```prisma
// Users
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // Hashed with bcrypt
  name      String?
  plan      Plan     @default(free) // free | premium | pro
  status    UserStatus @default(active)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  preferences UserPreferences?
  portfolio   PortfolioItem[]
  trackedDeals TrackedDeal[]
  releaseReminders ReleaseReminder[]
}

// Deals
model Deal {
  id              String    @id @default(uuid())
  cardName        String
  cardSet         String
  year            Int
  cardNumber      String?
  variation       String?
  grade           String
  grader          String?
  marketPrice     Decimal   @db.Decimal(10, 2)
  dealPrice       Decimal   @db.Decimal(10, 2)
  savingsPercent  Decimal   @db.Decimal(5, 2)
  savingsAmount   Decimal   @db.Decimal(10, 2)
  marketplace     String
  sellerRating    Decimal   @db.Decimal(3, 1)
  sellerFeedback  Int
  listingUrl      String
  imageUrl        String?
  category        Category
  liquidity       Liquidity
  lastSoldPrice   Decimal?  @db.Decimal(10, 2)
  thirtyDayAvg    Decimal?  @db.Decimal(10, 2)
  ninetyDayTrend  Decimal?  @db.Decimal(5, 2)
  popGraded       Int?
  popGrade10      Int?
  isActive        Boolean   @default(true)
  expiresAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  trackedBy TrackedDeal[]
  
  @@index([category])
  @@index([isActive])
  @@index([createdAt])
  @@index([savingsPercent])
  @@map("deals")
}

// Portfolio
model PortfolioItem {
  id            String   @id @default(uuid())
  userId        String
  cardName      String
  cardSet       String
  year          Int
  grade         String
  grader        String?
  currentValue  Decimal  @db.Decimal(10, 2)
  purchasePrice Decimal  @db.Decimal(10, 2)
  purchaseDate  DateTime @default(now())
  quantity      Int      @default(1)
  imageUrl      String?
  notes         String?
  inGradingQueue Boolean @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@map("portfolio_items")
}

// Releases
model Release {
  id              String   @id @default(uuid())
  name            String
  releaseDate     DateTime
  category        Category
  manufacturer    String
  msrp            Decimal  @db.Decimal(10, 2)
  estimatedResale Decimal? @db.Decimal(10, 2)
  hypeScore       Decimal? @db.Decimal(3, 1)
  imageUrl        String?
  topChases       String[] @default([])
  printRun        String?
  description     String?
  isReleased      Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  reminders ReleaseReminder[]
  
  @@index([releaseDate])
  @@index([category])
  @@map("releases")
}

// Trending
model TrendingItem {
  id              String    @id @default(uuid())
  cardName        String
  cardSet         String
  category        Category
  currentPrice    Decimal   @db.Decimal(10, 2)
  priceChange24h  Decimal   @db.Decimal(5, 2)
  priceChange7d   Decimal   @db.Decimal(5, 2)
  priceChange30d  Decimal   @db.Decimal(5, 2)
  volumeIncrease  Int
  searchVolume    Int
  sentiment       Sentiment @default(Neutral)
  calculatedAt    DateTime  @default(now())
  
  @@index([category])
  @@index([calculatedAt])
  @@map("trending_items")
}

// Enums
enum Plan { free, premium, pro }
enum UserStatus { active, suspended, deleted }
enum Category { basketball, baseball, football, hockey, soccer, pokemon, mtg, yugioh, one_piece, digimon, lorcana }
enum Liquidity { High, Medium, Low }
enum Sentiment { Bullish, Bearish, Neutral }
```

### Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `deals` | `category` | Filter by category |
| `deals` | `isActive` | Show active only |
| `deals` | `savingsPercent` | Sort by best deals |
| `releases` | `releaseDate` | Sort by date |
| `portfolio_items` | `userId` | User's portfolio |
| `trending_items` | `category, calculatedAt` | Latest trending by category |

---

## 7. Nonfunctional Requirements

### Performance

| Metric | Target |
|--------|--------|
| Page Load | < 2s (First Contentful Paint) |
| API Response | < 200ms (p95) |
| Deal Feed | < 500ms to render 20 items |
| Heatmap | < 1s to load and render |

### SEO (Marketing Pages)

- SSR/SSG for landing page content
- Meta tags for each section
- Open Graph tags for social sharing
- Structured data (JSON-LD) for deals/releases

### Logging/Monitoring

- **Backend:** Console logs for errors, API calls
- **Frontend:** React Query devtools (dev only)
- **Future:** Sentry integration for error tracking

### Security

- **NEVER** expose API keys in frontend
- JWT stored in httpOnly cookies (preferred) or secure localStorage
- Rate limiting on auth endpoints
- Input validation on all API routes
- SQL injection protection via Prisma ORM

---

## 8. Acceptance Criteria (v1)

### Core Features (Done ✓)

- [x] User can view deals with savings % and strategy badges
- [x] User can view releases with countdown and hype scores
- [x] User can view trending with price changes and heatmap
- [x] User can register/login
- [x] User can track deals (authenticated)
- [x] User can view portfolio (authenticated)
- [x] Backend API deployed on Railway
- [x] Frontend deployed on Vercel
- [x] PostgreSQL database connected

### In Progress 🔄

- [ ] Live data sync from Pokémon TCG API
- [ ] Live data sync from Scryfall API
- [ ] Sports card release data (scraping or paid API)

### Next Phase (v1.1)

- [ ] Deal price tracking over time
- [ ] Price alerts (email/push)
- [ ] Portfolio value chart
- [ ] Strategy engine with ML recommendations
- [ ] Mobile app (React Native)

### Known Issues

1. **Trending tab** - Currently uses mock data; needs live price feeds
2. **Sports cards** - No free API available; needs scraping solution
3. **Deal sourcing** - Currently manual; needs eBay/TCGPlayer API integration

---

## 9. Deployment Info

### Backend (Railway)

- **URL:** `https://cardcommand-api-production.up.railway.app`
- **Database:** PostgreSQL (managed by Railway)
- **Environment Variables:**
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `POKEMON_TCG_API_KEY` (optional)

### Frontend (Vercel)

- **URL:** `https://cardcommand-frontend.vercel.app`
- **Environment Variables:**
  - `VITE_API_URL=https://cardcommand-api-production.up.railway.app/api`

---

## 10. Quick Start for New Developer

```bash
# Backend
npm install
npx prisma generate
npm run dev

# Frontend
npm install
npm run dev

# Trigger release sync (after deployment)
curl -X POST https://cardcommand-api-production.up.railway.app/api/admin/releases/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

*Last Updated: February 9, 2026*
*Built by: Kimi (Moonshot AI) + jaugustyn986*
