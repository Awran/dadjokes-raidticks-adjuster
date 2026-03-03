import { useEffect, useState } from 'react'
import { api } from '../utils/api'

const buildMassAwardParticipants = (transactions = []) => {
  const baseTransactions = transactions.filter(
    (transaction) => transaction.type !== 'adjustment' && !transaction.parentTransactionId
  )

  const participantMap = new Map()
  for (const transaction of baseTransactions) {
    if (!transaction?.playerId || participantMap.has(transaction.playerId)) {
      continue
    }

    participantMap.set(transaction.playerId, {
      playerId: transaction.playerId,
      characterName: transaction.characterName || transaction.playerId
    })
  }

  return Array.from(participantMap.values()).sort((a, b) =>
    a.characterName.localeCompare(b.characterName)
  )
}

const RaidEditor = ({ raidId, onBack }) => {
  const [raid, setRaid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editBaseAmount, setEditBaseAmount] = useState(0)
  const [editMode, setEditMode] = useState('flat')
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [raidAwardAmount, setRaidAwardAmount] = useState('')
  const [raidAwardReason, setRaidAwardReason] = useState('')
  const [applyingRaidAward, setApplyingRaidAward] = useState(false)
  const [selectedAwardPlayerIds, setSelectedAwardPlayerIds] = useState([])
  const [showMassAwardPage, setShowMassAwardPage] = useState(false)

  const toNumber = (value, fallback = 0) => {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(value)
    return Number.isNaN(numeric) ? fallback : numeric
  }

  const calculateAdjustmentDelta = (baseAmount, mode, value) => {
    const numericValue = Number.parseFloat(value)
    if (Number.isNaN(numericValue)) {
      return null
    }

    return mode === 'percent'
      ? Math.round((baseAmount * numericValue) / 100)
      : numericValue
  }

  useEffect(() => {
    loadRaid()
  }, [raidId])

  const loadRaid = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.getRaid(raidId)
      setRaid(data)
    } catch (err) {
      console.error('Failed to load raid:', err)
      setError(err.message || 'Failed to load raid details')
    } finally {
      setLoading(false)
    }
  }

  const handleEditTransaction = (transaction) => {
    const baseAmount = transaction.amount

    setEditingTransaction(transaction.id)
    setEditBaseAmount(baseAmount)
    setEditMode('flat')
    setEditValue('')
    setEditReason('')
  }

  const handleCancelEdit = () => {
    setEditingTransaction(null)
    setEditBaseAmount(0)
    setEditMode('flat')
    setEditValue('')
    setEditReason('')
  }

  const handleSaveTransaction = async () => {
    try {
      setSaving(true)
      const delta = calculateAdjustmentDelta(editBaseAmount, editMode, editValue)
      
      if (delta === null || delta === 0) {
        alert('Adjustment must be a non-zero number')
        return
      }

      if (!editingTransaction) {
        alert('No transaction selected')
        return
      }

      await api.updateTransaction(editingTransaction, delta, editReason)
      
      // Reload raid data
      await loadRaid()
      
      // Clear editing state
      setEditingTransaction(null)
      setEditBaseAmount(0)
      setEditMode('flat')
      setEditValue('')
      setEditReason('')
    } catch (err) {
      alert(`Failed to update: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAdjustment = async (transactionId) => {
    if (!confirm('Delete this adjustment line item?')) {
      return
    }

    try {
      await api.deleteTransaction(transactionId)
      await loadRaid()
    } catch (err) {
      alert(`Failed to delete adjustment: ${err.message}`)
    }
  }

  const handleApplyRaidAward = async (event) => {
    event.preventDefault()

    const amount = Number.parseFloat(raidAwardAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      alert('Mass award amount must be a positive number')
      return
    }

    if (!raidAwardReason.trim()) {
      alert('Reason is required')
      return
    }

    if (selectedAwardPlayerIds.length === 0) {
      alert('Select at least one player')
      return
    }

    try {
      setApplyingRaidAward(true)
      const result = await api.applyRaidAward(raidId, amount, raidAwardReason, selectedAwardPlayerIds)
      setRaidAwardAmount('')
      setRaidAwardReason('')
      setShowMassAwardPage(false)
      await loadRaid()

      const awardedCount = Number(result?.awardedCount || 0)
      const participants = Number(result?.participants || 0)
      const failedCount = Number(result?.failedCount || 0)
      alert(`Mass award applied: ${awardedCount}/${participants} players${failedCount ? ` (${failedCount} failed)` : ''}`)
    } catch (err) {
      alert(`Failed to apply mass award: ${err.message}`)
    } finally {
      setApplyingRaidAward(false)
    }
  }

  const transactions = raid?.transactions || []
  const totalDkp = transactions.reduce((sum, transaction) => sum + toNumber(transaction.amount), 0)
  const selectedTransaction = transactions.find((transaction) => transaction.id === editingTransaction) || null
  const massAwardParticipants = buildMassAwardParticipants(transactions)

  useEffect(() => {
    setSelectedAwardPlayerIds(massAwardParticipants.map((participant) => participant.playerId))
  }, [raidId, raid?.transactions])

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
        <div className="notice notice--error">
          {error}
        </div>
        <button className="button" onClick={onBack}>
          Back to Raid History
        </button>
      </div>
    )
  }

  if (!raid) {
    return null
  }

  const baseTransactions = transactions.filter(
    (transaction) => transaction.type !== 'adjustment' && !transaction.parentTransactionId
  )
  const adjustmentTransactions = transactions.filter(
    (transaction) => transaction.type === 'adjustment' || transaction.parentTransactionId
  )

  const adjustmentsByParent = adjustmentTransactions.reduce((acc, transaction) => {
    const parentId = transaction.parentTransactionId || transaction.id
    if (!acc[parentId]) {
      acc[parentId] = []
    }
    acc[parentId].push(transaction)
    return acc
  }, {})

  const ledgerRows = baseTransactions.flatMap((transaction) => {
    const rows = [
      {
        id: `${transaction.id}-entry`,
        kind: 'entry',
        transaction,
        timestamp: transaction.timestamp,
        playerId: transaction.playerId,
        characterName: transaction.characterName,
        amount: toNumber(transaction.amount),
        entryType: transaction.type || 'raid_attendance',
        reason: '-'
      }
    ]

    const childAdjustments = (adjustmentsByParent[transaction.id] || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    )

    childAdjustments.forEach((adjustment) => {
      rows.push({
        id: `${adjustment.id}-adjustment`,
        kind: 'adjustment',
        transaction: adjustment,
        timestamp: adjustment.timestamp,
        playerId: adjustment.playerId,
        characterName: adjustment.characterName,
        amount: toNumber(adjustment.amount),
        entryType: 'adjustment',
        reason: adjustment.adjustmentReason || 'Manual adjustment'
      })
    })

    return rows
  })

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <button className="button button--ghost" onClick={onBack}>
            ← Back to History
          </button>
          <h2>{raid.name || 'Unnamed Raid'}</h2>
          <p>
            {new Date(raid.date || raid.createdAt).toLocaleString()} • 
            {raid.transactions?.length || 0} transactions • 
            Total DKP: {totalDkp.toFixed(1)}
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => setShowMassAwardPage(true)}
        >
          Open Mass Award Page
        </button>
      </div>

      <div className="raid-editor">
        {showMassAwardPage ? (
          <form className="ledger-adjustment-panel" onSubmit={handleApplyRaidAward}>
            <div className="panel__header">
              <div>
                <h3>Mass Award</h3>
                <p>Apply a bonus to selected players in this raid.</p>
              </div>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setShowMassAwardPage(false)}
              >
                Back to Raid Editor
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
              <button
                className="button button--small button--ghost"
                type="button"
                onClick={() => setSelectedAwardPlayerIds(massAwardParticipants.map((participant) => participant.playerId))}
              >
                Select All
              </button>
              <button
                className="button button--small button--ghost"
                type="button"
                onClick={() => setSelectedAwardPlayerIds([])}
              >
                Clear
              </button>
              <span className="text-muted">
                {selectedAwardPlayerIds.length} / {massAwardParticipants.length} selected
              </span>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '12px', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '8px' }}>
              {massAwardParticipants.map((participant) => {
                const checked = selectedAwardPlayerIds.includes(participant.playerId)
                return (
                  <label key={participant.playerId} style={{ display: 'block', marginBottom: '0.35rem' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedAwardPlayerIds((prev) => [...new Set([...prev, participant.playerId])])
                        } else {
                          setSelectedAwardPlayerIds((prev) => prev.filter((id) => id !== participant.playerId))
                        }
                      }}
                    />{' '}
                    {participant.characterName}
                  </label>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="number"
                step="0.1"
                min="0"
                value={raidAwardAmount}
                onChange={(e) => setRaidAwardAmount(e.target.value)}
                placeholder="Amount"
              />
              <input
                type="text"
                value={raidAwardReason}
                onChange={(e) => setRaidAwardReason(e.target.value)}
                placeholder="Reason"
                style={{ minWidth: '260px', flex: '1 1 260px' }}
              />
              <button
                className="button button--small"
                type="submit"
                disabled={applyingRaidAward}
              >
                {applyingRaidAward ? 'Applying...' : 'Apply Mass Award'}
              </button>
            </div>
          </form>
        ) : (
          <>
        {selectedTransaction && (
          <div className="ledger-adjustment-panel">
            <h3>Adjust Transaction</h3>
            <p>
              {selectedTransaction.characterName} • Base {editBaseAmount.toFixed(1)}
            </p>
            <div className="ledger-adjustment-controls">
              <select
                value={editMode}
                onChange={(e) => setEditMode(e.target.value)}
              >
                <option value="flat">Flat</option>
                <option value="percent">Percent</option>
              </select>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                step="0.1"
                placeholder={editMode === 'percent' ? '+5' : '+1'}
              />
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Reason for adjustment"
              />
              <span className="text-muted">
                Delta: {
                  (() => {
                    const nextDelta = calculateAdjustmentDelta(editBaseAmount, editMode, editValue)
                    return nextDelta === null ? '-' : nextDelta.toFixed(1)
                  })()
                }
              </span>
              <button
                className="button button--small"
                onClick={handleSaveTransaction}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                className="button button--small button--ghost"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Player</th>
              <th>User ID</th>
              <th>Entry</th>
              <th>Reason</th>
              <th className="text-right">Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center">
                  No transactions found for this raid.
                </td>
              </tr>
            ) : (
              ledgerRows.map((row) => (
                <tr key={row.id} className={row.kind === 'adjustment' ? 'ledger-row--adjustment' : ''}>
                  <td className="text-muted">
                    {new Date(row.timestamp).toLocaleTimeString()}
                  </td>
                  <td>
                    {row.kind === 'adjustment'
                      ? <span className="text-muted">↳ {row.characterName}</span>
                      : <strong>{row.characterName}</strong>}
                  </td>
                  <td className="text-muted">{row.playerId}</td>
                  <td>
                    <span className={row.kind === 'adjustment' ? 'text-muted' : ''}>
                      {row.entryType}
                    </span>
                  </td>
                  <td>
                    <span className="text-muted">{row.reason}</span>
                  </td>
                  <td className="text-right">
                    <strong>{row.amount >= 0 ? '+' : ''}{row.amount.toFixed(1)}</strong>
                  </td>
                  <td>
                    {row.kind === 'entry' ? (
                      <button
                        className="button button--small"
                        onClick={() => handleEditTransaction(row.transaction)}
                      >
                        Adjust
                      </button>
                    ) : row.kind === 'adjustment' ? (
                      <button
                        className="button button--small button--danger"
                        onClick={() => handleDeleteAdjustment(row.transaction.id)}
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
          </>
        )}
      </div>
    </div>
  )
}

export default RaidEditor
