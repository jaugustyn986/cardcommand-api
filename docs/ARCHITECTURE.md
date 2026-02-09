[ARCHITECTURE (1).md](https://github.com/user-attachments/files/25184028/ARCHITECTURE.1.md)
# CardCommand Center - Architecture & Technical Rules

> **Purpose:** Define the technical constraints, patterns, and rules that govern the CardCommand Center codebase.

---

## 1. Tech Stack

### Backend
| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Node.js | 18.x |
| Framework | Express | 4.x |
| Language | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 15.x |
| Auth | JWT (jsonwebtoken) | 9.x |
| HTTP Client | Axios | 1.x |

### Frontend
| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 18.x |
| Build Tool | Vite | 5.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Library | shadcn/ui | Latest |
| State Management | React Query (TanStack) | 5.x |
| Routing | React Router | 6.x |

---

## 2. Project Structure

### Backend (`/api/`)
```
api/
├── src/
│   ├── config/          # Database, env config
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Auth, validation
│   ├── routes/          # Route definitions
│   ├── services/        # Business logic
│   ├── jobs/            # Scheduled tasks
│   ├── scripts/         # One-off scripts
│   ├── types/           # TypeScript types
│   └── index.ts         # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
├── Dockerfile           # Container config
└── package.json
```

### Frontend (`/app/`)
```
app/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── modals/      # Modal dialogs
│   │   └── ui/          # shadcn/ui components
│   ├── sections/        # Landing page sections
│   ├── hooks/           # Custom React hooks
│   ├── contexts/        # React contexts
│   ├── services/        # API clients
│   ├── types/           # TypeScript types
│   ├── data/            # Mock data
│   ├── lib/             # Utility functions
│   ├── App.tsx          # Main app
│   └── main.tsx         # Entry point
├── public/              # Static assets
└── package.json
```

---

## 3. Naming Conventions

### Files
| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `DealCard.tsx` |
| Hooks | camelCase with `use` prefix | `useDeals.ts` |
| Services | camelCase | `api.ts` |
| Controllers | camelCase | `dealsController.ts` |
| Types | PascalCase | `Deal.ts` |
| Constants | UPPER_SNAKE_CASE | `API_URL` |

### Variables
| Type | Pattern | Example |
|------|---------|---------|
| React Components | PascalCase | `DealCard` |
| Functions | camelCase | `getDeals()` |
| Boolean | is/has/should prefix | `isLoading`, `hasError` |
| Arrays | Plural noun | `deals`, `users` |
| Event Handlers | handle prefix | `handleClick` |

### Database
| Type | Pattern | Example |
|------|---------|---------|
| Tables | snake_case | `deals`, `portfolio_items` |
| Columns | snake_case | `card_name`, `created_at` |
| Enums | PascalCase | `Plan`, `Category` |

---

## 4. Code Patterns

### Backend Controllers
```typescript
// ALWAYS use this pattern
export const getDeals = async (req: Request, res: Response) => {
  try {
    // 1. Extract params/query/body
    const { page = '1', perPage = '20' } = req.query;
    
    // 2. Call service/repository
    const deals = await prisma.deal.findMany({...});
    
    // 3. Return standardized response
    res.json({
      success: true,
      data: deals,
      pagination: { page, perPage, totalCount, totalPages }
    });
  } catch (error) {
    // 4. Handle errors consistently
    console.error('Error fetching deals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deals'
    });
  }
};
```

### Frontend Hooks (React Query)
```typescript
// ALWAYS use this pattern
export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const response = await api.get('/deals');
      return response.data.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

### API Calls
```typescript
// ALWAYS use the api service
import { api } from '@/services/api';

// GET
const response = await api.get('/deals', { params: { page: 1 } });

// POST
const response = await api.post('/portfolio', { cardName: '...' });

// PATCH
const response = await api.patch(`/portfolio/${id}`, { currentValue: 100 });

// DELETE
const response = await api.delete(`/portfolio/${id}`);
```

---

## 5. Database Rules

### Schema Changes
1. **NEVER** modify existing migrations
2. **ALWAYS** create new migrations: `npx prisma migrate dev --name <name>`
3. **ALWAYS** regenerate client after schema changes: `npx prisma generate`
4. **TEST** migrations locally before deploying

### Query Rules
```typescript
// ✅ GOOD: Use Prisma ORM
const deals = await prisma.deal.findMany({
  where: { category: 'pokemon' },
  orderBy: { createdAt: 'desc' },
  take: 20,
});

// ❌ BAD: Never use raw SQL unless necessary
const deals = await prisma.$queryRaw`SELECT * FROM deals`;
```

### Indexing
- Add indexes on frequently queried columns
- Add indexes on foreign keys
- Add composite indexes for multi-column queries

---

## 6. API Design Rules

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalCount": 100,
    "totalPages": 5
  }
}
```

### Error Format
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### HTTP Status Codes
| Code | Use Case |
|------|----------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No content (DELETE) |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 500 | Server error |

---

## 7. Security Rules

### Environment Variables
```bash
# ✅ GOOD: Use .env file, NEVER commit
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
POKEMON_TCG_API_KEY="your-api-key"

# ❌ BAD: Never hardcode secrets
const API_KEY = "abc123";
```

### Auth
- **ALWAYS** use `authenticateToken` middleware for protected routes
- **NEVER** store passwords in plain text (use bcrypt)
- **ALWAYS** validate JWT on every protected request
- **NEVER** expose user passwords in API responses

### CORS
```typescript
// ✅ GOOD: Restrict to known origins
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cardcommand-frontend.vercel.app'
  ],
  credentials: true
}));
```

### Input Validation
```typescript
// ✅ GOOD: Validate all inputs
import { z } from 'zod';

const createDealSchema = z.object({
  cardName: z.string().min(1),
  marketPrice: z.number().positive(),
});

// ❌ BAD: Trust client input
const deal = req.body; // No validation!
```

---

## 8. Performance Rules

### Backend
- Use pagination for list endpoints (`skip`, `take`)
- Use database indexes for frequent queries
- Cache expensive operations (Redis optional)
- Set query timeouts

### Frontend
- Use React Query for server state caching
- Use `staleTime` to avoid unnecessary refetches
- Lazy load components with `React.lazy()`
- Optimize images (WebP format, lazy loading)

### Database
```typescript
// ✅ GOOD: Paginated query
const deals = await prisma.deal.findMany({
  skip: (page - 1) * perPage,
  take: perPage,
  orderBy: { createdAt: 'desc' },
});

// ❌ BAD: Loading all records
const deals = await prisma.deal.findMany(); // Could be millions!
```

---

## 9. Testing Rules

### Unit Tests
```typescript
// Test business logic in isolation
// Use Jest + React Testing Library

describe('calculateSavings', () => {
  it('should calculate correct savings percentage', () => {
    const result = calculateSavings(100, 80);
    expect(result).toBe(20);
  });
});
```

### Integration Tests
- Test API endpoints with supertest
- Test database operations

### E2E Tests
- Use Playwright or Cypress
- Test critical user flows (login, add to portfolio, track deal)

---

## 10. Deployment Rules

### Backend (Railway)
1. Push to `main` branch
2. Railway auto-deploys
3. Runs `npx prisma generate` during build
4. Health check at `/health`

### Frontend (Vercel)
1. Push to `main` branch
2. Vercel auto-deploys
3. Build command: `npm run build`
4. Output directory: `dist`

### Database Migrations
```bash
# Local development
npx prisma migrate dev --name add_user_preferences

# Production (Railway)
# Migrations run automatically during deploy
# OR manually via Railway console
```

---

## 11. Git Rules

### Branch Naming
| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<name>` | `feature/deal-alerts` |
| Bugfix | `fix/<name>` | `fix/login-error` |
| Hotfix | `hotfix/<name>` | `hotfix/security-patch` |

### Commit Messages
```
feat: add deal tracking
fix: resolve login error
refactor: simplify deal card component
docs: update API documentation
test: add unit tests for hooks
```

---

## 12. External API Integration Rules

### Rate Limiting
```typescript
// ✅ GOOD: Respect rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function syncWithRateLimit() {
  for (const item of items) {
    await apiCall(item);
    await delay(100); // 10 requests/second max
  }
}
```

### Error Handling
```typescript
// ✅ GOOD: Handle API failures gracefully
try {
  const data = await externalApi.getData();
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      // Rate limited - retry with backoff
    }
  }
  // Log error, don't crash
  console.error('External API error:', error);
}
```

### Caching
```typescript
// Cache external API responses
const cache = new Map();

async function getCachedData(key: string) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  const data = await externalApi.getData();
  cache.set(key, data);
  return data;
}
```

---

## 13. Component Architecture

### Smart vs Dumb Components
| Type | Responsibility | Example |
|------|---------------|---------|
| Smart | Data fetching, state management | `DealFeed`, `Portfolio` |
| Dumb | Render UI based on props | `DealCard`, `Button` |

### Props Pattern
```typescript
// ✅ GOOD: Destructure props
interface DealCardProps {
  deal: Deal;
  onClick: () => void;
}

export function DealCard({ deal, onClick }: DealCardProps) {
  return (...);
}
```

---

## 14. State Management

### Server State (React Query)
- Deals, portfolio, releases, trending
- Automatic caching, refetching, deduplication

### Client State (React Context)
- Auth state (user, login, logout)
- UI state (modals, toasts)

### Local State (useState)
- Form inputs
- Component-specific UI state

---

## 15. Documentation Rules

### Code Comments
```typescript
/**
 * Calculate savings percentage between market price and deal price
 * @param marketPrice - The current market price
 * @param dealPrice - The deal price
 * @returns Savings percentage (0-100)
 */
function calculateSavings(marketPrice: number, dealPrice: number): number {
  return ((marketPrice - dealPrice) / marketPrice) * 100;
}
```

### API Documentation
- Document all endpoints in this file
- Include request/response examples
- Note authentication requirements

---

*Last Updated: February 9, 2026*
*Enforced by: Code review, CI/CD, linting*
