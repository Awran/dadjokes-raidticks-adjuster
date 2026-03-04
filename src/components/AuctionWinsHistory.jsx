import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { formatDateTime } from '../utils/time'

const AuctionWinsHistory = () => {
  const [data, setData] = useState({ itemCount: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const result = await api.getAuctionWins()
        setData({
          itemCount: Number(result?.itemCount || 0),
          items: Array.isArray(result?.items) ? result.items : []
        })
      } catch (err) {
        console.error('Failed to load auction wins:', err)
        setError(err.message || 'Failed to load auction wins')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Auction Wins</h2>
        <p>
          {loading
            ? 'Loading...'
            : `${data.itemCount} items with recorded auction wins`}
        </p>
      </div>

      {error && <div className="notice notice--error">{error}</div>}

      {!loading && !error && data.items.length === 0 && (
        <div className="notice">No auction wins recorded yet.</div>
      )}

      {!loading && !error && data.items.map((item) => (
        <div key={item.itemName} className="raid-editor" style={{ padding: '12px 0' }}>
          <h3>
            {item.itemName}{' '}
            <span className="text-muted" style={{ fontWeight: 500 }}>
              ({item.totalWins} total wins)
            </span>
          </h3>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Raid</th>
                <th>Winner</th>
                <th className="text-right">Winning Bid</th>
              </tr>
            </thead>
            <tbody>
              {item.wins.map((win) => (
                <tr key={win.id}>
                  <td className="text-muted">{formatDateTime(win.timestamp)}</td>
                  <td className="text-muted">{win.raidName || '-'}</td>
                  <td>{win.winner || '-'}</td>
                  <td className="text-right"><strong>{Number(win.winningBid || 0).toFixed(1)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

export default AuctionWinsHistory
