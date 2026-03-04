const jwt = require('jsonwebtoken')
const { randomUUID } = require('crypto')

const DISCORD_API_BASE = 'https://discord.com/api'
const DEFAULT_COOKIE_NAME = 'dkp_session'
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 12
const DEFAULT_STATE_TTL_SECONDS = 60 * 10

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
}

function getCookieName() {
  return process.env.SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || ''
}

function getSessionTtlSeconds() {
  const raw = Number.parseInt(process.env.SESSION_TTL_SECONDS || '', 10)
  if (Number.isNaN(raw) || raw <= 0) {
    return DEFAULT_SESSION_TTL_SECONDS
  }
  return raw
}

function getDiscordScopes() {
  const configured = parseCsv(process.env.DISCORD_SCOPES)
  if (configured.length > 0) {
    return configured
  }
  return ['identify', 'guilds.members.read']
}

function parseCookies(cookieHeader) {
  const cookies = {}
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies
  }

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.split('=')
    if (!name) {
      continue
    }

    const key = name.trim()
    const value = rest.join('=').trim()
    if (!key) {
      continue
    }

    cookies[key] = decodeURIComponent(value)
  }

  return cookies
}

function getCookieHeader(req) {
  return req?.headers?.cookie || req?.headers?.Cookie || ''
}

function createSetCookieHeader(token, { maxAgeSeconds } = {}) {
  const cookieName = getCookieName()
  const maxAge = Number.isInteger(maxAgeSeconds) ? maxAgeSeconds : getSessionTtlSeconds()
  const secure = (process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production'
  const sameSite = process.env.COOKIE_SAMESITE || 'Lax'

  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${maxAge}`
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function createClearCookieHeader() {
  const cookieName = getCookieName()
  const secure = (process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production'
  const sameSite = process.env.COOKIE_SAMESITE || 'Lax'
  const parts = [
    `${cookieName}=`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Max-Age=0'
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function createStateToken({ redirectPath }) {
  const secret = getSessionSecret()
  if (!secret) {
    throw new Error('SESSION_SECRET or JWT_SECRET is required')
  }

  return jwt.sign(
    {
      type: 'discord_oauth_state',
      nonce: randomUUID(),
      redirectPath: redirectPath || '/'
    },
    secret,
    { expiresIn: DEFAULT_STATE_TTL_SECONDS }
  )
}

function verifyStateToken(stateToken) {
  const secret = getSessionSecret()
  if (!secret || !stateToken) {
    return null
  }

  try {
    const payload = jwt.verify(stateToken, secret)
    if (payload?.type !== 'discord_oauth_state') {
      return null
    }
    return payload
  } catch (_error) {
    return null
  }
}

function signSession(principal) {
  const secret = getSessionSecret()
  if (!secret) {
    throw new Error('SESSION_SECRET or JWT_SECRET is required')
  }

  return jwt.sign(
    {
      type: 'discord_session',
      principal
    },
    secret,
    { expiresIn: getSessionTtlSeconds() }
  )
}

function verifySessionToken(token) {
  const secret = getSessionSecret()
  if (!secret || !token) {
    return null
  }

  try {
    const payload = jwt.verify(token, secret)
    if (payload?.type !== 'discord_session' || !payload.principal) {
      return null
    }
    return payload.principal
  } catch (_error) {
    return null
  }
}

function extractSessionFromRequest(req) {
  const cookies = parseCookies(getCookieHeader(req))
  const cookieToken = cookies[getCookieName()]
  if (cookieToken) {
    const principal = verifySessionToken(cookieToken)
    if (principal) {
      return principal
    }
  }

  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || ''
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim()
    const principal = verifySessionToken(bearer)
    if (principal) {
      return principal
    }
  }

  return null
}

function resolveAppRoles(discordRoleIds) {
  const normalizedDiscordRoleIds = new Set((discordRoleIds || []).map((roleId) => String(roleId)))
  const adminRoleIds = parseCsv(process.env.DISCORD_ADMIN_ROLE_IDS)
  const memberRoleIds = parseCsv(process.env.DISCORD_MEMBER_ROLE_IDS)

  const appRoles = new Set(['authenticated'])

  if (adminRoleIds.some((roleId) => normalizedDiscordRoleIds.has(roleId))) {
    appRoles.add('admin')
    appRoles.add('member')
  }

  if (memberRoleIds.some((roleId) => normalizedDiscordRoleIds.has(roleId))) {
    appRoles.add('member')
  }

  const allowAnyGuildMember = normalizeRole(process.env.DISCORD_ALLOW_ANY_GUILD_MEMBER) === 'true'
  if (allowAnyGuildMember && discordRoleIds && discordRoleIds.length > 0) {
    appRoles.add('member')
  }

  return Array.from(appRoles)
}

function hasMemberAccess(appRoles) {
  const roles = new Set((appRoles || []).map((role) => String(role || '').trim().toLowerCase()))
  return roles.has('member') || roles.has('admin')
}

function ensureDiscordEnv() {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = process.env.DISCORD_REDIRECT_URI
  const guildId = process.env.DISCORD_GUILD_ID

  if (!clientId || !clientSecret || !redirectUri || !guildId) {
    throw new Error('Missing Discord OAuth settings: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, DISCORD_GUILD_ID')
  }

  return { clientId, clientSecret, redirectUri, guildId }
}

function getDiscordAuthorizeUrl({ state }) {
  const { clientId, redirectUri } = ensureDiscordEnv()
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: getDiscordScopes().join(' '),
    state,
    prompt: 'consent'
  })

  return `${DISCORD_API_BASE}/oauth2/authorize?${query.toString()}`
}

async function exchangeCodeForToken(code) {
  const { clientId, clientSecret, redirectUri } = ensureDiscordEnv()

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  })

  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })

  const payload = await response.json()
  if (!response.ok) {
    const message = payload?.error_description || payload?.error || 'Discord token exchange failed'
    throw new Error(message)
  }

  if (!payload?.access_token) {
    throw new Error('Discord token response missing access_token')
  }

  return payload
}

async function fetchDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const payload = await response.json()
  if (!response.ok || !payload?.id) {
    throw new Error('Unable to fetch Discord user profile')
  }

  return payload
}

async function fetchGuildMember(accessToken, guildId) {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to fetch Discord guild membership')
  }

  return payload
}

async function buildPrincipalFromDiscordCode(code) {
  const { guildId } = ensureDiscordEnv()
  const tokenPayload = await exchangeCodeForToken(code)
  const [user, member] = await Promise.all([
    fetchDiscordUser(tokenPayload.access_token),
    fetchGuildMember(tokenPayload.access_token, guildId)
  ])

  const discordRoles = Array.isArray(member?.roles) ? member.roles.map((roleId) => String(roleId)) : []
  const appRoles = resolveAppRoles(discordRoles)
  if (!hasMemberAccess(appRoles)) {
    throw new Error('Access denied: Discord user is not mapped to a member role')
  }

  const username = user.global_name || user.username || user.id
  const principal = {
    identityProvider: 'discord',
    userId: user.id,
    userDetails: username,
    userRoles: appRoles,
    claims: [
      { typ: 'name', val: username },
      { typ: 'discord_user_id', val: String(user.id) },
      { typ: 'discord_guild_id', val: String(guildId) },
      { typ: 'discord_username', val: String(user.username || '') }
    ],
    discord: {
      id: user.id,
      username: user.username,
      globalName: user.global_name || null,
      avatar: user.avatar || null,
      guildId,
      roleIds: discordRoles
    }
  }

  return principal
}

module.exports = {
  buildPrincipalFromDiscordCode,
  createClearCookieHeader,
  createSetCookieHeader,
  createStateToken,
  extractSessionFromRequest,
  getDiscordAuthorizeUrl,
  signSession,
  verifyStateToken
}