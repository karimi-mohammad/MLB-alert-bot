var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/config.js
function loadConfig(env) {
  return {
    notifications: {
      "24h": env.NOTIFY_24H !== "false",
      // default true
      "2h": env.NOTIFY_2H !== "false",
      // default true
      "gameStart": env.NOTIFY_GAME_START === "true",
      // default false
      "gameEnd": env.NOTIFY_GAME_END !== "false"
      // default true
    },
    timezone: env.TIMEZONE || "Asia/Tehran",
    lookaheadDays: parseInt(env.LOOKAHEAD_DAYS || "3", 10),
    mlbApiBaseUrl: env.MLB_API_BASE_URL || "https://statsapi.mlb.com/api/v1",
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    telegramChannelId: env.TELEGRAM_CHANNEL_ID,
    kv: env.MLB_STATE
    // KV namespace binding
  };
}
__name(loadConfig, "loadConfig");

// src/utils/logger.js
var logger = {
  info: /* @__PURE__ */ __name((msg, data) => {
    if (typeof msg === "object") {
      console.log(JSON.stringify({ level: "info", ...msg }));
    } else if (data) {
      console.log(JSON.stringify({ level: "info", message: msg, ...data }));
    } else {
      console.log(JSON.stringify({ level: "info", message: msg }));
    }
  }, "info"),
  warn: /* @__PURE__ */ __name((msg, data) => {
    if (typeof msg === "object") {
      console.warn(JSON.stringify({ level: "warn", ...msg }));
    } else if (data) {
      console.warn(JSON.stringify({ level: "warn", message: msg, ...data }));
    } else {
      console.warn(JSON.stringify({ level: "warn", message: msg }));
    }
  }, "warn"),
  error: /* @__PURE__ */ __name((msg, data) => {
    if (typeof msg === "object") {
      console.error(JSON.stringify({ level: "error", ...msg }));
    } else if (data) {
      console.error(JSON.stringify({ level: "error", message: msg, ...data }));
    } else {
      console.error(JSON.stringify({ level: "error", message: msg }));
    }
  }, "error"),
  debug: /* @__PURE__ */ __name((msg, data) => {
    if (typeof msg === "object") {
      console.debug(JSON.stringify({ level: "debug", ...msg }));
    } else if (data) {
      console.debug(JSON.stringify({ level: "debug", message: msg, ...data }));
    } else {
      console.debug(JSON.stringify({ level: "debug", message: msg }));
    }
  }, "debug")
};
var logger_default = logger;

// src/utils/time.js
var TEHRAN_OFFSET = 3.5;
function nowUTC() {
  return Date.now();
}
__name(nowUTC, "nowUTC");
function msUntil(targetDate) {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  return target.getTime() - nowUTC();
}
__name(msUntil, "msUntil");
function msToHours(ms) {
  return ms / (1e3 * 60 * 60);
}
__name(msToHours, "msToHours");
function isApproximatelyNHoursAway(targetDate, targetHours, toleranceMinutes = 30) {
  const ms = msUntil(targetDate);
  const hours = msToHours(ms);
  const tolerance = toleranceMinutes / 60;
  return hours >= targetHours - tolerance && hours <= targetHours + tolerance;
}
__name(isApproximatelyNHoursAway, "isApproximatelyNHoursAway");
function isGameFinal(status) {
  return status === "Final" || status === "Game Over";
}
__name(isGameFinal, "isGameFinal");
function formatToTehranTime(isoString) {
  const date = new Date(isoString);
  const tehranOffset = TEHRAN_OFFSET * 60 * 60 * 1e3;
  const tehranTime = new Date(date.getTime() + tehranOffset);
  const hours = String(tehranTime.getUTCHours()).padStart(2, "0");
  const minutes = String(tehranTime.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
__name(formatToTehranTime, "formatToTehranTime");
function formatToTehranDate(isoString) {
  const date = new Date(isoString);
  const tehranOffset = TEHRAN_OFFSET * 60 * 60 * 1e3;
  const tehranTime = new Date(date.getTime() + tehranOffset);
  const year = tehranTime.getUTCFullYear();
  const month = String(tehranTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(tehranTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
__name(formatToTehranDate, "formatToTehranDate");
function daysFromNowUTC(days) {
  const d = /* @__PURE__ */ new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}
__name(daysFromNowUTC, "daysFromNowUTC");

// src/mlb/client.js
async function fetchSchedule(date, config) {
  const url = `${config.mlbApiBaseUrl}/schedule?date=${date}&sportId=1`;
  logger_default.info({ url }, "Fetching MLB schedule");
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MLB-Alert-Bot/1.0" }
    });
    if (!response.ok) {
      throw new Error(`MLB API responded with ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    logger_default.error({ error: error.message, date }, "Failed to fetch MLB schedule");
    throw error;
  }
}
__name(fetchSchedule, "fetchSchedule");
function extractGames(data) {
  if (!data || !data.dates || data.dates.length === 0) {
    return [];
  }
  const games = [];
  for (const dateEntry of data.dates) {
    if (dateEntry.games) {
      for (const game of dateEntry.games) {
        games.push(game);
      }
    }
  }
  return games;
}
__name(extractGames, "extractGames");

// src/mlb/parser.js
function parseGame(gameData) {
  const status = getGameStatus(gameData);
  const homeScore = gameData.teams?.home?.score ?? null;
  const awayScore = gameData.teams?.away?.score ?? null;
  let winner = null;
  if (status === "Final" && homeScore !== null && awayScore !== null) {
    winner = homeScore > awayScore ? gameData.teams.home.team.name : gameData.teams.away.team.name;
  }
  return {
    gameId: gameData.gamePk,
    gameDate: gameData.gameDate,
    homeTeam: gameData.teams.home.team.name,
    awayTeam: gameData.teams.away.team.name,
    homeTeamAbbreviation: gameData.teams.home.team.abbreviation || gameData.teams.home.team.name,
    awayTeamAbbreviation: gameData.teams.away.team.abbreviation || gameData.teams.away.team.name,
    homeScore,
    awayScore,
    status,
    winner,
    venue: gameData.venue?.name || "Unknown"
  };
}
__name(parseGame, "parseGame");
function getGameStatus(gameData) {
  const statusCode = gameData.status?.detailedState || gameData.status?.codedGameState;
  switch (statusCode) {
    case "Scheduled":
    case "Pre-Game":
    case "Preview":
      return "Scheduled";
    case "In Progress":
    case "Live":
      return "InProgress";
    case "Final":
    case "Game Over":
      return "Final";
    case "Postponed":
      return "Postponed";
    case "Cancelled":
      return "Cancelled";
    default:
      return statusCode || "Unknown";
  }
}
__name(getGameStatus, "getGameStatus");
function parseGames(gamesData) {
  return gamesData.map(parseGame);
}
__name(parseGames, "parseGames");

// src/db/repository.js
var ALL_GAMES_KEY = "games:all";
function getKv(config) {
  return config.kv;
}
__name(getKv, "getKv");
async function getAllGamesMap(config) {
  const kv = getKv(config);
  const raw = await kv.get(ALL_GAMES_KEY, "text");
  return raw ? JSON.parse(raw) : {};
}
__name(getAllGamesMap, "getAllGamesMap");
async function saveAllGamesMap(gamesMap, config) {
  const kv = getKv(config);
  await kv.put(ALL_GAMES_KEY, JSON.stringify(gamesMap));
}
__name(saveAllGamesMap, "saveAllGamesMap");
async function resetState(config) {
  const kv = getKv(config);
  await kv.put(ALL_GAMES_KEY, JSON.stringify({}));
  logger_default.info("Game state has been reset");
}
__name(resetState, "resetState");

// src/telegram/sender.js
var TELEGRAM_API_BASE = "https://api.telegram.org/bot";
async function sendMessage(text, config) {
  if (!config.telegramBotToken || !config.telegramChannelId) {
    logger_default.error("Telegram bot token or channel ID not configured");
    return null;
  }
  const url = `${TELEGRAM_API_BASE}${config.telegramBotToken}/sendMessage`;
  try {
    const botToken = "8043030599:AAGZJhyAie2Dx_xrflIqe0DxevmM5vGVg3g";
    const channelId = "@mlb_Alert";
    const response = await fetch(
      `https://api.telegram.org/bot8043030599:AAGZJhyAie2Dx_xrflIqe0DxevmM5vGVg3g/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: "@mlb_Alert",
          text: "test"
        })
      }
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Telegram API responded with ${response.status}: ${errorBody}`);
    }
    const data = await response.json();
    logger_default.info({ messageId: data.result?.message_id }, "Message sent to Telegram");
    return data;
  } catch (error) {
    logger_default.error({ error: error.message }, "Failed to send message to Telegram");
    throw error;
  }
}
__name(sendMessage, "sendMessage");
async function sendErrorAlert(context, errorMessage, config) {
  const text = [
    "\u{1F6A8} <b>\u062E\u0637\u0627 \u062F\u0631 \u0631\u0628\u0627\u062A MLB</b>",
    "",
    `\u{1F4CD} ${context}`,
    `\u274C ${errorMessage}`
  ].join("\n");
  try {
    await sendMessage(text, config);
  } catch (error) {
    logger_default.error({ error: error.message }, "Failed to send error alert to Telegram");
  }
}
__name(sendErrorAlert, "sendErrorAlert");

// src/messages/templates.js
function gameReminder24h(game) {
  const time = formatToTehranTime(game.gameDate);
  const date = formatToTehranDate(game.gameDate);
  return [
    "\u26BE \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0645\u0633\u0627\u0628\u0642\u0647",
    "",
    `\u{1F7E5} ${game.awayTeam}`,
    "",
    "\u{1F19A}",
    "",
    `\u{1F7E6} ${game.homeTeam}`,
    "",
    `\u{1F4C5} ${date}`,
    "",
    `\u{1F552} ${time}`,
    "",
    `\u{1F4CD} ${game.venue}`
  ].join("\n");
}
__name(gameReminder24h, "gameReminder24h");
function gameReminder3h(game) {
  const time = formatToTehranTime(game.gameDate);
  return [
    "\u23F0 \u062A\u0646\u0647\u0627 \u06F2 \u0633\u0627\u0639\u062A \u062A\u0627 \u0634\u0631\u0648\u0639 \u0645\u0633\u0627\u0628\u0642\u0647",
    "",
    `\u{1F7E5} ${game.awayTeam}`,
    "",
    "\u{1F19A}",
    "",
    `\u{1F7E6} ${game.homeTeam}`,
    "",
    `\u{1F552} ${time}`
  ].join("\n");
}
__name(gameReminder3h, "gameReminder3h");
function gameEnded(game) {
  const homeScore = game.homeScore ?? 0;
  const awayScore = game.awayScore ?? 0;
  return [
    "\u{1F3C1} \u067E\u0627\u06CC\u0627\u0646 \u0645\u0633\u0627\u0628\u0642\u0647",
    "",
    `\u{1F7E5} ${game.awayTeam} ${awayScore}`,
    "",
    `\u{1F7E6} ${game.homeTeam} ${homeScore}`,
    "",
    `\u{1F3C6} \u0628\u0631\u0646\u062F\u0647:`,
    `${game.winner || "\u0646\u0627\u0645\u0634\u062E\u0635"}`
  ].join("\n");
}
__name(gameEnded, "gameEnded");

// src/notifications/engine.js
async function runNotificationEngine(config) {
  logger_default.info("Starting notification engine");
  try {
    const gamesMap = await getAllGamesMap(config);
    let stateChanged = false;
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
        logger_default.info({ date, gameCount: parsed.length }, "Fetched games for date");
      } catch (error) {
        logger_default.error({ error: error.message, date }, "Failed to fetch schedule for date, skipping");
        await sendErrorAlert(`Failed to fetch schedule for ${date}`, error.message, config);
      }
    }
    if (allGames.length > 0) {
      logger_default.info({ totalGames: allGames.length }, "Processing games from API");
      for (const game of allGames) {
        const changed = processGameInMemory(game, gamesMap, config);
        if (changed) stateChanged = true;
      }
    }
    if (stateChanged) {
      await saveAllGamesMap(gamesMap, config);
      logger_default.info("State saved to KV");
    } else {
      logger_default.info("No state changes, skipping KV write");
    }
    logger_default.info("Notification engine completed");
  } catch (error) {
    logger_default.error({ error: error.message }, "Notification engine encountered an error");
    await sendErrorAlert("Notification engine", error.message, config);
  }
}
__name(runNotificationEngine, "runNotificationEngine");
function processGameInMemory(game, gamesMap, config) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = gamesMap[game.gameId];
  let changed = false;
  if (game.status === "Postponed" || game.status === "Cancelled") {
    if (!existing) {
      gamesMap[game.gameId] = createGameEntry(game, now);
      changed = true;
    }
    return changed;
  }
  if (existing) {
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
  if (config.notifications["24h"] && !entry.sent24h) {
    if (isApproximatelyNHoursAway(game.gameDate, 24, 30)) {
      logger_default.info({ gameId: game.gameId }, "Sending 24h notification");
      try {
        const message = gameReminder24h(game);
        sendMessage(message, config).catch((e) => {
          logger_default.error({ error: e.message, gameId: game.gameId }, "Failed to send 24h notification");
          sendErrorAlert(`Failed to send 24h notification for game ${game.gameId}`, e.message, config);
        });
        entry.sent24h = true;
        changed = true;
      } catch (error) {
        logger_default.error({ error: error.message, gameId: game.gameId }, "Failed to send 24h notification");
        sendErrorAlert(`Failed to send 24h notification for game ${game.gameId}`, error.message, config);
      }
    }
  }
  if (config.notifications["2h"] && !entry.sent2h) {
    if (isApproximatelyNHoursAway(game.gameDate, 2, 15)) {
      logger_default.info({ gameId: game.gameId }, "Sending 2h notification");
      try {
        const message = gameReminder3h(game);
        sendMessage(message, config).catch((e) => {
          logger_default.error({ error: e.message, gameId: game.gameId }, "Failed to send 2h notification");
          sendErrorAlert(`Failed to send 2h notification for game ${game.gameId}`, e.message, config);
        });
        entry.sent2h = true;
        changed = true;
      } catch (error) {
        logger_default.error({ error: error.message, gameId: game.gameId }, "Failed to send 2h notification");
        sendErrorAlert(`Failed to send 2h notification for game ${game.gameId}`, error.message, config);
      }
    }
  }
  if (config.notifications["gameEnd"] && !entry.sentFinal) {
    if (isGameFinal(game.status) && game.homeScore !== null && game.awayScore !== null) {
      logger_default.info({ gameId: game.gameId }, "Sending final result notification");
      try {
        const message = gameEnded(game);
        sendMessage(message, config).catch((e) => {
          logger_default.error({ error: e.message, gameId: game.gameId }, "Failed to send final notification");
          sendErrorAlert(`Failed to send final notification for game ${game.gameId}`, e.message, config);
        });
        entry.sentFinal = true;
        changed = true;
      } catch (error) {
        logger_default.error({ error: error.message, gameId: game.gameId }, "Failed to send final notification");
        sendErrorAlert(`Failed to send final notification for game ${game.gameId}`, error.message, config);
      }
    }
  }
  return changed;
}
__name(processGameInMemory, "processGameInMemory");
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
    updatedAt: now
  };
}
__name(createGameEntry, "createGameEntry");

// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    const config = loadConfig(env);
    const url = new URL(request.url);
    if (url.pathname === "/reset") {
      if (request.method === "POST") {
        logger_default.info("Resetting game state (POST /reset)");
        try {
          await resetState(config);
          return new Response("State reset. Run GET / to re-scan all games.", { status: 200 });
        } catch (error) {
          logger_default.error({ error: error.message }, "Failed to reset state");
          return new Response("Reset failed", { status: 500 });
        }
      }
      if (request.method === "GET") {
        logger_default.info("Resetting game state and running engine (GET /reset)");
        try {
          await resetState(config);
          await runNotificationEngine(config);
          return new Response("State reset and engine run completed.", { status: 200 });
        } catch (error) {
          logger_default.error({ error: error.message }, "Reset + engine run failed");
          return new Response("Reset + engine run failed", { status: 500 });
        }
      }
      return new Response("Method not allowed", { status: 405 });
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    logger_default.info("MLB Alert Bot triggered via HTTP");
    try {
      await runNotificationEngine(config);
      logger_default.info("MLB Alert Bot completed successfully");
      return new Response("OK", { status: 200 });
    } catch (error) {
      logger_default.error({ error: error.message, stack: error.stack }, "MLB Alert Bot failed");
      return new Response("Internal Server Error", { status: 500 });
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
    logger_default.info("MLB Alert Bot triggered via Cron Trigger");
    try {
      await runNotificationEngine(config);
      logger_default.info("MLB Alert Bot completed successfully");
    } catch (error) {
      logger_default.error({ error: error.message, stack: error.stack }, "MLB Alert Bot failed");
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
