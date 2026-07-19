/**
 * Configuration for Cloudflare Worker.
 * Reads all settings from environment variables (secrets).
 */

/**
 * Load configuration from Worker env.
 * @param {Object} env - Cloudflare Worker env bindings
 * @returns {Object} config object
 */
export function loadConfig(env) {
  return {
    notifications: {
      '24h': env.NOTIFY_24H !== 'false',   // default true
      '2h': env.NOTIFY_2H !== 'false',      // default true
      'gameStart': env.NOTIFY_GAME_START === 'true', // default false
      'gameEnd': env.NOTIFY_GAME_END !== 'false',    // default true
    },
    timezone: env.TIMEZONE || 'Asia/Tehran',
    lookaheadDays: parseInt(env.LOOKAHEAD_DAYS || '3', 10),
    mlbApiBaseUrl: env.MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1',
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    telegramChannelId: env.TELEGRAM_CHANNEL_ID,
    kv: env.MLB_STATE, // KV namespace binding
  };
}