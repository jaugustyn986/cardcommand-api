function isEnabled(value: string | undefined, defaultValue = false): boolean {
  if (value == null) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const tcgConfig = {
  syncEnabled: isEnabled(process.env.TCG_SYNC_ENABLED, false),
  pokemonEnabled: isEnabled(process.env.TCG_POKEMON_ENABLED, true),
  mtgEnabled: isEnabled(process.env.TCG_MTG_ENABLED, false),
  yugiohEnabled: isEnabled(process.env.TCG_YUGIOH_ENABLED, false),
  recentSetWindowDays: Number.parseInt(process.env.TCG_RECENT_SET_WINDOW_DAYS || '120', 10) || 120,
  cardSyncConcurrency: Number.parseInt(process.env.TCG_CARD_SYNC_CONCURRENCY || '4', 10) || 4,
  priceChunkSize: Number.parseInt(process.env.TCG_PRICE_CHUNK_SIZE || '100', 10) || 100,
};

