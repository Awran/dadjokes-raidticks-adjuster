# 🎮 DadJokes DKP Management System

A serverless, full-stack DKP tracking system with React + Azure Functions.

## 📌 Source of Truth

- Core setup and day-to-day usage: [README.md](./README.md)
- Production auth cutover and rollback: [DISCORD_CUTOVER.md](./DISCORD_CUTOVER.md)
- Step-by-step Azure deployment walkthrough: [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)
- Full architecture and API reference: [DEPLOYMENT.md](./DEPLOYMENT.md)

## ⚡️ Quick Start

### 1. Install Dependencies
```bash
npm install
npm run install:api
```

### 2. Setup Cosmos DB (Azure Portal)
- Create a Cosmos DB account (NoSQL API)
- Enable **Free Tier** ✅
- Copy the endpoint and key

### 3. Configure Backend
Edit `api/local.settings.json`:
```json
{
  "Values": {
    "COSMOS_ENDPOINT": "https://YOUR-ACCOUNT.documents.azure.com:443/",
    "COSMOS_KEY": "your-primary-key-here",
    "COSMOS_DATABASE_ID": "DkpDatabase",
    "DKP_API_KEY": "a-long-random-shared-secret",
    "SESSION_SECRET": "your-secret-key-here",
    "AUTH_PROVIDER": "discord",
    "AUTH_ALLOW_SWA_FALLBACK": "false",
    "DISCORD_CLIENT_ID": "your-discord-client-id",
    "DISCORD_CLIENT_SECRET": "your-discord-client-secret",
    "DISCORD_REDIRECT_URI": "http://localhost:7071/api/auth/discord/callback",
    "DISCORD_GUILD_ID": "your-discord-guild-id",
    "DISCORD_ADMIN_ROLE_IDS": "comma-separated-admin-role-ids",
    "DISCORD_MEMBER_ROLE_IDS": "comma-separated-member-role-ids",
    "VITE_AUTH_PROVIDER": "discord"
  }
}
```

### 4. Run Development Servers

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend API:**
```bash
npm run dev:api
```

- Frontend: http://localhost:5173
- API: http://localhost:7071

### 5. Sign in
- Use the configured auth provider (`VITE_AUTH_PROVIDER`):
  - `discord` or `hybrid`: Discord OAuth
  - `swa`: Azure Static Web Apps (Microsoft)
- Admin features appear automatically when your app role includes `admin`

## 📁 Project Structure
```
├── src/              # React frontend
│   ├── components/   # UI components
│   ├── context/      # Auth context
│   └── utils/        # API client
├── api/              # Azure Functions backend
│   ├── src/          # Function endpoints
│   └── lib/          # Database & auth
└── staticwebapp.config.json  # Azure deployment config
```

## 🚀 Features
- ✅ DKP Leaderboard
- ✅ Admin raid upload with adjustments
- ✅ Transaction history
- ✅ Discord OAuth role-based authentication
- ✅ Bot API endpoints
- ✅ Bid tracking

## 🔐 Site Access (Azure Static Web Apps)

SWA route authorization is now configured as anonymous for app/API paths, and authentication/authorization is enforced in the app/API layer.

- Login is initiated by the frontend via provider-specific flow.
- Discord role IDs are mapped to app roles (`member`, `admin`) in API configuration.
- Member/admin operations are enforced server-side via shared middleware.
- Users without mapped `member`/`admin` roles are denied and redirected to `/pending`.

### Approval flow

1. User signs in with Discord.
2. API reads Discord guild (server) membership and Discord roles.
3. API maps Discord roles to app roles (`member`/`admin`) and issues session.
4. User refreshes and receives role-based app access.

## 🔄 Discord OAuth Migration (Phase 1)

Discord OAuth endpoints are available with provider feature flags for migration and production cutover.

- `GET /api/auth/discord/login?redirect=/` - starts Discord OAuth
- `GET /api/auth/discord/callback` - handles OAuth callback and sets session cookie
- `GET /api/auth/me` - returns `{ clientPrincipal }` from app session
- `POST /api/auth/logout` - clears app session cookie

### Enable Discord auth mode

Set these `api/local.settings.json` values (and corresponding Azure app settings in cloud):

- `AUTH_PROVIDER=discord` for Discord-only auth, or `AUTH_PROVIDER=hybrid` to allow Discord plus SWA fallback
- `AUTH_ALLOW_SWA_FALLBACK=true|false`
- `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `SESSION_TTL_SECONDS`
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DISCORD_GUILD_ID`
- `DISCORD_ADMIN_ROLE_IDS`, `DISCORD_MEMBER_ROLE_IDS`, `DISCORD_ALLOW_ANY_GUILD_MEMBER`

Frontend feature flag:

- `VITE_AUTH_PROVIDER=swa|hybrid|discord`
- Use `discord` to fully test Discord login UX, `hybrid` for Discord-first with SWA fallback, and `swa` for current behavior.

Mode alignment (set frontend + API together):

- `discord`: production Discord-only mode
- `hybrid`: migration/testing mode with SWA fallback
- `swa`: legacy SWA/Entra mode

For security, keep `COOKIE_SECURE=true` in production.

See [DISCORD_CUTOVER.md](./DISCORD_CUTOVER.md) for production cutover + rollback steps.

## 📖 Full Documentation
See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Azure deployment guide
- API documentation
- Bot integration examples
- Data models

## 💰 Cost
**$0-2/month** for 30 users using Azure Free Tier

## 🤖 Bot API
```bash
# Get all DKP balances
GET /api/bot/dkp

# Get specific player
GET /api/bot/dkp/{userId}
```

## 📝 API Endpoints

### Member (requires `member` or `admin`)
- `GET /api/players` - All players
- `GET /api/players/{id}` - Player details
- `GET /api/raids` - Raid history

### Admin (requires `admin`)
- `POST /api/raids` - Upload raid
- `POST /api/bids` - Save bid

## 🔧 Development
```bash
# Frontend only
npm run dev

# Backend only
npm run dev:api

# Build for production
npm run build
```

## 🐛 Troubleshooting

**CORS errors?**
- Make sure backend is running on port 7071
- Check `VITE_API_URL` in `.env`

**Database errors?**
- Verify Cosmos DB credentials in `api/local.settings.json`
- Check that Free Tier is enabled

**Login not working?**
- Verify `VITE_AUTH_PROVIDER` and `AUTH_PROVIDER` are set as intended
- Verify Discord OAuth redirect URI matches `DISCORD_REDIRECT_URI`
- Verify `DISCORD_GUILD_ID` and role ID mappings are correct for your Discord guild (server)

## 📄 License
MIT
