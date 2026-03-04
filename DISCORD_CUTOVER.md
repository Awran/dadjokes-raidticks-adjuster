# Discord Auth Production Cutover (Phase 3)

This document captures the **exact route-policy cutover** for moving from SWA role-gated auth to app-managed Discord auth.

## What changed

`staticwebapp.config.json` was changed to make app and API paths anonymous, so auth enforcement happens in the application/API layer:

- `/api/*` allowed roles: `anonymous`
- `/*` allowed roles: `anonymous`
- Removed `responseOverrides.401` Entra redirect (`/.auth/login/aad?...`)
- Removed `responseOverrides.403` pending-page redirect

Access policy is now deny-by-default at app/API layer:

- `admin` Discord roles map to app `admin` (and `member`) access
- `member` Discord roles map to app `member` access
- Users without mapped `member` or `admin` roles are denied access

Denied-user behavior:

- Discord callback denies unmapped users and redirects to `/pending`
- Frontend bootstrap redirects to `/pending` when `/api/auth/me` returns `403`
- `/pending` provides guidance and sign-out action

## Mode alignment

Use matching frontend and API mode values:

- `discord`: Discord-only auth flow
- `hybrid`: Discord-first, SWA fallback (migration/testing)
- `swa`: legacy SWA/Entra flow

Recommended production cutover mode: `discord` (frontend + API).

## Required app settings

### Frontend (Static Web App)

- `VITE_AUTH_PROVIDER=discord`

### API (Functions app)

- `AUTH_PROVIDER=discord`
- `AUTH_ALLOW_SWA_FALLBACK=false`
- `SESSION_SECRET=<strong-random-secret>`
- `SESSION_COOKIE_NAME=dkp_session`
- `SESSION_TTL_SECONDS=43200`
- `COOKIE_SAMESITE=Lax`
- `COOKIE_SECURE=true`

Discord settings:

- `DISCORD_CLIENT_ID=<discord-app-client-id>`
- `DISCORD_CLIENT_SECRET=<discord-app-client-secret>`
- `DISCORD_REDIRECT_URI=https://<your-swa-domain>/api/auth/discord/callback`
- `DISCORD_GUILD_ID=<discord-guild-id>`
- `DISCORD_ADMIN_ROLE_IDS=<comma-separated-role-ids>`
- `DISCORD_MEMBER_ROLE_IDS=<comma-separated-role-ids>`
- `DISCORD_ALLOW_ANY_GUILD_MEMBER=false`
- `DISCORD_SCOPES=identify,guilds.members.read`

## Validation checklist

1. Hit `/api/auth/discord/login` and confirm redirect to Discord.
2. Complete login and verify callback sets `dkp_session` cookie.
3. Call `/api/auth/me` and confirm `clientPrincipal.userRoles` includes expected app roles.
4. Validate denied-user flow: login with a Discord account lacking mapped roles and confirm redirect to `/pending`.
5. Confirm member endpoints (`GetPlayers`, `GetRaids`, `GetRaid`, `GetAuctionWins`, `GetPlayerTransactions` GET) require `member` or `admin`.
6. Confirm admin-only actions (`UploadRaid`, `DeleteRaid`, etc.) work only with mapped admin role.
7. Confirm logout clears the cookie via `POST /api/auth/logout`.

## Rollback plan

1. Set frontend `VITE_AUTH_PROVIDER=swa`.
2. Set API `AUTH_PROVIDER=swa` and `AUTH_ALLOW_SWA_FALLBACK=true`.
3. Restore SWA role-gated routes in `staticwebapp.config.json`:
   - `/api/*` -> `member,admin`
   - `/*` -> `member,admin`
4. Restore `responseOverrides` for 401/403 Entra and pending redirects if required.
5. Redeploy and verify `/.auth/login/aad` flow.
