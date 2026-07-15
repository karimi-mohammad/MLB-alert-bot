import { getState, flushState } from './database.js';
import logger from '../utils/logger.js';

/**
 * @typedef {Object} GameState
 * @property {number} gameId
 * @property {string} gameDate
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {boolean} sent24h
 * @property {boolean} sent3h
 * @property {boolean} sentFinal
 * @property {string|null} winner
 * @property {number|null} homeScore
 * @property {number|null} awayScore
 * @property {string} lastStatus
 * @property {string} updatedAt
 */

/**
 * Upsert a game record. Inserts if new, updates if exists.
 * @param {object} game - Parsed game object
 * @returns {Promise<void>}
 */
export async function upsertGame(game) {
  const { games } = getState();
  const now = new Date().toISOString();

  const existing = games[game.gameId];

  if (existing) {
    // Preserve sent flags, update everything else
    games[game.gameId] = {
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
    games[game.gameId] = {
      gameId: game.gameId,
      gameDate: game.gameDate,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      sent24h: false,
      sent3h: false,
      sentFinal: false,
      winner: game.winner,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      lastStatus: game.status,
      updatedAt: now,
    };
  }

  await flushState();
  logger.debug({ gameId: game.gameId, status: game.status }, 'Game upserted');
}

/**
 * Get a game by its ID.
 * @param {number} gameId
 * @returns {GameState|undefined}
 */
export function getGame(gameId) {
  const { games } = getState();
  return games[gameId];
}

/**
 * Get all tracked games, sorted by gameDate ascending.
 * @returns {GameState[]}
 */
export function getAllGames() {
  const { games } = getState();
  return Object.values(games).sort((a, b) => a.gameDate.localeCompare(b.gameDate));
}

/**
 * Mark a notification as sent for a specific game.
 * @param {number} gameId
 * @param {'24h'|'3h'|'final'} type - Notification type
 * @returns {Promise<void>}
 */
export async function markNotificationSent(gameId, type) {
  const { games } = getState();
  const game = games[gameId];
  if (!game) {
    logger.warn({ gameId, type }, 'Cannot mark notification: game not found');
    return;
  }

  switch (type) {
    case '24h':
      game.sent24h = true;
      break;
    case '3h':
      game.sent3h = true;
      break;
    case 'final':
      game.sentFinal = true;
      break;
  }

  game.updatedAt = new Date().toISOString();
  await flushState();
  logger.debug({ gameId, type }, 'Notification marked as sent');
}

/**
 * Check if a notification has been sent for a specific game.
 * @param {number} gameId
 * @param {'24h'|'3h'|'final'} type - Notification type
 * @returns {boolean}
 */
export function isNotificationSent(gameId, type) {
  const { games } = getState();
  const game = games[gameId];
  if (!game) return false;

  switch (type) {
    case '24h':
      return game.sent24h === true;
    case '3h':
      return game.sent3h === true;
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
 * @returns {Promise<void>}
 */
export async function updateGameResult(gameId, homeScore, awayScore, winner, status) {
  const { games } = getState();
  const game = games[gameId];
  if (!game) {
    logger.warn({ gameId }, 'Cannot update result: game not found');
    return;
  }

  game.homeScore = homeScore;
  game.awayScore = awayScore;
  game.winner = winner;
  game.lastStatus = status;
  game.updatedAt = new Date().toISOString();

  await flushState();
  logger.debug({ gameId, homeScore, awayScore, winner, status }, 'Game result updated');
}