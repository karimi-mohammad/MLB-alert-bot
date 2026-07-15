import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import config from '../config.js';
import logger from '../utils/logger.js';

/** @type {{ games: Record<number, import('./repository.js').GameState> } | null} */
let state = null;

/** @type {string} */
let stateFilePath = '';

/**
 * Initialize the JSON state store.
 * Reads the file if it exists, otherwise creates an empty state.
 * @returns {Promise<{ games: Record<number, object> }>}
 */
export async function initDatabase() {
  if (state) return state;

  stateFilePath = config.statePath;

  // Ensure the data directory exists
  const dir = path.dirname(stateFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  logger.info({ statePath: stateFilePath }, 'Initializing JSON state store');

  try {
    const raw = await fsp.readFile(stateFilePath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Validate the shape — if it doesn't have a games object, treat as corrupted
    if (!parsed || typeof parsed !== 'object' || !parsed.games) {
      throw new Error('Invalid state structure');
    }

    state = { games: parsed.games };
    logger.info({ gameCount: Object.keys(state.games).length }, 'State loaded from disk');
  } catch (error) {
    // File missing or corrupted — start fresh
    logger.warn({ error: error.message }, 'Could not load state file, creating empty state');
    state = { games: {} };
    await flushState();
  }

  return state;
}

/**
 * Get the in-memory state reference.
 * @returns {{ games: Record<number, object> }}
 */
export function getState() {
  if (!state) {
    throw new Error('State not initialized. Call initDatabase() first.');
  }
  return state;
}

/**
 * Atomically write the in-memory state to disk.
 * Writes to a temp file first, then renames for atomicity.
 * @returns {Promise<void>}
 */
export async function flushState() {
  if (!state) return;

  const tmpPath = stateFilePath + '.tmp';
  const content = JSON.stringify(state, null, 2);

  try {
    await fsp.writeFile(tmpPath, content, 'utf-8');
    await fsp.rename(tmpPath, stateFilePath);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to flush state to disk');
    // Clean up temp file on failure
    try { await fsp.unlink(tmpPath); } catch { /* ignore */ }
    throw error;
  }
}

/**
 * Close the state store (flush to disk and clear memory).
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (state) {
    await flushState();
    state = null;
    logger.info('State store closed');
  }
}