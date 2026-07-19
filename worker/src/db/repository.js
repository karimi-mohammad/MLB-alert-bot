/**
 * Repository layer using Cloudflare KV Storage.
 * 
 * IMPORTANT: All games are stored in a single KV key ("games:all") as a JSON object.
 * This avoids hitting Cloudflare's 1000 subrequest limit per invocation.
 * 
 * Structure:
 *   key: "games:all"
 *   value: { "gameId1": { ...gameData }, "gameId2": { ...gameData }, ... }
 */

import logger from '../utils/logger.js';

const ALL_GAMES_KEY = 'games:all';

/**
 * Get the KV namespace from config.
 * @param {import('../config.js').config} config
 * @returns {KVNamespace}
 */
function getKv(config) {
  return config.kv;
}

/**
 * Get all games as a map object from KV.
 * @param {import('../config.js').config} config
 * @returns {Promise<Record<number, object>>}
 */
export async function getAllGamesMap(config) {
  const kv = getKv(config);
  const raw = await kv.get(ALL_GAMES_KEY, 'text');
  return raw ? JSON.parse(raw) : {};
}

/**
 * Save the entire games map to KV.
 * @param {Record<number, object>} gamesMap
 * @param {import('../config.js').config} config
 * @returns {Promise<void>}
 */
export async function saveAllGamesMap(gamesMap, config) {
  const kv = getKv(config);
  await kv.put(ALL_GAMES_KEY, JSON.stringify(gamesMap));
}

/**
 * Reset all game state in KV.
 * This clears all tracked games so the next run will re-scan everything from scratch.
 * @param {import('../config.js').config} config
 * @returns {Promise<void>}
 */
export async function resetState(config) {
  const kv = getKv(config);
  await kv.put(ALL_GAMES_KEY, JSON.stringify({}));
  logger.info('Game state has been reset');
}

/**
 * Upsert a game record. Inserts if new, updates if exists.
 * @param {object} game - Parsed game object
 * @param {import('../config.js').config} config
 * @returns {Promise<void>}
 */
export async function upsertGame(game, config) {
  const gamesMap = await getAllGamesMap(config);
  const now = new Date().toISOString();

  const existing = gamesMap[game.gameId];

  if (existing) {
    // Preserve sent flags, update everything else
    gamesMap[game.gameId] = {
      ...existing,
      gameDate: game.gameDate,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      lastStatus: game.status,
      winner: game.winner,
      updatedAt: now,
    };
  } else {
    gamesMap[game.gameId] = {
      gameId: game.gameId,
      gameDate: game.gameDate,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      sent24h: false,
      sent2h: false,
      sentFinal: false,
      winner: game.winner,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      lastStatus: game.status,
      updatedAt: now,
    };
  }

  await saveAllGamesMap(gamesMap, config);
  logger.debug({ gameId: game.gameId, status: game.status }, 'Game upserted');
}

/**
 * Get a game by its ID.
 * @param {number} gameId
 * @param {import('../config.js').config} config
 * @returns {Promise<Object|undefined>}
 */
export async function getGame(gameId, config) {
  const gamesMap = await getAllGamesMap(config);
  return gamesMap[gameId];
}

/**
 * Get all tracked games, sorted by gameDate ascending.
 * @param {import('../config.js').config} config
 * @returns {Promise<Array>}
 */
export async function getAllGames(config) {
  const gamesMap = await getAllGamesMap(config);
  return Object.values(gamesMap).sort((a, b) => a.gameDate.localeCompare(b.gameDate));
}

/**
 * Mark a notification as sent for a specific game.
 * @param {number} gameId
 * @param {'24h'|'2h'|'final'} type - Notification type
 * @param {import('../config.js').config} config
 * @returns {Promise<void>}
 */
export async function markNotificationSent(gameId, type, config) {
  const gamesMap = await getAllGamesMap(config);
  const game = gamesMap[gameId];

  if (!game) {
    logger.warn({ gameId, type }, 'Cannot mark notification: game not found');
    return;
  }

  switch (type) {
    case '24h':
      game.sent24h = true;
      break;
    case '2h':
      game.sent2h = true;
      break;
    case 'final':
      game.sentFinal = true;
      break;
  }

  game.updatedAt = new Date().toISOString();
  await saveAllGamesMap(gamesMap, config);
  logger.debug({ gameId, type }, 'Notification marked as sent');
}

/**
 * Check if a notification has been sent for a specific game.
 * @param {number} gameId
 * @param {'24h'|'2h'|'final'} type - Notification type
 * @param {import('../config.js').config} config
 * @returns {Promise<boolean>}
 */
export async function isNotificationSent(gameId, type, config) {
  const gamesMap = await getAllGamesMap(config);
  const game = gamesMap[gameId];
  if (!game) return false;

  switch (type) {
    case '24h':
      return game.sent24h === true;
    case '2h':
      return game.sent2h === true;
    case 'final':
      return game.sentFinal === true;
    default:
      return false;
  }
}

/**
 * Update the result of a game (score, winner, status).
 * @param {number} gameId
 * @param {number|null} homeScore
 * @param {number|null} awayScore
 * @param {string|null} winner
 * @param {string} status
 * @param {import('../config.js').config} config
 * @returns {Promise<void>}
 */
export async function updateGameResult(gameId, homeScore, awayScore, winner, status, config) {
  const gamesMap = await getAllGamesMap(config);
  const game = gamesMap[gameId];

  if (!game) {
    logger.warn({ gameId }, 'Cannot update result: game not found');
    return;
  }

  game.homeScore = homeScore;
  game.awayScore = awayScore;
  game.winner = winner;
  game.lastStatus = status;
  game.updatedAt = new Date().toISOString();

  await saveAllGamesMap(gamesMap, config);
  logger.debug({ gameId, homeScore, awayScore, winner, status }, 'Game result updated');
}