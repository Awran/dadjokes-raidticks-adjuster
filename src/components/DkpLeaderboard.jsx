import { useEffect, useState } from 'react'
import { api } from '../utils/api'

const DkpLeaderboard = ({ isAdmin = false, onSelectPlayer }) => {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingPlayerId, setDeletingPlayerId] = useState('')

  useEffect(() => {
    loadPlayers()
  }, [])

  const loadPlayers = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.getPlayers()
      // API returns array directly or empty array
      setPlayers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load players:', err)
      setError(err.message || 'Failed to load DKP data. API might not be configured yet.')
      setPlayers([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePlayer = async (playerId, playerName) => {
    const confirmed = window.confirm(`Delete player \"${playerName}\" and all their transactions?`)
    if (!confirmed) {
      return
    }

    try {
      setDeletingPlayerId(playerId)
      await api.deletePlayer(playerId)
      await loadPlayers()
    } catch (err) {
      alert(`Failed to delete player: ${err.message}`)
    } finally {
      setDeletingPlayerId('')
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <p>Loading DKP standings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="notice notice--error">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>DKP Leaderboard</h2>
        <p>{players.length} players tracked</p>
      </div>

      <div className="leaderboard">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th className="text-right">DKP Balance</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? '4' : '3'} className="text-center">
                  No players found. Upload a raid to get started!
                </td>
              </tr>
            ) : (
              players.map((player, index) => (
                <tr key={player.id}>
                  <td>{index + 1}</td>
                  <td>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => onSelectPlayer?.(player.id)}
                    >
                      <strong>{player.characterName || player.id}</strong>
                    </button>
                  </td>
                  <td className="text-right">
                    <strong>{(player.dkpBalance || 0).toFixed(1)}</strong>
                  </td>
                  {isAdmin && (
                    <td>
                      <button
                        className="button button--small button--danger"
                        onClick={() => handleDeletePlayer(player.id, player.characterName || player.id)}
                        disabled={deletingPlayerId === player.id}
                      >
                        {deletingPlayerId === player.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DkpLeaderboard
