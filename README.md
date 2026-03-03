# 🎮 DadJokes DKP Management System

A serverless, full-stack DKP tracking system with React + Azure Functions.

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
    "JWT_SECRET": "your-secret-key-here",
    "ADMIN_PASSWORD": "changeme",
    "ADMIN_EMAILS": "admin@example.com"
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
- Use Azure Static Web Apps built-in sign in (Microsoft account)
- Admin features appear automatically when your SWA role includes `admin`

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
- ✅ JWT authentication
- ✅ Bot API endpoints
- ✅ Bid tracking

## 🔐 Site Access (Azure Static Web Apps)

This site is protected by Azure Static Web Apps authentication and role-based authorization.

- Users are redirected to Microsoft sign-in (`/.auth/login/aad`) if not authenticated.
- GitHub sign-in is disabled for this app.
- App and API access require either `member` or `admin` role.
- Authenticated users without required role are redirected to `/pending`.

### Approval flow

1. User signs in with Microsoft account.
2. If not yet approved, user lands on the pending approval page.
3. Azure admin assigns user role (`member` or `admin`) in Static Web Apps Role Management.
4. User refreshes and gains app access.

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

### Public
- `GET /api/players` - All players
- `GET /api/players/{id}` - Player details
- `GET /api/raids` - Raid history

### Admin (requires auth)
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
- Email must match one in `ADMIN_EMAILS`
- Password must match `ADMIN_PASSWORD`

## 📄 License
MIT
