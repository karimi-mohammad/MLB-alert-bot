import config from '../config.js';
import logger from '../utils/logger.js';
import { isApproximatelyNHoursAway, isGameFinal } from '../utils/time.js';
import { fetchSchedule, extractGames, fetchGameStatus } from '../mlb/client.js';
import { parseGames, parseGame } from '../mlb/parser.js';
import { upsertGame, getGame, getAllGames, isNotificationSent, markNotificationSent, updateGameResult } from '../db/repository.js';
import { sendMessage, sendErrorAlert } from '../telegram/sender.js';
import { gameReminder24h, gameReminder3h, gameEnded } from '../messages/templates.js';
import { todayUTC, daysFromNowUTC } from '../utils/time.js';

/**
 * Main notification engine.
 * Fetches games, checks conditions, and sends notifications.
 */
export async function runNotificationEngine() {
  logger.info('Starting notification engine');

  try {
    // Fetch games for yesterday, today, and upcoming days
    const datesToFetch = [];
    // Include yesterday to catch games that finished and we might have missed
    for (let i = -1; i < config.lookaheadDays; i++) {
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
        await sendErrorAlert(`Failed to fetch schedule for ${date}`, error.message);
        // Continue with other dates
      }
    }

    if (allGames.length === 0) {
      logger.info('No games found in schedule');
    } else {
      logger.info({ totalGames: allGames.length }, 'Processing games from API');

      // Process each game from the API
      for (const game of allGames) {
        await processGame(game);
      }
    }

    // Re-check all existing games in DB that haven't had final notification sent
    // This handles games that finished but were not in the fetched schedule range
    await recheckPendingGames();

    logger.info('Notification engine completed');
  } catch (error) {
    logger.error({ error: error.message }, 'Notification engine encountered an error');
    await sendErrorAlert('Notification engine', error.message);
  }
}

/**
 * Re-check all games in the database that haven't received their final notification.
 * Fetches their current status from the MLB API to see if they've finished.
 */
async function recheckPendingGames() {
  const allDbGames = getAllGames();
  const pendingGames = allDbGames.filter(g => !g.sentFinal);

  if (pendingGames.length === 0) {
    logger.info('No pending games to re-check');
    return;
  }

  logger.info({ count: pendingGames.length }, 'Re-checking pending games for final status');

  for (const dbGame of pendingGames) {
    try {
      const gameData = await fetchGameStatus(dbGame.gameId);
      if (!gameData) continue;

      const parsed = parseGame(gameData);
      await upsertGame(parsed);

      // Check if the game is now final
      if (config.notifications['gameEnd'] && !isNotificationSent(parsed.gameId, 'final')) {
        if (isGameFinal(parsed.status) && parsed.homeScore !== null && parsed.awayScore !== null) {
          logger.info({ gameId: parsed.gameId }, 'Sending final result notification (re-check)');
          try {
            const message = gameEnded(parsed);
            await sendMessage(message);
            await markNotificationSent(parsed.gameId, 'final');
          } catch (error) {
            logger.error({ error: error.message, gameId: parsed.gameId }, 'Failed to send final notification (re-check)');
            await sendErrorAlert(`Failed to send final notification for game ${parsed.gameId} (re-check)`, error.message);
          }
        }
      }
    } catch (error) {
      logger.error({ error: error.message, gameId: dbGame.gameId }, 'Failed to re-check game status');
      // Don't send error alert for each failed re-check to avoid spam
    }
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
    await upsertGame(game);
    return;
  }

  // Upsert the game into the database
  await upsertGame(game);

  // Check and send 24h notification
  if (config.notifications['24h'] && !isNotificationSent(game.gameId, '24h')) {
    if (isApproximatelyNHoursAway(game.gameDate, 24, 30)) {
      logger.info({ gameId: game.gameId }, 'Sending 24h notification');
      try {
        const message = gameReminder24h(game);
        await sendMessage(message);
        await markNotificationSent(game.gameId, '24h');
      } catch (error) {
        logger.error({ error: error.message, gameId: game.gameId }, 'Failed to send 24h notification');
        await sendErrorAlert(`Failed to send 24h notification for game ${game.gameId}`, error.message);
      }
    }
  }

  // Check and send 2h notification
  if (config.notifications['2h'] && !isNotificationSent(game.gameId, '2h')) {
    if (isApproximatelyNHoursAway(game.gameDate, 2, 15)) {
      logger.info({ gameId: game.gameId }, 'Sending 2h notification');
      try {
        const message = gameReminder3h(game);
        await sendMessage(message);
        await markNotificationSent(game.gameId, '2h');
      } catch (error) {
        logger.error({ error: error.message, gameId: game.gameId }, 'Failed to send 2h notification');
        await sendErrorAlert(`Failed to send 2h notification for game ${game.gameId}`, error.message);
      }
    }
  }

  // Check and send final result notification
  if (config.notifications['gameEnd'] && !isNotificationSent(game.gameId, 'final')) {
    if (isGameFinal(game.status) && game.homeScore !== null && game.awayScore !== null) {
      logger.info({ gameId: game.gameId }, 'Sending final result notification');
      try {
        const message = gameEnded(game);
        await sendMessage(message);
        await markNotificationSent(game.gameId, 'final');
      } catch (error) {
        logger.error({ error: error.message, gameId: game.gameId }, 'Failed to send final notification');
        await sendErrorAlert(`Failed to send final notification for game ${game.gameId}`, error.message);
      }
    }
  }
}