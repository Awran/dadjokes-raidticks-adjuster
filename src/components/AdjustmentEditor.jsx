import { useEffect, useState } from 'react'

const buildDrafts = (rows) =>
	rows.reduce((acc, row) => {
		acc[row.userId] = { mode: 'flat', value: '', reason: '' }
		return acc
	}, {})

const AdjustmentEditor = ({ rows, onAddAdjustment, onRemoveAdjustment }) => {
	const [drafts, setDrafts] = useState(() => buildDrafts(rows))

	useEffect(() => {
		setDrafts(buildDrafts(rows))
	}, [rows])

	const updateDraft = (userId, updates) => {
		setDrafts((prev) => ({
			...prev,
			[userId]: { ...prev[userId], ...updates }
		}))
	}

	const handleAdd = (userId) => {
		const draft = drafts[userId]
		const numericValue = Number.parseFloat(draft.value)
		if (!draft.reason || Number.isNaN(numericValue) || numericValue === 0) {
			return
		}
		const row = rows.find((item) => item.userId === userId)
		if (!row) {
			return
		}
		const adjustment =
			draft.mode === 'percent'
				? {
						kind: 'percent',
						percent: numericValue,
						delta: Math.round((row.originalTicks * numericValue) / 100),
						reason: draft.reason.trim()
					}
				: {
						kind: 'flat',
						delta: numericValue,
						reason: draft.reason.trim()
					}
		onAddAdjustment(userId, adjustment)
		updateDraft(userId, { value: '', reason: '' })
	}

	return (
		<div className="adjustments">
			<div className="adjustments__header">
				<h2>Adjustments</h2>
				<p>Every change needs a delta and a reason. No silent edits.</p>
			</div>
			<div className="adjustments__list">
				{rows.map((row) => {
					const draft = drafts[row.userId] || {
						mode: 'flat',
						value: '',
						reason: ''
					}
					const numericValue = Number.parseFloat(draft.value)
					const isValid =
						draft.reason.trim().length > 0 &&
						!Number.isNaN(numericValue) &&
						numericValue !== 0
					return (
						<div key={row.userId} className="adjustments__card">
							<div className="adjustments__row">
								<div className="adjustments__identity">
									<h3>{row.name}</h3>
									<p className="muted">{row.userId}</p>
								</div>
								<label className="sr-only" htmlFor={`mode-${row.userId}`}>
									Adjustment type
								</label>
								<select
									id={`mode-${row.userId}`}
									value={draft.mode}
									onChange={(event) =>
										updateDraft(row.userId, { mode: event.target.value })
									}
								>
									<option value="flat">Flat</option>
									<option value="percent">Percent</option>
								</select>
								<label className="sr-only" htmlFor={`delta-${row.userId}`}>
									Delta
								</label>
								<input
									id={`delta-${row.userId}`}
									type="number"
									step="0.5"
									value={draft.value}
									onChange={(event) =>
										updateDraft(row.userId, { value: event.target.value })
									}
									placeholder={draft.mode === 'percent' ? '+5' : '+1'}
								/>
								<label className="sr-only" htmlFor={`reason-${row.userId}`}>
									Reason
								</label>
								<input
									id={`reason-${row.userId}`}
									type="text"
									value={draft.reason}
									onChange={(event) =>
										updateDraft(row.userId, { reason: event.target.value })
									}
									placeholder="Reason"
								/>
								<button
									type="button"
									className="button button--primary"
									disabled={!isValid}
									onClick={() => handleAdd(row.userId)}
								>
									Add
								</button>
							</div>

							{row.adjustments.length > 0 && (
								<div className="adjustments__entries">
									{row.adjustments.map((adjustment, index) => (
										<div key={`${row.userId}-${index}`} className="chip">
											<span>
												{adjustment.kind === 'percent' ? (
													<>
														{adjustment.percent >= 0 ? '+' : ''}
														{adjustment.percent}% ({
															adjustment.delta >= 0 ? '+' : ''
														}
														{adjustment.delta}) &mdash; {adjustment.reason}
													</>
												) : (
													<>
														{adjustment.delta >= 0 ? '+' : ''}
														{adjustment.delta} &mdash; {adjustment.reason}
													</>
												)}
											</span>
											<button
												type="button"
												onClick={() => onRemoveAdjustment(row.userId, index)}
												aria-label={`Remove adjustment ${index + 1}`}
											>
												Remove
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}

export default AdjustmentEditor
