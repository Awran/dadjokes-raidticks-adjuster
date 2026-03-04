const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

const getAuthToken = () => null

const request = async (endpoint, options = {}) => {
  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (token && !options.skipAuth) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  })

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || 'Request failed',
      response.status,
      data
    )
  }

  return data
}

export const api = {
  // Auth
  getCurrentUser: async () => {
    const response = await fetch('/.auth/me', { credentials: 'include' })
    if (!response.ok) {
      return null
    }
    const payload = await response.json()
    const principal = payload?.clientPrincipal
    return principal || null
  },

  login: () => {
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=/'
  },

  logout: () => {
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/'
  },

  // Players (public endpoints)
  getPlayers: async () => {
    return request('/players', { skipAuth: true })
  },

  getPlayer: async (playerId) => {
    return request(`/players/${playerId}`, { skipAuth: true })
  },

  getPlayerTransactions: async (playerId) => {
    return request(`/players/${playerId}/transactions`, { skipAuth: true })
  },

  getAuctionWins: async () => {
    return request('/auction-wins', { skipAuth: true })
  },

  addPlayerReward: async (playerId, amount, reason) => {
    return request(`/players/${playerId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason })
    })
  },

  deletePlayer: async (playerId) => {
    return request(`/players/${playerId}`, {
      method: 'DELETE'
    })
  },

  // Raids
  uploadRaid: async (raidData) => {
    return request('/raids', {
      method: 'POST',
      body: JSON.stringify(raidData)
    })
  },

  importRaidBackup: async (backupData) => {
    return request('/raids/import-backup', {
      method: 'POST',
      body: JSON.stringify(backupData)
    })
  },

  getRaids: async (limit = 50) => {
    return request(`/raids?limit=${limit}`)
  },

  getRaid: async (raidId) => {
    return request(`/raids/${raidId}`)
  },

  applyRaidAward: async (raidId, amount, reason, playerIds = []) => {
    return request(`/raids/${raidId}/award`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason, playerIds })
    })
  },

  deleteRaid: async (raidId) => {
    return request(`/raids/${raidId}`, {
      method: 'DELETE'
    })
  },

  updateTransaction: async (transactionId, delta, reason) => {
    return request(`/transactions/${transactionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ delta, reason })
    })
  },

  deleteTransaction: async (transactionId) => {
    return request(`/transactions/${transactionId}`, {
      method: 'DELETE'
    })
  },

  // Bids
  saveBid: async (bidData) => {
    return request('/bids', {
      method: 'POST',
      body: JSON.stringify(bidData)
    })
  },

  getBids: async (raidId) => {
    return request(`/bids/${raidId}`)
  }
}

export { ApiError }
