import { formatToTehranTime, formatToTehranDate } from '../utils/time.js';

/**
 * Generate the "24 hours before game" reminder message.
 * @param {Object} game - Parsed game object
 * @returns {string} Formatted Persian message
 */
export function gameReminder24h(game) {
  const time = formatToTehranTime(game.gameDate);
  const date = formatToTehranDate(game.gameDate);

  return [
    '⚾ یادآوری مسابقه',
    '',
    `🟥 ${game.awayTeam}`,
    '',
    '🆚',
    '',
    `🟦 ${game.homeTeam}`,
    '',
    `📅 ${date}`,
    '',
    `🕒 ${time}`,
    '',
    `📍 ${game.venue}`,
  ].join('\n');
}

/**
 * Generate the "2 hours before game" reminder message.
 * @param {Object} game - Parsed game object
 * @returns {string} Formatted Persian message
 */
export function gameReminder3h(game) {
  const time = formatToTehranTime(game.gameDate);

  return [
    '⏰ تنها ۲ ساعت تا شروع مسابقه',
    '',
    `🟥 ${game.awayTeam}`,
    '',
    '🆚',
    '',
    `🟦 ${game.homeTeam}`,
    '',
    `🕒 ${time}`,
  ].join('\n');
}

/**
 * Generate the "game ended" result message.
 * @param {Object} game - Parsed game object
 * @returns {string} Formatted Persian message
 */
export function gameEnded(game) {
  const homeScore = game.homeScore ?? 0;
  const awayScore = game.awayScore ?? 0;

  return [
    '🏁 پایان مسابقه',
    '',
    `🟥 ${game.awayTeam} ${awayScore}`,
    '',
    `🟦 ${game.homeTeam} ${homeScore}`,
    '',
    `🏆 برنده:`,
    `${game.winner || 'نامشخص'}`,
  ].join('\n');
}