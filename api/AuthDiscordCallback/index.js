const {
  buildPrincipalFromDiscordCode,
  createSetCookieHeader,
  signSession,
  verifyStateToken
} = require('../lib/discordAuth')

module.exports = async function (context, req) {
  try {
    const code = req?.query?.code
    const state = req?.query?.state

    if (!code || !state) {
      context.res = {
        status: 400,
        body: { error: 'Missing OAuth code or state' }
      }
      return
    }

    const statePayload = verifyStateToken(state)
    if (!statePayload) {
      context.res = {
        status: 400,
        body: { error: 'Invalid or expired OAuth state' }
      }
      return
    }

    const principal = await buildPrincipalFromDiscordCode(code)
    const token = signSession(principal)
    const setCookie = createSetCookieHeader(token)
    const redirectTarget = statePayload.redirectPath || '/'

    context.res = {
      status: 302,
      headers: {
        Location: redirectTarget,
        'Set-Cookie': setCookie,
        'Cache-Control': 'no-store'
      }
    }
  } catch (error) {
    context.log.error('Discord callback failed', error)

    const errorMessage = String(error?.message || '').toLowerCase()

    if (
      errorMessage.includes('unknown member') ||
      errorMessage.includes('unknown guild') ||
      errorMessage.includes('guild membership')
    ) {
      context.res = {
        status: 302,
        headers: {
          Location: '/pending?reason=guild-unavailable',
          'Cache-Control': 'no-store'
        }
      }
      return
    }

    if (errorMessage.includes('access denied')) {
      context.res = {
        status: 302,
        headers: {
          Location: '/pending?reason=not-approved',
          'Cache-Control': 'no-store'
        }
      }
      return
    }

    context.res = {
      status: 500,
      body: { error: error.message || 'Discord authentication failed' }
    }
  }
}