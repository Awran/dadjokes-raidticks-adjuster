import {
	calculateAdjustmentTotal,
	calculateFinalTicks
} from '../utils/exportFormatters'

const AttendanceTable = ({ rows }) => {
	return (
		<div className="table-block">
			<div className="table-block__header">
				<h2>Attendance totals</h2>
				<p>Original ticks stay immutable. Totals are derived from adjustments.</p>
			</div>
			<div className="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>Player</th>
							<th>Original</th>
							<th>Adjustments</th>
							<th>Final</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const adjustmentTotal = calculateAdjustmentTotal(row)
							const finalTicks = calculateFinalTicks(row)
							return (
								<tr key={row.userId}>
									<td>
										<div className="player">
											<span className="player__name">{row.name}</span>
											<span className="player__id">{row.userId}</span>
										</div>
									</td>
									<td>{row.originalTicks}</td>
									<td
										className={
											adjustmentTotal !== 0 ? 'delta delta--active' : 'delta'
										}
									>
										{adjustmentTotal}
									</td>
									<td>{finalTicks}</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</div>
	)
}

export default AttendanceTable
