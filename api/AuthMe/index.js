const { extractSessionFromRequest } = require('../lib/discordAuth')

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    return []
  }

  return roles
    .map((role) => String(role || '').trim().toLowerCase())
    .filter(Boolean)
}

module.exports = async function (context, req) {
  try {
    const principal = extractSessionFromRequest(req)

    if (principal) {
      const roles = normalizeRoles(principal.userRoles)
      const isMember = roles.includes('member') || roles.includes('admin')
      if (!isMember) {
        context.res = {
          status: 403,
          body: { error: 'Access denied: member role required' }
        }
        return
      }
    }

    context.res = {
      status: 200,
      body: {
        clientPrincipal: principal || null
      }
    }
  } catch (error) {
    context.log.error('AuthMe failed', error)
    context.res = {
      status: 500,
      body: { error: 'Unable to resolve current user' }
    }
  }
}