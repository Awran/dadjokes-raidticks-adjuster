const { createClearCookieHeader } = require('../lib/discordAuth')

module.exports = async function (context) {
  try {
    context.res = {
      status: 204,
      headers: {
        'Set-Cookie': createClearCookieHeader(),
        'Cache-Control': 'no-store'
      }
    }
  } catch (error) {
    context.log.error('Auth logout failed', error)
    context.res = {
      status: 500,
      body: { error: 'Unable to complete logout' }
    }
  }
}