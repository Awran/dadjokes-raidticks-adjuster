# 🚀 Step-by-Step Deployment Guide

## Prerequisites
- Azure account (free tier works!)
- GitHub account
- Your code in a GitHub repository (with admin access)

---

## Overview

Deployment is **fully automated via GitHub Actions**. Simply push your code to the `main` branch and GitHub Actions will:
1. Build your React frontend
2. Build your Azure Functions API
3. Deploy everything to Azure Static Web App

No manual Azure CLI commands required! ✨

---

## Step 1: Create Azure Cosmos DB (5 minutes)

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"**
3. Search for **"Azure Cosmos DB"**
4. Click **"Create"** → **"Azure Cosmos DB for NoSQL"**
5. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new → `dkp-rg`
   - **Account Name**: `dadjokes-dkp` (must be globally unique)
   - **Location**: Choose closest to you
   - **Capacity mode**: ✅ **Serverless** (cheaper!)
   - **Apply Free Tier Discount**: ✅ **Yes** (if available)
6. Click **"Review + Create"** → **"Create"**
7. Wait 2-3 minutes for deployment

### Get Cosmos DB Credentials

1. Once deployed, click **"Go to resource"**
2. In left menu, click **"Keys"**
3. Copy and save:
   - **URI** (e.g., `https://dadjokes-dkp.documents.azure.com:443/`)
   - **PRIMARY KEY** (long string)

---

## Step 2: Create Azure Static Web App via GitHub (5 minutes)

**GitHub Actions integration is required for automated deployment.**

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"**
3. Search for **"Static Web App"**
4. Click **"Create"**
5. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new → `dkp-rg`
   - **Name**: `dadjokes-dkp`
   - **Plan type**: **Free**
   - **Region**: Choose closest to you
   - **Deployment source**: **GitHub** ⭐
6. Click **"Sign in with GitHub"** and authorize Azure
7. Select:
   - **Organization**: Your GitHub username
   - **Repository**: Your repo name
   - **Branch**: `main`
8. **Build Details**:
   - **Build Presets**: `Custom`
   - **App location**: `/` (root)
   - **Api location**: `api`
   - **Output location**: `dist`
9. Click **"Review + Create"** → **"Create"**

✅ **GitHub Actions workflow is now automatically configured!** Azure will create a workflow file in your repo at `.github/workflows/`.

---

## Step 3: Configure Environment Variables in Azure Portal

1. Go to Azure Portal → Your Static Web App → **Configuration** in left menu
2. Click **"+ Add"** for each variable:

| Name | Value | Example |
|------|-------|---------|
| `COSMOS_ENDPOINT` | URI from Step 1 | `https://dadjokes-dkp.documents.azure.com:443/` |
| `COSMOS_KEY` | Primary Key from Step 1 | `abc123...` |
| `COSMOS_DATABASE_ID` | `DkpDatabase` | `DkpDatabase` |
| `JWT_SECRET` | Any random string (32+ chars) | `my-super-secret-jwt-key-change-me-123456` |
| `ADMIN_PASSWORD` | Your admin password | `YourSecurePassword123!` |
| `ADMIN_EMAILS` | Comma-separated admin emails | `you@example.com,admin@guild.com` |
| `DKP_API_KEY` | Shared bot API secret | `use-a-long-random-secret` |

3. Click **"Save"** at the top

`DKP_API_KEY` must match the bot's `DKP_API_KEY` environment variable exactly for Discord bot integration to work.

✅ **Configuration is saved!**

---

## Step 4: Enable Automatic Deployment

Push your code to GitHub and **GitHub Actions will automatically deploy**:

```powershell
# Ensure your code is in the repo
git push origin main
```

Then:
1. Go to your GitHub repo → **Actions** tab
2. Watch the **Static Web App CI/CD** workflow run
3. Once complete (green checkmark ✅), your app is live!

---

## Step 5: Get Your App URL

Once the GitHub Actions workflow completes:
1. Go to your Static Web App in Azure Portal → **Overview**
2. Copy your **URL** (e.g., `https://nice-river-xxx.azurestaticapps.net`)

---

## Step 6: Initialize Database

Visit your app URL - the database containers will be created automatically on first API call.

To verify:
1. Go to Cosmos DB resource in Azure Portal
2. Click **"Data Explorer"**
3. You should see database `DkpDatabase` with containers:
   - `players`
   - `raids`
   - `transactions`
   - `bids`
   - `users`

---

## Step 7: Login & Test

1. Go to your app URL
2. Login with:
   - **Email**: One of your `ADMIN_EMAILS`
   - **Password**: Your `ADMIN_PASSWORD`
3. Upload a test raid CSV
4. View the DKP leaderboard

---

## 🎉 You're Done!

Your app is now live and **automatically deploys on every push to main**! 🚀

**App URL**: `https://YOUR-APP.azurestaticapps.net`

---

## Future Deployments

Just push to GitHub and GitHub Actions handles everything:
```powershell
git push origin main
```

Your changes will automatically build and deploy within 2-5 minutes. Watch the progress in GitHub → **Actions** tab.

---

## Bot API Endpoints

For your Discord bot:
```
GET https://YOUR-APP.azurestaticapps.net/api/bot/dkp
GET https://YOUR-APP.azurestaticapps.net/api/bot/dkp/{userId}
```

---

## Troubleshooting

### GitHub Actions Workflow Failed

1. Go to your GitHub repo → **Actions** tab
2. Click the failed workflow run
3. Check the logs for errors
4. Common issues:
   - **Missing Configuration Variables**: Ensure all env vars are set in Azure Portal
   - **Cosmos DB Connection Failed**: Verify `COSMOS_ENDPOINT` and `COSMOS_KEY` are correct
   - **Build Error**: Check `npm run build` works locally first

### "Failed to fetch" error in app

- Check Configuration variables are saved in Azure Portal
- Wait 2-3 minutes after saving config for changes to propagate
- Check GitHub Actions workflow completed successfully (green checkmark ✅)

### "Invalid credentials" on login

- Verify email matches one in `ADMIN_EMAILS` configuration
- Check `ADMIN_PASSWORD` is correct in Configuration

### Database errors in app

- Verify `COSMOS_ENDPOINT` and `COSMOS_KEY` are correct in Configuration
- Check Cosmos DB is in "Available" state in Azure Portal
- Ensure database `DkpDatabase` was created (not `dkp`)

---

## Costs

With the setup above:
- **Static Web App**: Free tier = $0
- **Cosmos DB**: Serverless with free tier = $0-2/month
- **Total**: $0-2/month for 30 users ✅

---

## Next Steps

- Set up custom domain (optional)
- Configure your Discord bot to use the API
- Add more admin users to `ADMIN_EMAILS`
- Monitor usage in Azure Portal
