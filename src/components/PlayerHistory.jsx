import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { formatDateTime } from '../utils/time'

const PlayerHistory = ({ playerId, onBack, isAdmin = false, onSelectRaid = null }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [awardAmount, setAwardAmount] = useState('')
  const [awardReason, setAwardReason] = useState('')
  const [addingAward, setAddingAward] = useState(false)

  useEffect(() => {
    loadPlayerHistory()
  }, [playerId])

  const loadPlayerHistory = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await api.getPlayerTransactions(playerId)
      setData(result)
    } catch (err) {
      console.error('Failed to load player history:', err)
      setError(err.message || 'Failed to load player history')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAward = async (event) => {
    event.preventDefault()

    const amount = Number.parseFloat(awardAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      alert('Award amount must be a positive number')
      return
    }

    try {
      setAddingAward(true)
      await api.addPlayerReward(playerId, amount, awardReason)
      setAwardAmount('')
      setAwardReason('')
      await loadPlayerHistory()
    } catch (err) {
      alert(`Failed to add award: ${err.message}`)
    } finally {
      setAddingAward(false)
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <p>Loading player history...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="notice notice--error">{error}</div>
        <button className="button" onClick={onBack}>
          Back to Leaderboard
        </button>
      </div>
    )
  }

  const player = data?.player
  const transactions = data?.transactions || []

  const formatRaidLabel = (transaction) => {
    if (transaction.raidName) {
      return transaction.raidName
    }

    if (transaction.raidId && transaction.raidId !== '-') {
      if (transaction.raidId.startsWith('bot-raid-')) {
        return `Bot Raid ${transaction.raidId.replace('bot-raid-', '')}`
      }
      if (transaction.raidId.startsWith('raid-')) {
        return `Raid ${transaction.raidId.replace('raid-', '')}`
      }
      return transaction.raidId
    }

    return '-'
  }

  const formatReason = (transaction, hasAdjustment) => {
    const rawReason = hasAdjustment ? '-' : (transaction.adjustmentReason || '-')

    if (!rawReason || rawReason === '-') {
      return '-'
    }

    return rawReason.replace(/^Raid\s+.+?\s+auction win:\s*/i, 'Auction win: ')
  }

  const ledgerRows = transactions.flatMap((transaction) => {
    const amount = Number(transaction.amount || 0)
    const originalAmount =
      typeof transaction.originalAmount === 'number'
        ? transaction.originalAmount
        : null
    const baseAmount = originalAmount ?? amount
    const hasAdjustment = originalAmount !== null && originalAmount !== amount

    const adjustedBy = transaction.adjustedByName
      ? `${transaction.adjustedByName}${transaction.adjustedByUserId ? ` (${transaction.adjustedByUserId})` : ''}`
      : (transaction.createdBy || transaction.adjustedByUserId || '-')

    const baseRow = {
      id: `${transaction.id}-entry`,
      timestamp: transaction.timestamp,
      type: transaction.type || 'raid_attendance',
      reason: formatReason(transaction, hasAdjustment),
      raidId: transaction.raidId || null,
      raidLabel: formatRaidLabel(transaction),
      amount: baseAmount,
      adjustedBy,
      isAdjustment: false
    }

    if (!hasAdjustment) {
      return [baseRow]
    }

    return [
      baseRow,
      {
        id: `${transaction.id}-adjustment`,
        timestamp: transaction.lastModified || transaction.timestamp,
        type: 'adjustment',
        reason: transaction.adjustmentReason || 'Manual adjustment',
        raidId: transaction.raidId || null,
        raidLabel: formatRaidLabel(transaction),
        amount: amount - baseAmount,
        adjustedBy,
        isAdjustment: true
      }
    ]
  })

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <button className="button button--ghost" onClick={onBack}>
            ← Back to Leaderboard
          </button>
          <h2>{player?.characterName || playerId}</h2>
          <p>
            Current DKP: {(player?.dkpBalance || 0).toFixed(1)} • {transactions.length} transactions
          </p>
        </div>
      </div>

      {isAdmin && (
        <form className="ledger-adjustment-panel" onSubmit={handleAddAward}>
          <h3>Add Award</h3>
          <p>Add a standalone award not tied to any raid.</p>
          <div className="ledger-adjustment-controls">
            <input
              type="number"
              step="0.1"
              min="0"
              value={awardAmount}
              onChange={(e) => setAwardAmount(e.target.value)}
              placeholder="Amount"
            />
            <input
              type="text"
              value={awardReason}
              onChange={(e) => setAwardReason(e.target.value)}
              placeholder="Reason"
            />
            <button
              className="button button--small"
              type="submit"
              disabled={addingAward}
            >
              {addingAward ? 'Adding...' : 'Add Award'}
            </button>
          </div>
        </form>
      )}

      <div className="raid-editor">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Entry</th>
              <th>By</th>
              <th>Reason</th>
              <th>Raid</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center">
                  No transactions found for this player.
                </td>
              </tr>
            ) : (
              ledgerRows.map((row) => (
                <tr key={row.id} className={row.isAdjustment ? 'ledger-row--adjustment' : ''}>
                  <td className="text-muted">
                    {formatDateTime(row.timestamp)}
                  </td>
                  <td>{row.type}</td>
                  <td className="text-muted">{row.adjustedBy}</td>
                  <td className="text-muted">
                    {row.reason}
                  </td>
                  <td className="text-muted">
                    {isAdmin && onSelectRaid && row.raidId && row.raidId !== '-' ? (
                      <button
                        type="button"
                        className="button button--small button--ghost"
                        onClick={() => onSelectRaid(row.raidId)}
                      >
                        {row.raidLabel}
                      </button>
                    ) : (
                      row.raidLabel
                    )}
                  </td>
                  <td className="text-right">
                    <strong>{row.amount >= 0 ? '+' : ''}{row.amount.toFixed(1)}</strong>
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

export default PlayerHistory
