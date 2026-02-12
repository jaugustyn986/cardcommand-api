import { DisabledProvider } from './adapters/disabledProvider';
import type { SupportedGameSlug, TcgProvider } from './types';
import { tcgConfig } from './config';

type RegistryMap = Record<SupportedGameSlug, TcgProvider>;

let registry: RegistryMap | null = null;

export function initializeProviderRegistry(pokemonProvider: TcgProvider): void {
  const mtgReason = tcgConfig.mtgEnabled
    ? 'Feature flag enabled, but Scryfall provider implementation is not wired yet'
    : 'Feature flag TCG_MTG_ENABLED is false';
  const yugiohReason = tcgConfig.yugiohEnabled
    ? 'Feature flag enabled, but YGOPRODeck provider implementation is not wired yet'
    : 'Feature flag TCG_YUGIOH_ENABLED is false';

  registry = {
    pokemon: tcgConfig.pokemonEnabled
      ? pokemonProvider
      : new DisabledProvider('pokemontcg', 'Feature flag TCG_POKEMON_ENABLED is false'),
    mtg: new DisabledProvider('scryfall', mtgReason),
    yugioh: new DisabledProvider('ygoprodeck', yugiohReason),
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

