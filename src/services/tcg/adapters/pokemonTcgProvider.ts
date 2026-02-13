import axios, { AxiosInstance } from 'axios';
import { writeRawCache } from '../providerRawCache';
import { sleep, withRetry } from '../utils';
import {
  ListCardsParams,
  ProviderCardRecord,
  ProviderPriceRecord,
  ProviderSetRecord,
  SupportedGameSlug,
  TcgProvider,
} from '../types';

interface PokemonSetApi {
  id: string;
  name: string;
  series?: string;
  total?: number;
  releaseDate?: string;
  images?: Record<string, unknown>;
}

interface PokemonCardApi {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  set: { id: string };
  images?: Record<string, unknown>;
  tcgplayer?: {
    tcgplayerProductId?: number;
    prices?: Record<string, {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
      directLow?: number;
    }>;
    updatedAt?: string;
  };
}

export class PokemonTcgProvider implements TcgProvider {
  readonly providerKey = 'pokemontcg';
  readonly enabled = process.env.TCG_POKEMON_ENABLED !== 'false';
  private readonly client: AxiosInstance;
  private readonly requestDelayMs: number;
  private readonly retryCount: number;
  private readonly retryBaseDelayMs: number;

  constructor() {
    const timeoutMs = Number.parseInt(process.env.POKEMON_TCG_TIMEOUT_MS || '30000', 10) || 30000;
    this.client = axios.create({
      baseURL: 'https://api.pokemontcg.io/v2',
      timeout: timeoutMs,
      headers: {
        ...(process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}),
      },
    });
    this.requestDelayMs = process.env.POKEMON_TCG_API_KEY ? 100 : 450;
    this.retryCount = Number.parseInt(process.env.POKEMON_TCG_RETRIES || '5', 10) || 5;
    this.retryBaseDelayMs = Number.parseInt(process.env.POKEMON_TCG_RETRY_BASE_MS || '1000', 10) || 1000;
  }

  async listSets(game: SupportedGameSlug): Promise<ProviderSetRecord[]> {
    this.assertGame(game);
    const response = await withRetry(
      () => this.client.get<{ data: PokemonSetApi[] }>('/sets'),
      { retries: this.retryCount, baseDelayMs: this.retryBaseDelayMs },
    );
    await sleep(this.requestDelayMs);
    await writeRawCache({
      provider: this.providerKey,
      gameSlug: game,
      resourceType: 'sets',
      resourceKey: 'all',
      payload: response.data,
      ttlSeconds: 60 * 60 * 24,
    });

    return response.data.data.map((s) => ({
      provider: this.providerKey,
      providerSetId: s.id,
      name: s.name,
      releaseDate: s.releaseDate ? new Date(s.releaseDate) : undefined,
      series: s.series,
      total: s.total,
      images: s.images,
      raw: s,
    }));
  }

  async getSet(game: SupportedGameSlug, providerSetId: string): Promise<ProviderSetRecord | null> {
    this.assertGame(game);
    const response = await withRetry(
      () => this.client.get<{ data: PokemonSetApi }>(`/sets/${encodeURIComponent(providerSetId)}`),
      { retries: this.retryCount, baseDelayMs: this.retryBaseDelayMs },
    );
    await sleep(this.requestDelayMs);
    await writeRawCache({
      provider: this.providerKey,
      gameSlug: game,
      resourceType: 'set',
      resourceKey: providerSetId,
      payload: response.data,
      ttlSeconds: 60 * 60 * 24,
    });

    const set = response.data.data;
    if (!set) return null;
    return {
      provider: this.providerKey,
      providerSetId: set.id,
      name: set.name,
      releaseDate: set.releaseDate ? new Date(set.releaseDate) : undefined,
      series: set.series,
      total: set.total,
      images: set.images,
      raw: set,
    };
  }

  async listCards(game: SupportedGameSlug, providerSetId: string, params: ListCardsParams = {}): Promise<ProviderCardRecord[]> {
    this.assertGame(game);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 250;
    const searchParts = [`set.id:\"${providerSetId}\"`];
    if (params.query) {
      searchParts.push(`name:*${params.query}*`);
    }
    const q = searchParts.join(' ');

    const response = await withRetry(
      () =>
        this.client.get<{ data: PokemonCardApi[] }>('/cards', {
          params: { q, page, pageSize },
        }),
      { retries: this.retryCount, baseDelayMs: this.retryBaseDelayMs },
    );
    await sleep(this.requestDelayMs);
    await writeRawCache({
      provider: this.providerKey,
      gameSlug: game,
      resourceType: 'cards_by_set',
      resourceKey: `${providerSetId}:${page}:${pageSize}:${params.query ?? ''}`,
      payload: response.data,
      ttlSeconds: 60 * 60 * 12,
    });

    return response.data.data.map((c) => this.mapCard(c));
  }

  async getCard(game: SupportedGameSlug, providerCardId: string): Promise<ProviderCardRecord | null> {
    this.assertGame(game);
    const response = await withRetry(
      () => this.client.get<{ data: PokemonCardApi }>(`/cards/${encodeURIComponent(providerCardId)}`),
      { retries: this.retryCount, baseDelayMs: this.retryBaseDelayMs },
    );
    await sleep(this.requestDelayMs);
    await writeRawCache({
      provider: this.providerKey,
      gameSlug: game,
      resourceType: 'card',
      resourceKey: providerCardId,
      payload: response.data,
      ttlSeconds: 60 * 60 * 12,
    });

    const card = response.data.data;
    if (!card) return null;
    return this.mapCard(card);
  }

  async getPrices(game: SupportedGameSlug, providerCardIds: string[]): Promise<ProviderPriceRecord[]> {
    this.assertGame(game);
    if (providerCardIds.length === 0) return [];
    const query = providerCardIds.map((id) => `id:${id}`).join(' OR ');
    const response = await withRetry(
      () =>
        this.client.get<{ data: PokemonCardApi[] }>('/cards', {
          params: { q: query, pageSize: Math.min(250, providerCardIds.length) },
        }),
      { retries: this.retryCount, baseDelayMs: this.retryBaseDelayMs },
    );
    await sleep(this.requestDelayMs);
    await writeRawCache({
      provider: this.providerKey,
      gameSlug: game,
      resourceType: 'prices_bulk',
      resourceKey: providerCardIds.slice().sort().join(','),
      payload: response.data,
      ttlSeconds: 60 * 60 * 6,
    });

    return response.data.data.flatMap((card) => {
      const prices = card.tcgplayer?.prices;
      if (!prices) return [];
      const firstKey = Object.keys(prices)[0];
      const block = firstKey ? prices[firstKey] : undefined;
      if (!block) return [];

      return [{
        providerCardId: card.id,
        source: 'tcgplayer_via_pokemontcg',
        currency: 'USD',
        market: block.market,
        low: block.low,
        mid: block.mid,
        high: block.high,
        directLow: block.directLow,
        updatedAt: card.tcgplayer?.updatedAt ? new Date(card.tcgplayer.updatedAt) : new Date(),
      }];
    });
  }

  private mapCard(card: PokemonCardApi): ProviderCardRecord {
    return {
      provider: this.providerKey,
      providerCardId: card.id,
      providerSetId: card.set.id,
      name: card.name,
      number: card.number,
      rarity: card.rarity,
      images: card.images,
      tcgplayerId: card.tcgplayer?.tcgplayerProductId?.toString(),
      raw: card,
    };
  }

  private assertGame(game: SupportedGameSlug): void {
    if (game !== 'pokemon') {
      throw new Error(`PokemonTcgProvider does not support game: ${game}`);
    }
    if (!this.enabled) {
      throw new Error('Pokemon provider is disabled by TCG_POKEMON_ENABLED');
    }
  }
}

