import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { formatDateTime } from '../utils/time'

const RaidHistory = ({ onSelectRaid = null, isReadOnly = false }) => {
  const [raids, setRaids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadRaids()
  }, [])

  const loadRaids = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.getRaids(50)
      setRaids(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load raids:', err)
      setError(err.message || 'Failed to load raid history')
      setRaids([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRaid = async (raidId, raidName) => {
    if (!confirm(`Are you sure you want to delete "${raidName}"?\n\nThis will:\n- Remove the raid\n- Delete all transactions\n- Reverse DKP changes for all players\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      await api.deleteRaid(raidId)
      setRaids(raids.filter(r => r.id !== raidId))
    } catch (err) {
      console.error('Failed to delete raid:', err)
      alert(`Failed to delete raid: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <p>Loading raid history...</p>
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
        <h2>Raid History</h2>
        <p>{raids.length} raids recorded</p>
      </div>

      <div className="raid-history">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Raid Name</th>
              <th>Attendance</th>
              <th>Source</th>
              {onSelectRaid && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {raids.length === 0 ? (
              <tr>
                <td colSpan={onSelectRaid ? '5' : '4'} className="text-center">
                  No raids found. Upload a raid to get started!
                </td>
              </tr>
            ) : (
              raids.map((raid) => (
                <tr key={raid.id}>
                  <td>
                    {formatDateTime(raid.date || raid.createdAt)}
                  </td>
                  <td>
                    <strong>{raid.name || 'Unnamed Raid'}</strong>
                  </td>
                  <td>{raid.attendanceCount || 0} players</td>
                  <td className="text-muted">
                    {raid.source === 'discord_bot' ? '🤖 Discord Bot' : '📊 Manual Upload'}
                  </td>
                  {onSelectRaid && (
                    <td>
                      <button
                        className="button button--small"
                        onClick={() => onSelectRaid?.(raid.id)}
                      >
                        {isReadOnly ? 'View' : 'View/Edit'}
                      </button>
                      {!isReadOnly && (
                        <button
                          className="button button--small button--danger"
                          onClick={() => handleDeleteRaid(raid.id, raid.name || 'Unnamed Raid')}
                          style={{ marginLeft: '8px' }}
                        >
                          Delete
                        </button>
                      )}
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

export default RaidHistory
