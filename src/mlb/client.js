import { fetch } from 'undici';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Fetch the MLB schedule for a given date.
 * @param {string} date - YYYY-MM-DD format
 * @returns {Promise<Array>} Array of game data objects
 */
export async function fetchSchedule(date) {
  const url = `${config.mlbApiBaseUrl}/schedule?date=${date}&sportId=1`;
  logger.info({ url }, 'Fetching MLB schedule');

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MLB-Alert-Bot/1.0' },
    });

    if (!response.ok) {
      throw new Error(`MLB API responded with ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error({ error: error.message, date }, 'Failed to fetch MLB schedule');
    throw error;
  }
}

/**
 * Extract game entries from the MLB API response.
 * @param {Object} data - Raw API response
 * @returns {Array} Array of game objects
 */
export function extractGames(data) {
  if (!data || !data.dates || data.dates.length === 0) {
    return [];
  }

  const games = [];
  for (const dateEntry of data.dates) {
    if (dateEntry.games) {
      for (const game of dateEntry.games) {
        games.push(game);
      }
    }
  }

  return games;
}