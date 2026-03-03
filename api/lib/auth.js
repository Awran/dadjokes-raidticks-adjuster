import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())

/**
 * Verify JWT token and extract user info
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

/**
 * Generate JWT token for user
 */
export const generateToken = (user) => {
  const payload = {
    email: user.email,
    name: user.name,
    isAdmin: ADMIN_EMAILS.includes(user.email)
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Authentication middleware for Azure Functions
 */
export const requireAuth = (handler) => {
  return async (request, context) => {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        status: 401,
        jsonBody: { error: 'Missing or invalid authorization header' }
      }
    }

    const token = authHeader.substring(7)
    const user = verifyToken(token)

    if (!user) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid or expired token' }
      }
    }

    // Attach user to request for downstream use
    request.user = user
    return handler(request, context)
  }
}

/**
 * Admin-only middleware
 */
export const requireAdmin = (handler) => {
  return requireAuth(async (request, context) => {
    if (!request.user.isAdmin) {
      return {
        status: 403,
        jsonBody: { error: 'Admin access required' }
      }
    }
    return handler(request, context)
  })
}
