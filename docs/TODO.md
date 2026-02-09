[TODO.md](https://github.com/user-attachments/files/25183980/TODO.md)
# CardCommand Center - TODO & Roadmap

> **Current Status:** Backend API deployed, Frontend deployed, Core features functional. Ready for live data integration and feature expansion.

---

## 🔴 P0 - Critical (Do First)

### Live Data Integration
- [ ] **Test Pokémon TCG API sync**
  - Trigger: `POST /api/admin/releases/sync`
  - Verify: Check `/api/admin/releases/status`
  - Expected: Pokemon releases populated in DB
  
- [ ] **Test Scryfall MTG API sync**
  - Same trigger as above
  - Expected: MTG releases populated in DB
  
- [ ] **Fix any sync errors**
  - Check Railway logs for errors
  - Verify data transformation is correct

### Sports Cards Data
- [ ] **Research sports card APIs**
  - Options: SportsCardsPro API ($29/mo), web scraping, manual curation
  - Decision needed: Which approach?
  
- [ ] **Implement sports card sync** (if API chosen)
  - Create `syncSportsReleases()` function
  - Add to `releaseSyncService.ts`

---

## 🟠 P1 - High Priority (Next Sprint)

### Deal Data Pipeline
- [ ] **Integrate eBay API for deal sourcing**
  - API: eBay Finding API + Browse API
  - Auth: OAuth 2.0
  - Data: Card listings with prices
  
- [ ] **Integrate TCGPlayer API for pricing**
  - API: TCGPlayer API v1.39
  - Auth: API key
  - Data: Market prices, historical data
  
- [ ] **Create deal scoring algorithm**
  - Compare deal price vs market price
  - Calculate savings %
  - Assign liquidity score

### User Experience
- [ ] **Add loading skeletons**
  - Deal cards
  - Portfolio cards
  - Release cards
  
- [ ] **Add empty states**
  - "No deals found"
  - "Your portfolio is empty"
  - "No upcoming releases"
  
- [ ] **Add error boundaries**
  - Catch React errors gracefully
  - Show fallback UI

---

## 🟡 P2 - Medium Priority (Backlog)

### Portfolio Enhancements
- [ ] **Portfolio value chart**
  - Time series chart (24h, 7d, 30d, 1y)
  - Total value vs cost basis
  - Profit/loss tracking
  
- [ ] **Portfolio import**
  - CSV upload
  - eBay purchase history import
  - PSA/BGS grading queue sync

### Notifications
- [ ] **Email notifications**
  - Price alerts
  - Deal alerts matching preferences
  - Release reminders
  
- [ ] **Push notifications**
  - Browser push
  - Mobile push (future)

### Analytics
- [ ] **User analytics dashboard**
  - Portfolio performance
  - Deal tracking history
  - Market trend insights

---

## 🟢 P3 - Low Priority (Future)

### Advanced Features
- [ ] **Strategy engine v2**
  - ML-based recommendations
  - Risk assessment
  - ROI projections
  
- [ ] **Social features**
  - User profiles
  - Public portfolios
  - Deal sharing
  
- [ ] **Mobile app**
  - React Native
  - iOS + Android
  
- [ ] **Browser extension**
  - Price checker on eBay/TCGPlayer
  - Quick deal alerts

---

## 📋 Quick Tasks (Good for Beginners)

- [ ] **Add favicon**
- [ ] **Add meta tags for SEO**
- [ ] **Add Open Graph images**
- [ ] **Fix console warnings**
- [ ] **Add unit tests for hooks**
- [ ] **Add E2E tests for critical flows**

---

## 🐛 Known Bugs

| Bug | Severity | Notes |
|-----|----------|-------|
| Trending heatmap shows static bubbles when no data | Low | Fallback is working, but live data preferred |
| Sports cards have no release data | High | Need data source |
| Deal strategy modal not implemented | Medium | Shows placeholder |

---

## 📊 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Active users | 0 | 100 (v1 launch) |
| Deals tracked/day | 0 | 50 |
| API response time | ~200ms | <100ms (p95) |
| Uptime | 99% | 99.9% |

---

## 🗓️ Suggested Sprint Schedule

### Sprint 1 (Week 1-2): Live Data
- Test Pokémon/MTG sync
- Fix any issues
- Add sports card solution

### Sprint 2 (Week 3-4): Deal Pipeline
- eBay API integration
- TCGPlayer API integration
- Deal scoring algorithm

### Sprint 3 (Week 5-6): UX Polish
- Loading states
- Error handling
- Notifications

### Sprint 4 (Week 7-8): Analytics
- Portfolio charts
- User dashboard
- Market insights

---

*Last Updated: February 9, 2026*
