import { getDatabase } from './database.js';
import logger from '../utils/logger.js';

/**
 * Upsert a game record. Inserts if new, updates if exists.
 * @param {Object} game - Parsed game object
 */
export function upsertGame(game) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO games (gameId, gameDate, homeTeam, awayTeam, lastStatus, homeScore, awayScore, winner, updatedAt)
    VALUES (@gameId, @gameDate, @homeTeam, @awayTeam, @status, @homeScore, @awayScore, @winner, datetime('now'))
    ON CONFLICT(gameId) DO UPDATE SET
      gameDate = excluded.gameDate,
      homeTeam = excluded.homeTeam,
      awayTeam = excluded.awayTeam,
      lastStatus = excluded.lastStatus,
      homeScore = excluded.homeScore,
      awayScore = excluded.awayScore,
      winner = excluded.winner,
      updatedAt = datetime('now')
  `);

  stmt.run({
    gameId: game.gameId,
    gameDate: game.gameDate,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    status: game.status,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    winner: game.winner,
  });

  logger.debug({ gameId: game.gameId, status: game.status }, 'Game upserted');
}

/**
 * Get a game by its ID.
 * @param {number} gameId
 * @returns {Object|undefined}
 */
export function getGame(gameId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM games WHERE gameId = ?').get(gameId);
}

/**
 * Get all tracked games.
 * @returns {Array}
 */
export function getAllGames() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM games ORDER BY gameDate').all();
}

/**
 * Mark a notification as sent for a specific game.
 * @param {number} gameId
 * @param {'24h'|'3h'|'final'} type - Notification type
 */
export function markNotificationSent(gameId, type) {
  const db = getDatabase();
  const column = type === '24h' ? 'sent24h' : type === '3h' ? 'sent3h' : 'sentFinal';
  const stmt = db.prepare(`
    UPDATE games SET ${column} = 1, updatedAt = datetime('now') WHERE gameId = ?
  `);
  stmt.run(gameId);
  logger.debug({ gameId, type }, 'Notification marked as sent');
}

/**
 * Check if a notification has been sent for a specific game.
 * @param {number} gameId
 * @param {'24h'|'3h'|'final'} type - Notification type
 * @returns {boolean}
 */
export function isNotificationSent(gameId, type) {
  const db = getDatabase();
  const column = type === '24h' ? 'sent24h' : type === '3h' ? 'sent3h' : 'sentFinal';
  const row = db.prepare(`SELECT ${column} as sent FROM games WHERE gameId = ?`).get(gameId);
  return row ? row.sent === 1 : false;
}

/**
 * Update the result of a game (score, winner, status).
 * @param {number} gameId
 * @param {number|null} homeScore
 * @param {number|null} awayScore
 * @param {string|null} winner
 * @param {string} status
 */
export function updateGameResult(gameId, homeScore, awayScore, winner, status) {
  const db = getDatabase();
  db.prepare(`
    UPDATE games
    SET homeScore = ?, awayScore = ?, winner = ?, lastStatus = ?, updatedAt = datetime('now')
    WHERE gameId = ?
  `).run(homeScore, awayScore, winner, status, gameId);
  logger.debug({ gameId, homeScore, awayScore, winner, status }, 'Game result updated');
}