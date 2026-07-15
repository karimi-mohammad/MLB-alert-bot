import config from '../config.js';
import logger from '../utils/logger.js';
import { isApproximatelyNHoursAway, isGameFinal } from '../utils/time.js';
import { fetchSchedule, extractGames } from '../mlb/client.js';
import { parseGames } from '../mlb/parser.js';
import { upsertGame, getGame, isNotificationSent, markNotificationSent, updateGameResult } from '../db/repository.js';
import { sendMessage } from '../telegram/sender.js';
import { gameReminder24h, gameReminder3h, gameEnded } from '../messages/templates.js';
import { todayUTC, daysFromNowUTC } from '../utils/time.js';

/**
 * Main notification engine.
 * Fetches games, checks conditions, and sends notifications.
 */
export async function runNotificationEngine() {
  logger.info('Starting notification engine');

  try {
    // Fetch games for today and tomorrow
    const datesToFetch = [];
    for (let i = 0; i < config.lookaheadDays; i++) {
      datesToFetch.push(daysFromNowUTC(i));
    }

    const allGames = [];
    for (const date of datesToFetch) {
      try {
        const data = await fetchSchedule(date);
        const games = extractGames(data);
        const parsed = parseGames(games);
        allGames.push(...parsed);
        logger.info({ date, gameCount: parsed.length }, 'Fetched games for date');
      } catch (error) {
        logger.error({ error: error.message, date }, 'Failed to fetch schedule for date, skipping');
        // Continue with other dates
      }
    }

    if (allGames.length === 0) {
      logger.info('No games found in schedule');
      return;
    }

    logger.info({ totalGames: allGames.length }, 'Processing games');

    // Process each game
    for (const game of allGames) {
      await processGame(game);
    }

    logger.info('Notification engine completed');
  } catch (error) {
    logger.error({ error: error.message }, 'Notification engine encountered an error');
  }
}

/**
 * Process a single game: upsert to DB, check notification conditions, send if needed.
 * @param {Object} game - Parsed game object
 */
async function processGame(game) {
  // Skip postponed or cancelled games
  if (game.status === 'Postponed' || game.status === 'Cancelled') {
    logger.info({ gameId: game.gameId, status: game.status }, 'Skipping postponed/cancelled game');
    upsertGame(game);
    return;
  }

  // Upsert the game into the database
  upsertGame(game);

  // Check and send 24h notification
  if (config.notifications['24h'] && !isNotificationSent(game.gameId, '24h')) {
    if (isApproximatelyNHoursAway(game.gameDate, 24, 30)) {
      logger.info({ gameId: game.gameId }, 'Sending 24h notification');
      const message = gameReminder24h(game);
      await sendMessage(message);
      markNotificationSent(game.gameId, '24h');
    }
  }

  // Check and send 3h notification
  if (config.notifications['3h'] && !isNotificationSent(game.gameId, '3h')) {
    if (isApproximatelyNHoursAway(game.gameDate, 3, 15)) {
      logger.info({ gameId: game.gameId }, 'Sending 3h notification');
      const message = gameReminder3h(game);
      await sendMessage(message);
      markNotificationSent(game.gameId, '3h');
    }
  }

  // Check and send final result notification
  if (config.notifications['gameEnd'] && !isNotificationSent(game.gameId, 'final')) {
    if (isGameFinal(game.status) && game.homeScore !== null && game.awayScore !== null) {
      logger.info({ gameId: game.gameId }, 'Sending final result notification');
      const message = gameEnded(game);
      await sendMessage(message);
      markNotificationSent(game.gameId, 'final');
    }
  }
}