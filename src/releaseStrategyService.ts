// ============================================
// CardCommand Center - Release Strategy Service
// Generates lightweight strategy hints for release products using OpenAI
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type ReleaseStrategyPrimary = 'Flip' | 'Short Hold' | 'Long Hold' | 'Avoid' | 'Watch';

export interface ReleaseStrategyPayload {
  primary: ReleaseStrategyPrimary;
  confidence: number; // 0–100
  reasonSummary: string;
  keyFactors: {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    detail: string;
  }[];
}

/** Strategy rules (see docs/STRATEGY_RULES.md) */
const STRATEGY_RULES = `
Primary strategy definitions (use exactly one):
- Flip: Sell within 2-4 weeks. Use when estimatedResale is meaningfully above MSRP (≥15%+) AND hype is strong.
- Short Hold: Hold 3-6 months. Use when moderate upside vs MSRP, decent hype, or likely singles demand.
- Long Hold: Hold 1+ years. Use for iconic sets, first prints, or products likely to appreciate over years.
- Avoid: Do not buy for investment. Use when weak demand, high print run, or estimatedResale ≤ MSRP.
- Watch: Insufficient data. Use when msrp, estimatedResale, or hypeScore are missing. Prefer over guessing.
`;

const STRATEGY_SYSTEM_PROMPT = `You are an investment strategy assistant for sealed trading card products.
Given structured JSON about a single sealed product release, output a SHORT strategy recommendation
as JSON. Focus on realistic, conservative guidance. Do NOT invent prices; rely only on the provided
MSRP, estimatedResale, hypeScore, and textual context.

Output ONLY a JSON object (no markdown, no code fences) with this exact shape:
{
  "primary": "Flip" | "Short Hold" | "Long Hold" | "Avoid" | "Watch",
  "confidence": number,     // 0-100, how confident you are in this recommendation
  "reasonSummary": "1-2 sentence summary in plain English.",
  "keyFactors": [
    {
      "factor": "Short label (e.g. Hype, Print Run, Top Chases)",
      "impact": "positive" | "negative" | "neutral",
      "detail": "Short explanation (e.g. High hype from early singles; low print run)"
    }
  ]
}
${STRATEGY_RULES}

Decision flow:
1. If msrp, estimatedResale, or hypeScore are missing → Watch
2. If estimatedResale ≤ MSRP or clearly below → Avoid
3. If estimatedResale >> MSRP (e.g. 20%+) and hype strong → Flip
4. If modest premium and decent demand → Short Hold
5. If iconic, low print, or early scarcity signals → Long Hold
6. When in doubt, choose the MORE CONSERVATIVE option.

Always base reasoning on the provided fields and sourceUrl context, not on outside knowledge.`;

export async function generateReleaseStrategyForProductId(
  releaseProductId: string,
): Promise<void> {
  const product = await prisma.releaseProduct.findUnique({
    where: { id: releaseProductId },
    include: { release: true },
  });

  if (!product) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ OPENAI_API_KEY not set; skipping release strategy generation');
    return;
  }

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  const payload = {
    id: product.id,
    name: product.name,
    productType: product.productType,
    category: product.category,
    msrp: product.msrp,
    estimatedResale: product.estimatedResale,
    releaseDate: product.releaseDate ? product.releaseDate.toISOString().slice(0, 10) : null,
    preorderDate: product.preorderDate ? product.preorderDate.toISOString().slice(0, 10) : null,
    hypeScore: product.release.hypeScore,
    setName: product.release.name,
    contentsSummary: product.contentsSummary,
    confidenceEnum: product.confidence,
    sourceUrl: product.sourceUrl,
  };

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_EXTRACTION_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: STRATEGY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Using ONLY this JSON, recommend a strategy for this sealed product:\n\n${JSON.stringify(
          payload,
        )}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return;

  let parsed: ReleaseStrategyPayload;
  try {
    parsed = JSON.parse(content) as ReleaseStrategyPayload;
  } catch (err) {
    console.error('Failed to parse release strategy JSON:', (content || '').slice(0, 200));
    return;
  }

  // Basic sanity checks according to the \"balanced\" constraint
  if (!parsed.primary || typeof parsed.confidence !== 'number' || !parsed.reasonSummary) {
    console.warn('Release strategy missing required fields for product', releaseProductId);
    return;
  }

  await prisma.releaseProductStrategy.create({
    data: {
      releaseProductId: product.id,
      primary: parsed.primary,
      confidence: parsed.confidence,
      reasonSummary: parsed.reasonSummary,
      keyFactors: parsed.keyFactors ?? undefined,
    },
  });
}

/** Backfill strategies for Pokémon products that don't have one yet (e.g. Tier A set_default products) */
export async function backfillStrategiesForPokemon(): Promise<number> {
  const products = await prisma.releaseProduct.findMany({
    where: {
      category: 'pokemon',
      strategies: { none: {} },
    },
    select: { id: true },
    take: 50,
  });

  let count = 0;
  for (const p of products) {
    try {
      await generateReleaseStrategyForProductId(p.id);
      count++;
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`Strategy backfill failed for product ${p.id}:`, err);
    }
  }
  if (count > 0) {
    console.log(`✅ Strategy backfill: generated ${count} strategies for Pokémon products`);
  }
  return count;
}

