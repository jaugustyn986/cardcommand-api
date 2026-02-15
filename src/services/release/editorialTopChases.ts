import axios from 'axios';

type EditorialSource = {
  url: string;
  fallbackTopChases: string[];
};

type EditorialSetConfig = {
  setMatchers: string[];
  sources: EditorialSource[];
};

export type EditorialTopChaseResult = {
  topChases: string[];
  sourceUrl: string;
  sourceType: 'editorial_fallback';
  asOfIso: string;
};

const USER_AGENT = 'Mozilla/5.0 (compatible; CardCommandBot/1.0; +https://cardcommand.vercel.app)';

// Trusted editorial allowlist for fallback mode.
const TRUSTED_EDITORIAL_DOMAINS = ['tcgplayer.com', 'wargamer.com'];

// Seed with known high-value pages; expand over time.
const EDITORIAL_SET_CONFIGS: EditorialSetConfig[] = [
  {
    setMatchers: ['ascended heroes'],
    sources: [
      {
        url: 'https://www.tcgplayer.com/content/article/The-10-Cards-Everybody-Wants-from-Ascended-Heroes/4b471867-7630-40c0-a27b-4a42d1a2a309/',
        // Guaranteed fallback so releases do not remain empty if page blocks scraping.
        fallbackTopChases: [
          'Mega Gengar ex SAR',
          'Mega Dragonite ex SAR',
          "Rocket's Mewtwo ex SAR",
          "N's Zoroark ex SIR",
          "Iono's Bellibolt ex SIR",
        ],
      },
    ],
  },
];

function normalize(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHtmlText(input: string): string {
  return (input || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '—')
    .replace(/&ndash;|&#8211;|&#x2013;/gi, '–')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeCardName(text: string): boolean {
  if (!text || text.length < 4 || text.length > 90) return false;
  const t = text.toLowerCase();
  if (
    t.includes('cards everybody wants') ||
    t.includes('most expensive') ||
    t.includes('ascended heroes') ||
    t.includes('pokemon tcg') ||
    t.includes('buyer') ||
    t.includes('guide') ||
    t.includes('top 10')
  ) {
    return false;
  }
  // Card names often include rarity suffixes and/or "ex".
  return /(ex|sir|sar|ar|ur|sr|vmax|vstar|gx|tag team)/i.test(text);
}

function parseEditorialTopChasesFromHtml(html: string, topN: number): string[] {
  const candidates: string[] = [];

  const headingMatches = html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi);
  for (const m of headingMatches) {
    const raw = cleanHtmlText(m[1] || '');
    const line = raw.replace(/^\d+\.\s*/, '').trim();
    if (looksLikeCardName(line)) candidates.push(line);
  }

  const listMatches = html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
  for (const m of listMatches) {
    const raw = cleanHtmlText(m[1] || '');
    const line = raw.replace(/^\d+\.\s*/, '').trim();
    if (looksLikeCardName(line)) candidates.push(line);
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = normalize(c);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
    if (deduped.length >= topN) break;
  }
  return deduped;
}

function findEditorialConfig(setName: string): EditorialSetConfig | null {
  const n = normalize(setName);
  for (const config of EDITORIAL_SET_CONFIGS) {
    if (config.setMatchers.some((matcher) => n.includes(normalize(matcher)))) {
      return config;
    }
  }
  return null;
}

function isTrustedEditorialUrl(url: string): boolean {
  try {
    const host = new URL(url).host.toLowerCase();
    return TRUSTED_EDITORIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const htmlExtractionCache = new Map<string, string[]>();

export async function getEditorialTopChasesForSet(setName: string, topN = 5): Promise<EditorialTopChaseResult | null> {
  const config = findEditorialConfig(setName);
  if (!config) return null;

  for (const source of config.sources) {
    if (!isTrustedEditorialUrl(source.url)) continue;

    try {
      let parsed = htmlExtractionCache.get(source.url);
      if (!parsed) {
        const response = await axios.get<string>(source.url, {
          timeout: 15000,
          responseType: 'text',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html',
          },
          maxRedirects: 3,
        });
        parsed = parseEditorialTopChasesFromHtml(response.data || '', topN);
        htmlExtractionCache.set(source.url, parsed);
      }

      const topChases = (parsed || []).slice(0, topN);
      if (topChases.length > 0) {
        return {
          topChases,
          sourceUrl: source.url,
          sourceType: 'editorial_fallback',
          asOfIso: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn(`⚠️ Editorial chase fetch failed for ${source.url}:`, err);
    }

    if (source.fallbackTopChases && source.fallbackTopChases.length > 0) {
      return {
        topChases: source.fallbackTopChases.slice(0, topN),
        sourceUrl: source.url,
        sourceType: 'editorial_fallback',
        asOfIso: new Date().toISOString(),
      };
    }
  }

  return null;
}
