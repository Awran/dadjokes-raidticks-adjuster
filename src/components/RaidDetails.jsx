import { useEffect, useMemo, useState } from 'react'
import { api } from '../utils/api'
import { formatDateTime, formatTime } from '../utils/time'

const RaidDetails = ({ raidId, onBack }) => {
  const [raid, setRaid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadRaid = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await api.getRaid(raidId)
        setRaid(data)
      } catch (err) {
        console.error('Failed to load raid details:', err)
        setError(err.message || 'Failed to load raid details')
      } finally {
        setLoading(false)
      }
    }

    loadRaid()
  }, [raidId])

  const rows = useMemo(() => {
    const transactions = Array.isArray(raid?.transactions) ? raid.transactions : []
    return [...transactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  }, [raid])

  if (loading) {
    return (
      <div className="panel">
        <p>Loading raid details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="notice notice--error">{error}</div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <button className="button button--ghost" onClick={onBack}>
            ← Back to History
          </button>
          <h2>{raid?.name || 'Unnamed Raid'}</h2>
          <p>
            {formatDateTime(raid?.date || raid?.createdAt)} • {rows.length} transactions
          </p>
        </div>
      </div>

      <div className="raid-editor">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Player</th>
              <th>User ID</th>
              <th>Entry</th>
              <th>Reason</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center">
                  No transactions found for this raid.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="text-muted">{formatTime(row.timestamp)}</td>
                  <td>
                    <strong>{row.characterName || '-'}</strong>
                  </td>
                  <td className="text-muted">{row.playerId || '-'}</td>
                  <td>{row.type || '-'}</td>
                  <td className="text-muted">{row.adjustmentReason || '-'}</td>
                  <td className="text-right">
                    <strong>{Number(row.amount || 0) >= 0 ? '+' : ''}{Number(row.amount || 0).toFixed(1)}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RaidDetails
