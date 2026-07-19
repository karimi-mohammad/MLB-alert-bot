/**
 * Simple logger for Cloudflare Workers.
 * Uses console.log with structured JSON output.
 */

const logger = {
  info: (msg, data) => {
    if (typeof msg === 'object') {
      console.log(JSON.stringify({ level: 'info', ...msg }));
    } else if (data) {
      console.log(JSON.stringify({ level: 'info', message: msg, ...data }));
    } else {
      console.log(JSON.stringify({ level: 'info', message: msg }));
    }
  },

  warn: (msg, data) => {
    if (typeof msg === 'object') {
      console.warn(JSON.stringify({ level: 'warn', ...msg }));
    } else if (data) {
      console.warn(JSON.stringify({ level: 'warn', message: msg, ...data }));
    } else {
      console.warn(JSON.stringify({ level: 'warn', message: msg }));
    }
  },

  error: (msg, data) => {
    if (typeof msg === 'object') {
      console.error(JSON.stringify({ level: 'error', ...msg }));
    } else if (data) {
      console.error(JSON.stringify({ level: 'error', message: msg, ...data }));
    } else {
      console.error(JSON.stringify({ level: 'error', message: msg }));
    }
  },

  debug: (msg, data) => {
    if (typeof msg === 'object') {
      console.debug(JSON.stringify({ level: 'debug', ...msg }));
    } else if (data) {
      console.debug(JSON.stringify({ level: 'debug', message: msg, ...data }));
    } else {
      console.debug(JSON.stringify({ level: 'debug', message: msg }));
    }
  },
};

export default logger;