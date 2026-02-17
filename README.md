# Discord Music Bot

Slash-command music bot with reaction-based search selection and a DJ role gate.

## Features
- `/play` searches and shows top 5 results in an embed
- React `1️⃣`-`5️⃣` to select and play
- DJ role gated controls: `/skip`, `/stop`, `/pause`, `/resume`
- `/queue` and `/nowplaying` embeds

## Setup
1. Install deps
```bash
npm install
```
2. Configure env
```bash
copy .env.example .env
```
Fill in:
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID` (optional, but faster for testing)
- `DJ_ROLE` (default `DJ`)

3. Register slash commands
```bash
npm run deploy
```
4. Start the bot
```bash
npm start
```

## Commands
- `/play query:<song or url>`
- `/skip`
- `/stop`
- `/pause`
- `/resume`
- `/queue`
- `/nowplaying`

## Notes
- Bot needs `MESSAGE REACTIONS` and `READ MESSAGE HISTORY`.
- Bot must have permission to join/speak in voice channels.
