/**
 * Notification engine for Cloudflare Worker.
 * Fetches games, checks conditions, and sends notifications.
 * 
 * IMPORTANT: All KV operations are batched to avoid hitting
 * Cloudflare's subrequest and rate limits.
 * - Read KV once at the start
 * - Process all games in memory
 * - Write KV once at the end
 */

import logger from '../utils/logger.js';
import { isApproximatelyNHoursAway, isGameFinal } from '../utils/time.js';
import { fetchSchedule, extractGames } from '../mlb/client.js';
import { parseGames } from '../mlb/parser.js';
import { getAllGamesMap, saveAllGamesMap } from '../db/repository.js';
import { sendMessage, sendErrorAlert } from '../telegram/sender.js';
import { gameReminder24h, gameReminder3h, gameEnded } from '../messages/templates.js';
import { daysFromNowUTC } from '../utils/time.js';

/**
 * Main notification engine.
 * Fetches games, checks conditions, and sends notifications.
 * @param {import('../config.js').config} config
 */
export async function runNotificationEngine(config) {
  logger.info('Starting notification engine');

  try {
    // Load all existing game state from KV (single read)
    const gamesMap = await getAllGamesMap(config);
    let stateChanged = false;

    // Fetch games for yesterday, today, and upcoming days
    const datesToFetch = [];
    for (let i = -1; i < config.lookaheadDays; i++) {
      datesToFetch.push(daysFromNowUTC(i));
    }

    const allGames = [];
    for (const date of datesToFetch) {
      try {
        const data = await fetchSchedule(date, config);
        const games = extractGames(data);
        const parsed = parseGames(games);
        allGames.push(...parsed);
        logger.info({ date, gameCount: parsed.length }, 'Fetched games for date');
      } catch (error) {
        logger.error({ error: error.message, date }, 'Failed to fetch schedule for date, skipping');
        await sendErrorAlert(`Failed to fetch schedule for ${date}`, error.message, config);
      }
    }

    if (allGames.length > 0) {
      logger.info({ totalGames: allGames.length }, 'Processing games from API');

      // Process each game in memory (no KV writes yet)
      for (const game of allGames) {
        const changed = processGameInMemory(game, gamesMap, config);
        if (changed) stateChanged = true;
      }
    }

    // Single KV write at the end if anything changed
    if (stateChanged) {
      await saveAllGamesMap(gamesMap, config);
      logger.info('State saved to KV');
    } else {
      logger.info('No state changes, skipping KV write');
    }

    logger.info('Notification engine completed');
  } catch (error) {
    logger.error({ error: error.message }, 'Notification engine encountered an error');
    await sendErrorAlert('Notification engine', error.message, config);
  }
}

/**
 * Process a single game in memory (no KV writes).
 * @param {Object} game - Parsed game object
 * @param {Record<number, object>} gamesMap
 * @param {import('../config.js').config} config
 * @returns {boolean} true if state changed
 */
function processGameInMemory(game, gamesMap, config) {
  const now = new Date().toISOString();
  const existing = gamesMap[game.gameId];
  let changed = false;

  // Skip postponed or cancelled games
  if (game.status === 'Postponed' || game.status === 'Cancelled') {
    if (!existing) {
      gamesMap[game.gameId] = createGameEntry(game, now);
      changed = true;
    }
    return changed;
  }

  if (existing) {
    // Update existing entry, preserve sent flags
    existing.gameDate = game.gameDate;
    existing.homeTeam = game.homeTeam;
    existing.awayTeam = game.awayTeam;
    existing.homeScore = game.homeScore;
    existing.awayScore = game.awayScore;
    existing.lastStatus = game.status;
    existing.winner = game.winner;
    existing.updatedAt = now;
  } else {
    gamesMap[game.gameId] = createGameEntry(game, now);
    changed = true;
  }

  const entry = gamesMap[game.gameId];

  // Check and send 24h notification
  if (config.notifications['24h'] && !entry.sent24h) {
    if (isApproximatelyNHoursAway(game.gameDate, 24, 30)) {
      logger.info({ gameId: game.gameId }, 'Sending 24h notification');
      try {
        const message = gameReminder24h(game);
        // Send synchronously (awaited)
        sendMessage(message, config).catch(e => {
          logger.error({ error: e.message, gameId: game.gameId }, 'Failed to send 24h notification');
          sendErrorAlert(`Failed to send 24h notification for game ${game.gameId}`, e.message, config);
        });
        entry.sent24h = true;
        changed = true;
      } catch (error) {
        logger.error({ error: error.message, gameId: game.gameId }, 'Failed to send 24h notification');
        sendErrorAlert(`Failed to send 24h notification for game ${game.gameId}`, error.message, config);
      }
    }
  }

  // Check and send 2h notification
  if (config.notifications['2h'] && !entry.sent2h) {
    if (isApproximatelyNHoursAway(game.gameDate, 2, 15)) {
      logger.info({ gameId: game.gameId }, 'Sending 2h notification');
      try {
        const message = gameReminder3h(game);
        sendMessage(message, config).catch(e => {
          logger.error({ error: e.message, gameId: game.gameId }, 'Failed to send 2h notification');
          sendErrorAlert(`Failed to send 2h notification for game ${game.gameId}`, e.message, config);
        });
        entry.sent2h = true;
        changed = true;
      } catch (error) {
        logger.error({ error: error.message, gameId: game.gameId }, 'Failed to send 2h notification');
        sendErrorAlert(`Failed to send 2h notification for game ${game.gameId}`, error.message, config);
      }
    }
  }

  // Check and send final result notification
  if (config.notifications['gameEnd'] && !entry.sentFinal) {
    if (isGameFinal(game.status) && game.homeScore !== null && game.awayScore !== null) {
      logger.info({ gameId: game.gameId }, 'Sending final result notification');
      try {
        const message = gameEnded(game);
        sendMessage(message, config).catch(e => {
          logger.error({ error: e.message, gameId: game.gameId }, 'Failed to send final notification');
          sendErrorAlert(`Failed to send final notification for game ${game.gameId}`, e.message, config);
        });
        entry.sentFinal = true;
        changed = true;
      } catch (error) {
        logger.error({ error: error.message, gameId: game.gameId }, 'Failed to send final notification');
        sendErrorAlert(`Failed to send final notification for game ${game.gameId}`, error.message, config);
      }
    }
  }

  return changed;
}

/**
 * Create a new game entry object.
 * @param {Object} game
 * @param {string} now
 * @returns {Object}
 */
function createGameEntry(game, now) {
  return {
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

