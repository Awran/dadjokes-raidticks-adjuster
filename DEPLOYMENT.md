# DadJokes DKP Management System

A full-stack DKP (Dragon Kill Points) management system for guild raid tracking, built with React and Azure Functions.

## Features

- 📊 **DKP Leaderboard** - Real-time view of all player DKP balances
- 📤 **Raid Upload** - Admin interface to upload raid attendance with adjustments
- 🔐 **Authentication** - Discord OAuth with role-based member/admin access
- 📜 **Transaction History** - Track all DKP awards and changes
- 🤖 **Bot API** - Simple REST endpoints for Discord bot integration
- 💰 **Bid Tracking** - Record and view item bids

## Architecture

### Frontend
- **React 19** with hooks
- **Vite** for development and building
- Hosted on **Azure Static Web Apps (Free tier)**

### Backend
- **Azure Functions** (Node.js, serverless)
- **Azure Cosmos DB** (Free tier - NoSQL)
- REST API with Discord session auth and role-based authorization

### Cost: $0-2/month for 30 users

## Project Structure

```
├── src/                    # Frontend React app
│   ├── components/        # React components
│   ├── context/          # Auth context
│   ├── utils/            # API client and utilities
│   └── main.jsx          # App entry point
├── api/                   # Azure Functions backend
│   ├── src/              # Function endpoints
│   ├── lib/              # Database and auth utilities
│   ├── host.json         # Functions config
│   └── package.json      # Backend dependencies
└── staticwebapp.config.json  # Azure SWA config
```

## Local Development

### Prerequisites
- Node.js 18+
- Azure Functions Core Tools v4
- Azure account (for Cosmos DB)

### Setup

1. **Clone and install dependencies:**
```bash
npm install
cd api && npm install && cd ..
```

2. **Create Cosmos DB:**
- Go to Azure Portal
- Create a Cosmos DB account (NoSQL API)
- Enable **Free Tier**
- Copy the endpoint and primary key

3. **Configure environment:**
```bash
# Copy example env
cp .env.example .env

# Edit api/local.settings.json with your Cosmos DB credentials
```

4. **Run locally:**

Terminal 1 - Frontend:
```bash
npm run dev
```

Terminal 2 - Backend:
```bash
cd api
npm start
```

Frontend: http://localhost:5173
Backend: http://localhost:7071

### Initial Database Setup

The database containers will be created automatically on first run. Alternatively, create them manually:

Containers needed:
- `players` (partition key: `/id`)
- `raids` (partition key: `/id`)
- `transactions` (partition key: `/playerId`)
- `bids` (partition key: `/raidId`)
- `users` (partition key: `/email`)

## Deployment to Azure

### Option 1: GitHub Actions (Recommended)

1. **Create Azure Static Web App:**
```bash
# Install Azure CLI
# Create resource group
az group create --name dkp-rg --location eastus

# Create Static Web App with Azure Functions
az staticwebapp create \
  --name dadjokes-dkp \
  --resource-group dkp-rg \
  --location eastus2 \
  --source https://github.com/YOUR_USERNAME/YOUR_REPO \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --output-location "dist"
```

2. **Configure Environment Variables in Azure:**

Go to Azure Portal → Your Static Web App → Configuration

Add:
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DATABASE_ID`
- `SESSION_SECRET`
- `AUTH_PROVIDER` (`discord`, `hybrid`, `swa`)
- `AUTH_ALLOW_SWA_FALLBACK`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `COOKIE_SAMESITE`
- `COOKIE_SECURE`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_GUILD_ID`
- `DISCORD_ADMIN_ROLE_IDS`
- `DISCORD_MEMBER_ROLE_IDS`
- `DISCORD_ALLOW_ANY_GUILD_MEMBER`
- `DISCORD_SCOPES`
- `VITE_AUTH_PROVIDER` (`discord`, `hybrid`, `swa`)
- `DKP_API_KEY` (must match bot-side `DKP_API_KEY` for Discord integration)

3. **Push to GitHub - deploys automatically via GitHub Actions!**

```bash
git push origin main
```

GitHub Actions will automatically build and deploy to Azure Static Web App. Watch progress in your GitHub repo → **Actions** tab.

## Future Deployments

All future deployments are automatic via GitHub Actions. Just push your code:

```bash
git push origin main
```

Changes deploy within 2-5 minutes. No manual Azure CLI commands needed.

## API Endpoints

### Auth Endpoints

```
GET  /api/auth/discord/login   # Start Discord OAuth
GET  /api/auth/discord/callback # OAuth callback + session cookie
GET  /api/auth/me              # Resolve current principal
POST /api/auth/logout          # Clear current session
```

### Member Endpoints (requires `member` or `admin`)

```
GET  /api/players           # Get all players and DKP balances
GET  /api/players/{id}      # Get player details and transactions
GET  /api/raids             # Get raid history
GET  /api/raids/{raidId}    # Get raid details
GET  /api/auction-wins      # Get auction wins history
```

### Bot Endpoints (for Discord integration)

```
GET  /api/bot/dkp           # Get all player DKP (simplified)
GET  /api/bot/dkp/{userId}  # Get specific player DKP
```

### Admin Endpoints (requires `admin`)

```
POST /api/raids             # Upload raid attendance
POST /api/bids              # Save a bid
```

### Bot Integration Example

```javascript
// Get all DKP balances
const response = await fetch('https://your-app.azurestaticapps.net/api/bot/dkp')
const { players } = await response.json()
// players = [{ userId, name, dkp }, ...]

// Get specific player
const player = await fetch('https://your-app.azurestaticapps.net/api/bot/dkp/123456')
const { userId, name, dkp } = await player.json()
```

## Authentication

Login flow:
- User signs in with Discord OAuth
- API reads guild membership and Discord role IDs
- API maps Discord role IDs to app roles: `member` and `admin`
- Users without mapped role are redirected to `/pending`

Production mode settings:
- `AUTH_PROVIDER=discord`
- `VITE_AUTH_PROVIDER=discord`
- `AUTH_ALLOW_SWA_FALLBACK=false`

## Data Model

### Player
```json
{
  "id": "player-user-id",
  "displayName": "PlayerName",
  "totalDkp": 150.5,
  "lastUpdated": "2026-02-18T10:30:00Z"
}
```

### Raid
```json
{
  "id": "raid-1234567890",
  "name": "Raid attendance",
  "date": "2026-02-18T10:00:00Z",
  "uploadedBy": "admin@example.com",
  "attendanceCount": 30
}
```

### Transaction
```json
{
  "id": "player-123-1234567890",
  "playerId": "player-123",
  "amount": 10.5,
  "reason": "Raid attendance 2026-02-18",
  "raidId": "raid-1234567890",
  "timestamp": "2026-02-18T10:30:00Z"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, open a GitHub issue or contact the guild admin.
