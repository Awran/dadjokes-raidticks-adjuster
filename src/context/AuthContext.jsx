import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../utils/api'

const AuthContext = createContext(null)

const normalizeRoles = (roles) =>
  Array.isArray(roles)
    ? roles
        .map((role) => String(role || '').trim().toLowerCase())
        .filter(Boolean)
    : []

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('')

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const principal = await api.getCurrentUser()
        setUser(principal || null)
        setAccessDenied(false)
        setAccessDeniedMessage('')
      } catch (_error) {
        if (_error?.status === 403) {
          setAccessDenied(true)
          setAccessDeniedMessage(_error.message || 'Access denied: member role required')
          if (typeof window !== 'undefined' && window.location.pathname !== '/pending') {
            window.location.href = '/pending'
          }
        } else {
          setAccessDenied(false)
          setAccessDeniedMessage('')
        }
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    bootstrapAuth()
  }, [])

  const login = async () => {
    setAccessDenied(false)
    setAccessDeniedMessage('')
    api.login()
  }

  const logout = async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setAccessDenied(false)
      setAccessDeniedMessage('')
    }
  }

  const value = {
    user,
    login,
    logout,
    loading,
    accessDenied,
    accessDeniedMessage,
    isAuthenticated: !!user,
    isAdmin: normalizeRoles(user?.userRoles).includes('admin')
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
