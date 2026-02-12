export type SupportedGameSlug = 'pokemon' | 'mtg' | 'yugioh';

export interface ProviderPriceInput {
  providerCardId: string;
}

export interface ProviderPriceRecord {
  providerCardId: string;
  source: string;
  currency: string;
  market?: number;
  low?: number;
  mid?: number;
  high?: number;
  directLow?: number;
  updatedAt?: Date;
}

export interface ProviderSetRecord {
  provider: string;
  providerSetId: string;
  name: string;
  releaseDate?: Date;
  series?: string;
  total?: number;
  images?: Record<string, unknown>;
  raw: unknown;
}

export interface ProviderCardRecord {
  provider: string;
  providerCardId: string;
  providerSetId: string;
  name: string;
  number?: string;
  rarity?: string;
  images?: Record<string, unknown>;
  tcgplayerId?: string;
  scryfallId?: string;
  raw: unknown;
}

export interface ListCardsParams {
  page?: number;
  pageSize?: number;
  query?: string;
}

export interface TcgProvider {
  readonly providerKey: string;
  readonly enabled: boolean;

  listSets(game: SupportedGameSlug, params?: Record<string, string | number | undefined>): Promise<ProviderSetRecord[]>;
  getSet(game: SupportedGameSlug, providerSetId: string): Promise<ProviderSetRecord | null>;
  listCards(game: SupportedGameSlug, providerSetId: string, params?: ListCardsParams): Promise<ProviderCardRecord[]>;
  getCard(game: SupportedGameSlug, providerCardId: string): Promise<ProviderCardRecord | null>;
  getPrices(game: SupportedGameSlug, providerCardIds: string[]): Promise<ProviderPriceRecord[]>;
}

