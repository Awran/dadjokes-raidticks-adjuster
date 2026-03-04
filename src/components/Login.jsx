import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const AUTH_PROVIDER = String(import.meta.env.VITE_AUTH_PROVIDER || 'discord').toLowerCase()
const IS_DISCORD_LOGIN = AUTH_PROVIDER === 'discord' || AUTH_PROVIDER === 'hybrid'

const Login = ({ onSuccess }) => {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, accessDenied, accessDeniedMessage } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login()
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <h2>Sign In</h2>
        <p>
          {IS_DISCORD_LOGIN
            ? 'Use your Discord account. Admin features unlock automatically when your Discord roles map to the app admin role.'
            : 'Use your Microsoft account. Admin features unlock automatically when your account has the admin role.'}
        </p>
        
        <form onSubmit={handleSubmit}>
          {accessDenied && (
            <div className="notice notice--error">
              {accessDeniedMessage || 'Access denied. Your Discord account is not in a mapped member/admin role. Contact guild admins for access.'}
            </div>
          )}

          {error && (
            <div className="notice notice--error">
              {error}
            </div>
          )}

          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Redirecting...' : IS_DISCORD_LOGIN ? 'Continue with Discord' : 'Continue with Microsoft'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
