const formatNumber = (value) => {
	const numeric = Number(value)
	if (Number.isNaN(numeric)) {
		return '0'
	}
	const asString = numeric.toString()
	return asString
}

const escapeCsvValue = (value) => {
	const text = `${value ?? ''}`
	if (/[",\n\r]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`
	}
	return text
}

export const calculateAdjustmentTotal = (row) =>
	row.adjustments.reduce((sum, adj) => sum + adj.delta, 0)

export const calculateFinalTicks = (row) =>
	row.originalTicks + calculateAdjustmentTotal(row)

export const formatDiscordOutput = (rows) => {
	const lines = []
	const adjustedRows = rows.filter((row) => row.adjustments.length > 0)

	if (adjustedRows.length === 0) {
		return 'No adjustments yet.'
	}

	lines.push('Attendance adjustments')
	lines.push('')

	adjustedRows.forEach((row) => {
		const total = calculateFinalTicks(row)
		lines.push(
			`- ${row.name} (${row.userId}): ${formatNumber(
				row.originalTicks
			)} -> ${formatNumber(total)}`
		)
		row.adjustments.forEach((adj) => {
			const sign = adj.delta >= 0 ? '+' : ''
			if (adj.kind === 'percent') {
				const percentSign = adj.percent >= 0 ? '+' : ''
				lines.push(
					`  ${percentSign}${formatNumber(adj.percent)}% (${sign}${formatNumber(
						adj.delta
					)}) : ${adj.reason}`
				)
				return
			}
			lines.push(`  ${sign}${formatNumber(adj.delta)} : ${adj.reason}`)
		})
		lines.push('')
	})

	return lines.join('\n').trim()
}

export const formatOpenDkpCsv = (rows, reason) => {
	const header = ['Player', 'DKP', 'Reason']
	const lines = [header.map(escapeCsvValue).join(',')]

	rows.forEach((row) => {
		const finalTicks = calculateFinalTicks(row)
		lines.push(
			[row.name, formatNumber(finalTicks), reason]
				.map(escapeCsvValue)
				.join(',')
		)
	})

	return lines.join('\n')
}
