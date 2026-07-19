/**
 * Time utility functions for MLB Alert Bot.
 * All internal time handling is in UTC. Display conversions use Tehran time.
 */

const TEHRAN_OFFSET = 3.5; // UTC+3:30

/**
 * Get current time in UTC milliseconds.
 */
export function nowUTC() {
  return Date.now();
}

/**
 * Convert an ISO date string to a Date object.
 * @param {string} isoString
 * @returns {Date}
 */
export function parseDate(isoString) {
  return new Date(isoString);
}

/**
 * Get the time difference in milliseconds between now and a target date.
 * Positive means the target is in the future.
 * @param {string|Date} targetDate
 * @returns {number} milliseconds
 */
export function msUntil(targetDate) {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  return target.getTime() - nowUTC();
}

/**
 * Convert milliseconds to hours.
 * @param {number} ms
 * @returns {number}
 */
export function msToHours(ms) {
  return ms / (1000 * 60 * 60);
}

/**
 * Check if a target time is approximately N hours away (within a tolerance window).
 * @param {string|Date} targetDate
 * @param {number} targetHours - e.g., 24 or 3
 * @param {number} toleranceMinutes - acceptable deviation in minutes
 * @returns {boolean}
 */
export function isApproximatelyNHoursAway(targetDate, targetHours, toleranceMinutes = 30) {
  const ms = msUntil(targetDate);
  const hours = msToHours(ms);
  const tolerance = toleranceMinutes / 60;
  return hours >= (targetHours - tolerance) && hours <= (targetHours + tolerance);
}

/**
 * Check if a game has ended based on its status.
 * @param {string} status
 * @returns {boolean}
 */
export function isGameFinal(status) {
  return status === 'Final' || status === 'Game Over';
}

/**
 * Format a UTC ISO date string to Tehran time for display.
 * @param {string} isoString
 * @returns {string} formatted time string like "03:10"
 */
export function formatToTehranTime(isoString) {
  const date = new Date(isoString);
  const tehranOffset = TEHRAN_OFFSET * 60 * 60 * 1000;
  const tehranTime = new Date(date.getTime() + tehranOffset);
  const hours = String(tehranTime.getUTCHours()).padStart(2, '0');
  const minutes = String(tehranTime.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a UTC ISO date string to Tehran date for display.
 * @param {string} isoString
 * @returns {string} formatted date like "2026-07-17" (Gregorian)
 */
export function formatToTehranDate(isoString) {
  const date = new Date(isoString);
  const tehranOffset = TEHRAN_OFFSET * 60 * 60 * 1000;
  const tehranTime = new Date(date.getTime() + tehranOffset);
  const year = tehranTime.getUTCFullYear();
  const month = String(tehranTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tehranTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD in UTC.
 * @returns {string}
 */
export function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get a date N days from now as YYYY-MM-DD in UTC.
 * @param {number} days
 * @returns {string}
 */
export function daysFromNowUTC(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}