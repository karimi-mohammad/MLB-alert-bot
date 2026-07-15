#!/usr/bin/env node

import { initDatabase, closeDatabase } from './db/database.js';
import { runNotificationEngine } from './notifications/engine.js';
import logger from './utils/logger.js';

/**
 * Main entry point for MLB Alert Bot.
 * Initializes the database and runs the notification engine.
 */
async function main() {
  logger.info('MLB Alert Bot starting');

  try {
    // Initialize database
    initDatabase();

    // Run the notification engine
    await runNotificationEngine();

    logger.info('MLB Alert Bot completed successfully');
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'MLB Alert Bot failed');
    process.exit(1);
  } finally {
    // Close database connection
    closeDatabase();
  }
}

main();