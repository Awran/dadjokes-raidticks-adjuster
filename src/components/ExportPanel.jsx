import { useMemo, useState } from 'react'
import { formatDiscordOutput, formatOpenDkpCsv } from '../utils/exportFormatters'

const ExportPanel = ({ rows, onUpload, uploading = false }) => {
	const [raidDate, setRaidDate] = useState(
		new Date().toISOString().slice(0, 10)
	)
	const [reasonPrefix, setReasonPrefix] = useState('Raid attendance')

	const reason = `${reasonPrefix} ${raidDate}`.trim()

	const discordOutput = useMemo(() => formatDiscordOutput(rows), [rows])
	const dkpOutput = useMemo(
		() => formatOpenDkpCsv(rows, reason),
		[rows, reason]
	)

	const handleCopy = async (text) => {
		if (!navigator.clipboard) {
			return
		}
		await navigator.clipboard.writeText(text)
	}

	const handleDownloadCsv = () => {
		const blob = new Blob([dkpOutput], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = `raid-attendance-${raidDate || 'export'}.csv`
		document.body.appendChild(link)
		link.click()
		link.remove()
		URL.revokeObjectURL(url)
	}

	return (
		<div className="export">
			<div className="export__header">
				<h2>Review & Upload</h2>
				<p>Review changes and upload to the DKP system.</p>
			</div>

			<div className="export__controls">
				<label>
					Reason prefix
					<input
						type="text"
						value={reasonPrefix}
						onChange={(event) => setReasonPrefix(event.target.value)}
					/>
				</label>
				<label>
					Raid date
					<input
						type="date"
						value={raidDate}
						onChange={(event) => setRaidDate(event.target.value)}
					/>
				</label>
				<button
					type="button"
					className="button button--primary"
					onClick={() => onUpload?.(reason, raidDate)}
					disabled={uploading}
				>
					{uploading ? 'Uploading...' : 'Upload to DKP System'}
				</button>
			</div>

			<div className="export__grid">
				<div className="export__card">
					<div className="export__card-header">
						<h3>Discord accountability</h3>
						<button
							type="button"
							className="button button--ghost"
							onClick={() => handleCopy(discordOutput)}
						>
							Copy text
						</button>
					</div>
					<textarea readOnly value={discordOutput} rows={10} />
				</div>

				<div className="export__card">
					<div className="export__card-header">
						<h3>OpenDKP CSV</h3>
						<div className="export__actions">
							<button
								type="button"
								className="button button--ghost"
								onClick={() => handleCopy(dkpOutput)}
							>
								Copy CSV
							</button>
							<button
								type="button"
								className="button"
								onClick={handleDownloadCsv}
							>
								Download CSV
							</button>
						</div>
					</div>
					<textarea readOnly value={dkpOutput} rows={10} />
				</div>
			</div>
		</div>
	)
}

export default ExportPanel
