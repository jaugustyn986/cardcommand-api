import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create sample deals
  const deals = [
    {
      cardName: '2023 Victor Wembanyama Prizm Silver',
      cardSet: 'Prizm',
      year: 2023,
      cardNumber: '301',
      grade: 'PSA 10',
      grader: 'PSA',
      marketPrice: 450,
      dealPrice: 385,
      savingsPercent: 14.4,
      savingsAmount: 65,
      marketplace: 'eBay',
      sellerRating: 99.2,
      sellerFeedback: 15420,
      listingUrl: 'https://ebay.com',
      category: 'basketball',
      liquidity: 'High',
      lastSoldPrice: 420,
      thirtyDayAvg: 445,
      ninetyDayTrend: 12.5,
      popGraded: 1247,
      popGrade10: 892,
      isActive: true,
    },
    {
      cardName: '2019 Zion Williamson Prizm Base',
      cardSet: 'Prizm',
      year: 2019,
      cardNumber: '248',
      grade: 'PSA 9',
      grader: 'PSA',
      marketPrice: 180,
      dealPrice: 145,
      savingsPercent: 19.4,
      savingsAmount: 35,
      marketplace: 'TCGPlayer',
      sellerRating: 98.7,
      sellerFeedback: 3200,
      listingUrl: 'https://tcgplayer.com',
      category: 'basketball',
      liquidity: 'High',
      lastSoldPrice: 165,
      thirtyDayAvg: 178,
      ninetyDayTrend: -3.2,
      popGraded: 8543,
      popGrade10: 5234,
      isActive: true,
    },
    {
      cardName: 'Charizard Base Set 1st Edition',
      cardSet: 'Base Set',
      year: 1999,
      variation: 'Shadowless',
      grade: 'PSA 8',
      grader: 'PSA',
      marketPrice: 8500,
      dealPrice: 7200,
      savingsPercent: 15.3,
      savingsAmount: 1300,
      marketplace: 'eBay',
      sellerRating: 100,
      sellerFeedback: 850,
      listingUrl: 'https://ebay.com',
      category: 'pokemon',
      liquidity: 'Medium',
      lastSoldPrice: 7800,
      thirtyDayAvg: 8450,
      ninetyDayTrend: 8.7,
      popGraded: 2341,
      popGrade10: 89,
      isActive: true,
    },
  ];

  for (const deal of deals) {
    await prisma.deal.upsert({
      where: { id: deal.cardName.replace(/\s+/g, '-').toLowerCase() },
      update: {},
      create: {
        id: deal.cardName.replace(/\s+/g, '-').toLowerCase(),
        ...deal,
      },
    });
  }

  console.log('✅ Seeded deals:', deals.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
