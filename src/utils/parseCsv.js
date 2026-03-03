const EXPECTED_HEADERS = ['user_id', 'display_name', 'ticks']
const OPENDKP_HEADERS = ['player', 'raid', 'ticks', 'started', 'ended']

const normalizeHeader = (value) =>
	value.trim().toLowerCase().replace(/\s+/g, '_')

const isEmptyRow = (row) => row.every((cell) => cell.trim() === '')

const parseCsvRows = (text) => {
	const rows = []
	let current = ''
	let row = []
	let inQuotes = false

	const pushCell = () => {
		row.push(current)
		current = ''
	}

	const pushRow = () => {
		rows.push(row)
		row = []
	}

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i]
		const next = text[i + 1]

		if (char === '"') {
			if (inQuotes && next === '"') {
				current += '"'
				i += 1
			} else {
				inQuotes = !inQuotes
			}
			continue
		}

		if (char === ',' && !inQuotes) {
			pushCell()
			continue
		}

		if ((char === '\n' || char === '\r') && !inQuotes) {
			if (char === '\r' && next === '\n') {
				i += 1
			}
			pushCell()
			pushRow()
			continue
		}

		current += char
	}

	pushCell()
	pushRow()

	return rows
}

export const parseAttendanceCsv = (text) => {
	const errors = []
	const rows = parseCsvRows(text)
		.map((row) => row.map((cell) => cell.trim()))
		.filter((row) => !isEmptyRow(row))

	if (rows.length === 0) {
		return { rows: [], errors: ['CSV is empty.'] }
	}

	const headerRow = rows[0].map(normalizeHeader)
	const isAttendanceHeader = EXPECTED_HEADERS.every((header) =>
		headerRow.includes(header)
	)
	const isOpenDkpHeader = OPENDKP_HEADERS.every((header) =>
		headerRow.includes(header)
	)
	const hasHeader = isAttendanceHeader || isOpenDkpHeader

	const dataRows = hasHeader ? rows.slice(1) : rows
	const headerIndex = hasHeader
		? {
				userId: headerRow.indexOf('user_id'),
				name: headerRow.indexOf('display_name'),
				player: headerRow.indexOf('player'),
				ticks: headerRow.indexOf('ticks')
			}
		: { userId: 0, name: 1, player: -1, ticks: 2 }

	const parsed = dataRows.map((row, index) => {
		const lineNumber = hasHeader ? index + 2 : index + 1
		const name =
			row[headerIndex.name] || row[headerIndex.player] || ''
		// Use provided userId, otherwise create one from character name
		let userId = row[headerIndex.userId] || ''
		if (!userId && name) {
			// Sanitize character name to create a valid Cosmos DB ID
			userId = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
		}
		const ticksRaw = row[headerIndex.ticks] || ''
		const ticks = Number.parseFloat(ticksRaw)

		if (!name || Number.isNaN(ticks)) {
			errors.push(
				`Row ${lineNumber}: expected name and ticks columns.`
			)
			return null
		}

		return {
			userId,
			name,
			originalTicks: ticks,
			adjustments: []
		}
	})

	return {
		rows: parsed.filter(Boolean),
		errors
	}
}
