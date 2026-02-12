import { DisabledProvider } from './adapters/disabledProvider';
import type { SupportedGameSlug, TcgProvider } from './types';

type RegistryMap = Record<SupportedGameSlug, TcgProvider>;

let registry: RegistryMap | null = null;

export function initializeProviderRegistry(pokemonProvider: TcgProvider): void {
  registry = {
    pokemon: pokemonProvider,
    mtg: new DisabledProvider('scryfall', 'Feature flag TCG_MTG_ENABLED is false'),
    yugioh: new DisabledProvider('ygoprodeck', 'Feature flag TCG_YUGIOH_ENABLED is false'),
  };
}

export function getProviderForGame(game: SupportedGameSlug): TcgProvider {
  if (!registry) {
    throw new Error('Provider registry has not been initialized');
  }
  return registry[game];
}

export function isGameEnabled(game: SupportedGameSlug): boolean {
  try {
    return getProviderForGame(game).enabled;
  } catch {
    return false;
  }
}

