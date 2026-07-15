# ⚾ MLB Alert Bot

A fully automated, serverless Telegram bot that monitors MLB games and sends Persian-language notifications at scheduled times using GitHub Actions.

## Features

- ✅ **24-hour reminder** — Notification one day before each game
- ✅ **3-hour reminder** — Reminder 3 hours before game start
- ✅ **Game end result** — Final score and winner after game completion
- ✅ **Duplicate prevention** — Each notification sent exactly once per game
- ✅ **Fully automated** — Runs via GitHub Actions every 15 minutes
- ✅ **No server required** — Free, serverless operation
- ✅ **Configurable** — Enable/disable each notification type via `config.json`

## How It Works

```
GitHub Actions (every 15 min)
        ↓
  Fetch MLB schedule (today & tomorrow)
        ↓
  For each game:
    - Check if 24h notification is due → send
    - Check if 3h notification is due → send
    - Check if game ended → send result
        ↓
  Update SQLite database (persisted via cache)
```

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the instructions
3. Save the bot token you receive

### 2. Create a Telegram Channel

1. Create a new channel (e.g., `@MLBAlerts`)
2. Add your bot as an administrator to the channel
3. Note the channel ID (e.g., `@channelusername` or `-1001234567890`)

### 3. Fork & Configure

1. Fork this repository
2. Add the following **repository secrets** in GitHub → Settings → Secrets and variables → Actions:
   - `TELEGRAM_BOT_TOKEN` — Your bot token from BotFather
   - `TELEGRAM_CHANNEL_ID` — Your channel ID (e.g., `@MLBAlerts`)

### 4. Configure Notifications (Optional)

Edit `config.json` to enable/disable notification types:

```json
{
  "notifications": {
    "24h": true,
    "3h": true,
    "gameStart": false,
    "gameEnd": true
  }
}
```

## Local Development

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your Telegram bot token and channel ID

# Run in dry-run mode (no messages sent)
npm run dry-run

# Run normally
npm start
```

## Project Structure

```
src/
├── index.js              # Main entry point
├── config.js             # Configuration loader
├── mlb/
│   ├── client.js         # MLB Stats API client
│   └── parser.js         # API data parser
├── db/
│   ├── database.js       # SQLite initialization
│   └── repository.js     # Database operations
├── notifications/
│   └── engine.js         # Notification decision logic
├── telegram/
│   └── sender.js         # Telegram message sender
├── messages/
│   └── templates.js      # Persian message templates
└── utils/
    ├── logger.js         # Logging (Pino)
    └── time.js           # Time utilities
```

## Adding New Leagues

The modular architecture supports adding other sports leagues:

1. Create a new module (e.g., `src/nba/client.js` and `src/nba/parser.js`)
2. Add league config to `config.json`
3. Extend the notification engine to iterate over multiple leagues

## License

MIT