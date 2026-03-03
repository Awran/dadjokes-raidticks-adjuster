import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const Login = ({ onSuccess }) => {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

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
        <p>Use your Microsoft account. Admin features unlock automatically when your account has the <strong>admin</strong> role.</p>
        
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="notice notice--error">
              {error}
            </div>
          )}

          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Redirecting...' : 'Continue with Microsoft'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
