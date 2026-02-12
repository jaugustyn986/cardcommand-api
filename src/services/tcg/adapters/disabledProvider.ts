import { ListCardsParams, ProviderCardRecord, ProviderPriceRecord, ProviderSetRecord, SupportedGameSlug, TcgProvider } from '../types';

export class DisabledProvider implements TcgProvider {
  readonly enabled = false;

  constructor(
    public readonly providerKey: string,
    private readonly reason: string,
  ) {}

  private explain(): string {
    return `Provider ${this.providerKey} is disabled: ${this.reason}`;
  }

  async listSets(_game: SupportedGameSlug): Promise<ProviderSetRecord[]> {
    throw new Error(this.explain());
  }

  async getSet(_game: SupportedGameSlug, _providerSetId: string): Promise<ProviderSetRecord | null> {
    throw new Error(this.explain());
  }

  async listCards(_game: SupportedGameSlug, _providerSetId: string, _params?: ListCardsParams): Promise<ProviderCardRecord[]> {
    throw new Error(this.explain());
  }

  async getCard(_game: SupportedGameSlug, _providerCardId: string): Promise<ProviderCardRecord | null> {
    throw new Error(this.explain());
  }

  async getPrices(_game: SupportedGameSlug, _providerCardIds: string[]): Promise<ProviderPriceRecord[]> {
    throw new Error(this.explain());
  }
}

