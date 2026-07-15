import { fetch } from 'undici';
import config from '../config.js';
import logger from '../utils/logger.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * Send a message to the configured Telegram channel.
 * @param {string} text - Message text to send
 * @returns {Promise<Object|null>} Response data or null if dry run
 */
export async function sendMessage(text) {
  if (config.dryRun) {
    logger.info({ message: text }, '[DRY RUN] Would send message to Telegram');
    return null;
  }

  if (!config.telegramBotToken || !config.telegramChannelId) {
    logger.error('Telegram bot token or channel ID not configured');
    return null;
  }

  const url = `${TELEGRAM_API_BASE}${config.telegramBotToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.telegramChannelId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Telegram API responded with ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    logger.info({ messageId: data.result?.message_id }, 'Message sent to Telegram');
    return data;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to send message to Telegram');
    throw error;
  }
}