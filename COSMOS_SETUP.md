# Azure Cosmos DB Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create Cosmos DB Account

1. Go to Azure Portal: https://portal.azure.com
2. Click **"Create a resource"** → Search for **"Azure Cosmos DB"**
3. Click **"Create"** → Select **"Azure Cosmos DB for NoSQL"**
4. Fill in:
   - **Resource Group**: Use existing or create new (e.g., "dkp-system")
   - **Account Name**: `dadjokes-dkp-db` (must be globally unique)
   - **Location**: Choose closest region (e.g., East US)
   - **Capacity mode**: **Serverless** (FREE for low usage!)
5. Click **"Review + Create"** → **"Create"**
6. Wait 2-3 minutes for deployment

### Step 2: Create Database and Containers

Once deployed, click **"Go to resource"**:

1. In left menu, click **"Data Explorer"**
2. Click **"New Database"**:
   - Database id: `DkpDatabase`
   - Click **OK**

3. Click **"New Container"** (repeat 5 times):

   **Container 1: Players**
   - Database id: Use existing `DkpDatabase`
   - Container id: `players`
   - Partition key: `/id`
   
   **Container 2: Raids**
   - Database id: Use existing `DkpDatabase`
   - Container id: `raids`
   - Partition key: `/id`
   
   **Container 3: Transactions**
   - Database id: Use existing `DkpDatabase`
   - Container id: `transactions`
   - Partition key: `/playerId`
   
   **Container 4: Bids**
   - Database id: Use existing `DkpDatabase`
   - Container id: `bids`
   - Partition key: `/raidId`
   
   **Container 5: Users**
   - Database id: Use existing `DkpDatabase`
   - Container id: `users`
   - Partition key: `/id`

### Step 3: Get Connection Details

1. In Cosmos DB account, click **"Keys"** in left menu
2. Copy:
   - **URI** (looks like: `https://dadjokes-dkp-db.documents.azure.com:443/`)
   - **PRIMARY KEY** (long string)

### Step 4: Add to Azure Static Web App

1. Go to Azure Portal → Your Static Web App
2. Click **"Configuration"** in left menu
3. Click **"+ Add"** to add these environment variables:

   | Name | Value |
   |------|-------|
   | `COSMOS_ENDPOINT` | Paste your URI from Step 3 |
   | `COSMOS_KEY` | Paste your PRIMARY KEY from Step 3 |
   | `COSMOS_DATABASE_ID` | `DkpDatabase` |

4. Click **"Save"** at the top
5. Wait 1-2 minutes for changes to apply

### Step 5: Test

1. Go to your site: https://YOUR-APP.azurestaticapps.net
2. Sign in with Discord using a user mapped to `member` or `admin`
3. Try uploading the CSV with an `admin`-mapped user - should work now!

## Cost Estimate

With Serverless Cosmos DB:
- **First 1000 RU/s**: FREE
- **First 25 GB storage**: FREE
- **For 30 users, ~10 raids/month**: $0-1/month

## Troubleshooting

### "Already logged in" but still see error
Clear your browser cache and sign in again.

### Container creation fails
Make sure you're using **Serverless** capacity mode, not Provisioned.

### Can't find Keys section
Click on your Cosmos DB account name (not the database), then Keys should be in left menu.

## Verify Setup

Run this command to test API connection:

```bash
curl https://YOUR-APP.azurestaticapps.net/api/players
```

Should return `[]` (empty array) instead of 404 error once Cosmos is configured.
