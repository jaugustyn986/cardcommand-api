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

Guidelines:
- Prefer \"Watch\" when the data is thin (no clear estimatedResale or hypeScore).
- \"Flip\" is for short-term opportunities where estimatedResale is meaningfully above MSRP and hype is strong.
- \"Short Hold\" is for 3-6 month windows where upside exists but is less explosive.
- \"Long Hold\" is for iconic sets or products likely to appreciate over years.
- \"Avoid\" is for products with weak demand, high print run, or poor value vs MSRP.
- When in doubt between more aggressive and more conservative options, choose the more conservative one.
- Always base reasoning on the provided fields and the sourceUrl context, not on outside knowledge.`;

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

