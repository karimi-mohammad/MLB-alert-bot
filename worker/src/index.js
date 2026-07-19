/**
 * Cloudflare Worker entry point for MLB Alert Bot.
 * 
 * This worker can be triggered in two ways:
 * 1. HTTP request (GET /) - for manual/cron job triggers
 * 2. Scheduled event (Cron Trigger) - for automatic periodic execution
 * 
 * The worker fetches MLB schedules, checks notification conditions,
 * and sends Telegram alerts without duplicate messages.
 */

import { loadConfig } from './config.js';
import { runNotificationEngine } from './notifications/engine.js';
import { resetState } from './db/repository.js';
import logger from './utils/logger.js';

/**
 * Handle HTTP requests.
 * 
 * Routes:
 *   GET /          - Run the notification engine
 *   GET /reset     - Reset all game state (clear KV), then run engine
 *   POST /reset    - Reset all game state only (no engine run)
 * 
 * @param {Request} request
 * @param {Object} env
 * @param {Object} ctx
 * @returns {Promise<Response>}
 */
export default {
  async fetch(request, env, ctx) {
    const config = loadConfig(env);
    const url = new URL(request.url);

    // === Reset endpoint ===
    if (url.pathname === '/reset') {
      if (request.method === 'POST') {
        // Reset only, no engine run
        logger.info('Resetting game state (POST /reset)');
        try {
          await resetState(config);
          return new Response('State reset. Run GET / to re-scan all games.', { status: 200 });
        } catch (error) {
          logger.error({ error: error.message }, 'Failed to reset state');
          return new Response('Reset failed', { status: 500 });
        }
      }

      if (request.method === 'GET') {
        // Reset then run engine
        logger.info('Resetting game state and running engine (GET /reset)');
        try {
          await resetState(config);
          await runNotificationEngine(config);
          return new Response('State reset and engine run completed.', { status: 200 });
        } catch (error) {
          logger.error({ error: error.message }, 'Reset + engine run failed');
          return new Response('Reset + engine run failed', { status: 500 });
        }
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // === Default: run engine ===
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    logger.info('MLB Alert Bot triggered via HTTP');

    try {
      await runNotificationEngine(config);
      logger.info('MLB Alert Bot completed successfully');
      return new Response('OK', { status: 200 });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'MLB Alert Bot failed');
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  /**
   * Handle scheduled events (Cron Triggers).
   * @param {Object} event
   * @param {Object} env
   * @param {Object} ctx
   */
  async scheduled(event, env, ctx) {
    const config = loadConfig(env);

    logger.info('MLB Alert Bot triggered via Cron Trigger');

    try {
      await runNotificationEngine(config);
      logger.info('MLB Alert Bot completed successfully');
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'MLB Alert Bot failed');
    }
  },
};