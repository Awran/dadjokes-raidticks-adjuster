import { app } from '@azure/functions'
import { generateToken } from '../lib/auth.js'
import { getContainer, CONTAINERS } from '../lib/cosmos.js'

app.http('Login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: async (request, context) => {
    try {
      const body = await request.json()
      const { email, password } = body
      
      if (!email || !password) {
        return {
          status: 400,
          jsonBody: { error: 'Email and password required' }
        }
      }

      // In production, verify password hash from database
      // For now, using simple auth for admin emails
      const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
      
      // Simple password check (replace with proper auth later)
      const isValidPassword = password === process.env.ADMIN_PASSWORD || password === 'changeme'
      
      if (!isValidPassword || !ADMIN_EMAILS.includes(email)) {
        return {
          status: 401,
          jsonBody: { error: 'Invalid credentials' }
        }
      }

      const user = {
        email,
        name: email.split('@')[0]
      }

      const token = generateToken(user)
      
      return {
        status: 200,
        jsonBody: {
          token,
          user: {
            email: user.email,
            name: user.name,
            isAdmin: ADMIN_EMAILS.includes(email)
          }
        }
      }
    } catch (error) {
      context.error('Error during login:', error)
      return {
        status: 500,
        jsonBody: { error: 'Login failed' }
      }
    }
  }
})
