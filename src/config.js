import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadConfig() {
  const configPath = path.resolve(__dirname, '..', 'config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  return {
    notifications: config.notifications,
    timezone: config.timezone || 'Asia/Tehran',
    lookaheadDays: config.lookaheadDays || 2,
    schedulerIntervalMinutes: config.schedulerIntervalMinutes || 15,
    mlbApiBaseUrl: process.env.MLB_API_BASE_URL || config.mlbApiBaseUrl || 'https://statsapi.mlb.com/api/v1',
    statePath: path.resolve(__dirname, '..', config.statePath || './data/state.json'),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChannelId: process.env.TELEGRAM_CHANNEL_ID,
    dryRun: process.argv.includes('--dry-run'),
  };
}

/** @type {ReturnType<typeof loadConfig>} */
const config = loadConfig();

export default config;