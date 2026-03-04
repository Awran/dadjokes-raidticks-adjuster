const { extractSessionFromRequest } = require('./discordAuth')

function parseClientPrincipal(req) {
  const encoded =
    req?.headers?.['x-ms-client-principal'] ||
    req?.headers?.['X-MS-CLIENT-PRINCIPAL'] ||
    req?.headers?.['x-ms-client-principal'.toLowerCase()]

  if (!encoded || typeof encoded !== 'string') {
    return null
  }

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    return JSON.parse(decoded)
  } catch (_error) {
    return null
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

function getAuthProviderMode() {
  return String(process.env.AUTH_PROVIDER || 'swa').trim().toLowerCase()
}

function shouldUseDiscordAuth() {
  const mode = getAuthProviderMode()
  return mode === 'discord' || mode === 'hybrid'
}

function allowSwaFallback() {
  return parseBoolean(process.env.AUTH_ALLOW_SWA_FALLBACK, true)
}

function getPrincipal(req) {
  if (shouldUseDiscordAuth()) {
    const discordPrincipal = extractSessionFromRequest(req)
    if (discordPrincipal) {
      return discordPrincipal
    }

    if (!allowSwaFallback()) {
      return null
    }
  }

  return parseClientPrincipal(req)
}

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    return []
  }

  return roles
    .map((role) => String(role || '').trim().toLowerCase())
    .filter(Boolean)
}

function requireAuthenticated(context, req) {
  const principal = getPrincipal(req)
  const roles = normalizeRoles(principal?.userRoles)
  const isAuthenticated = roles.includes('authenticated')

  if (!principal || !isAuthenticated) {
    context.res = {
      status: 401,
      body: { error: 'Authentication required' }
    }
    return null
  }

  return principal
}

function requireMemberRole(context, req) {
  const principal = requireAuthenticated(context, req)
  if (!principal) {
    return null
  }

  const roles = normalizeRoles(principal.userRoles)
  const isMember = roles.includes('member') || roles.includes('admin')
  if (!isMember) {
    context.res = {
      status: 403,
      body: { error: 'Member access required' }
    }
    return null
  }

  return principal
}

function requireAdminRole(context, req) {
  const principal = requireAuthenticated(context, req)
  if (!principal) {
    return null
  }

  const roles = normalizeRoles(principal.userRoles)
  if (!roles.includes('admin')) {
    context.res = {
      status: 403,
      body: { error: 'Admin access required' }
    }
    return null
  }

  return principal
}

module.exports = {
  parseClientPrincipal,
  requireAuthenticated,
  requireMemberRole,
  requireAdminRole
}
