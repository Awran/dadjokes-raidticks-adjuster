import { useState } from 'react'

const FileLoader = ({ onLoad }) => {
	const [status, setStatus] = useState('')

	const handleFileChange = (event) => {
		const file = event.target.files?.[0]
		if (!file) {
			return
		}

		setStatus('Reading backup JSON...')

		const reader = new FileReader()
		reader.onload = () => {
			try {
				const text = `${reader.result || ''}`
				const backup = JSON.parse(text)

				const uploadPayload = backup?.apiReplay?.uploadRaid?.payload
				const attendanceCount = Array.isArray(uploadPayload?.attendance)
					? uploadPayload.attendance.length
					: 0

				if (!uploadPayload || attendanceCount === 0) {
					onLoad({ backup: null, errors: ['Invalid backup JSON: missing apiReplay.uploadRaid.payload.attendance'], fileName: '' })
					setStatus('Invalid backup JSON.')
					return
				}

				onLoad({ backup, errors: [], fileName: file.name })
				setStatus(`Loaded ${file.name}`)
			} catch (_error) {
				onLoad({ backup: null, errors: ['Failed to parse JSON backup file.'], fileName: '' })
				setStatus('Failed to parse JSON backup file.')
			}
		}

		reader.onerror = () => {
			onLoad({ backup: null, errors: ['Failed to read file.'], fileName: '' })
			setStatus('Failed to read file.')
		}

		reader.readAsText(file)
	}

	return (
		<div className="file-loader">
			<div>
				<h2>Load raid backup JSON</h2>
				<p>
					Upload the bot-generated backup file (for example, <strong>raid_123_backup.json</strong>)
					 to replay raid upload and settlement transactions in SWA.
				</p>
			</div>
			<div className="file-loader__controls">
				<label className="button" htmlFor="backup-json-input">
					Choose JSON
				</label>
				<input
					id="backup-json-input"
					className="sr-only"
					type="file"
					accept=".json,application/json"
					onChange={handleFileChange}
				/>
				{status && <span className="file-loader__status">{status}</span>}
			</div>
		</div>
	)
}

export default FileLoader
