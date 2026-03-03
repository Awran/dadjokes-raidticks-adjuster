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

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const principal = await api.getCurrentUser()
        setUser(principal || null)
      } catch (_error) {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    bootstrapAuth()
  }, [])

  const login = async () => {
    api.login()
  }

  const logout = () => {
    api.logout()
    setUser(null)
  }

  const value = {
    user,
    login,
    logout,
    loading,
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
