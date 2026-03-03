function getHeader(req, name) {
  if (!req?.headers) {
    return ''
  }

  return req.headers[name] || req.headers[name.toLowerCase()] || req.headers[name.toUpperCase()] || ''
}

function requireBotApiKey(context, req) {
  const configured = (process.env.DKP_API_KEY || '').trim()

  if (!configured) {
    context.log.warn('DKP_API_KEY is not configured')
    context.res = {
      status: 500,
      body: { error: 'Bot API security is not configured' }
    }
    return false
  }

  const provided = (getHeader(req, 'x-bot-api-key') || '').trim()
  if (!provided || provided !== configured) {
    context.res = {
      status: 401,
      body: { error: 'Unauthorized bot API request' }
    }
    return false
  }

  return true
}

module.exports = {
  requireBotApiKey
}
