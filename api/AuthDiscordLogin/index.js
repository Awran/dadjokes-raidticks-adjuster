const { createStateToken, getDiscordAuthorizeUrl } = require('../lib/discordAuth')

module.exports = async function (context, req) {
  try {
    const redirectPath = req?.query?.redirect || '/'
    const state = createStateToken({ redirectPath })
    const location = getDiscordAuthorizeUrl({ state })

    context.res = {
      status: 302,
      headers: {
        Location: location,
        'Cache-Control': 'no-store'
      }
    }
  } catch (error) {
    context.log.error('Discord login init failed', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Unable to initiate Discord login' }
    }
  }
}