import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config.js';
import logger from '../utils/logger.js';

let db = null;

/**
 * Initialize the SQLite database and create tables if they don't exist.
 * @returns {Database}
 */
export function initDatabase() {
  if (db) return db;

  // Ensure the data directory exists
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  logger.info({ dbPath: config.dbPath }, 'Initializing database');
  db = new Database(config.dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create the games table
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      gameId INTEGER PRIMARY KEY,
      gameDate TEXT NOT NULL,
      homeTeam TEXT NOT NULL,
      awayTeam TEXT NOT NULL,
      sent24h INTEGER NOT NULL DEFAULT 0,
      sent3h INTEGER NOT NULL DEFAULT 0,
      sentFinal INTEGER NOT NULL DEFAULT 0,
      winner TEXT,
      homeScore INTEGER,
      awayScore INTEGER,
      lastStatus TEXT NOT NULL DEFAULT 'Scheduled',
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  logger.info('Database initialized successfully');
  return db;
}

/**
 * Get the database instance.
 * @returns {Database}
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection.
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}