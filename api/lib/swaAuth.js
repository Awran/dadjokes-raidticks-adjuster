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

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    return []
  }

  return roles
    .map((role) => String(role || '').trim().toLowerCase())
    .filter(Boolean)
}

function requireAuthenticated(context, req) {
  const principal = parseClientPrincipal(req)
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
  requireAdminRole
}
