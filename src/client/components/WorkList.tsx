import { GridList, GridListItem } from 'react-aria-components'
import type { WorkRow } from '../lib/types'

/** Anything sitting longer than this is called out - dwell is the number analysts are judged on. */
const STALE_HOURS = 24

function dwellLabel(hours: number | null): string {
    if (hours === null) return '—'
    if (hours < 1) return 'under 1h'
    if (hours < 48) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
}

function ownerLabel(row: WorkRow): string {
    if (row.kind === 'finding') return row.source ? `from ${row.source}` : 'unassigned'
    if (row.assigned_to) return row.assigned_to
    if (row.assignment_group) return `${row.assignment_group} (unassigned)`
    return 'unassigned'
}

function secondaryLabel(row: WorkRow): string {
    if (row.kind === 'finding') return row.ci || 'no CI matched'
    return row.state || ''
}

export function WorkList({
    rows,
    selectedId,
    onSelect,
    compact,
}: {
    rows: WorkRow[]
    selectedId: string | null
    onSelect: (row: WorkRow) => void
    compact: boolean
}) {
    return (
        <div className="worklist" data-compact={String(compact)}>
            <GridList
                aria-label="Work queue"
                items={rows}
                selectionMode="single"
                selectedKeys={selectedId ? [selectedId] : []}
                onAction={(key) => {
                    const row = rows.find((candidate) => candidate.sys_id === key)
                    if (row) onSelect(row)
                }}
            >
                {(row) => (
                    <GridListItem
                        key={row.sys_id}
                        id={row.sys_id}
                        className="row"
                        textValue={`${row.number ?? ''} ${row.title}`}
                        style={{ ['--sev' as string]: `var(--sev-${row.severity})` }}
                    >
                        <div className="row__id">
                            <span className="row__sev">{row.severity.toUpperCase()}</span>
                            <span className="row__number mono">{row.number || '—'}</span>
                        </div>

                        <div className="row__title">
                            {row.title}
                            {row.mine ? <span className="tag">mine</span> : null}
                            {!row.mine && row.my_team ? <span className="tag">team</span> : null}
                        </div>

                        <div className="row__owner">
                            {ownerLabel(row)}
                            {secondaryLabel(row) ? <div className="footnote">{secondaryLabel(row)}</div> : null}
                        </div>

                        <div className="row__dwell" data-stale={String((row.dwell_hours ?? 0) >= STALE_HOURS)}>
                            {dwellLabel(row.dwell_hours)}
                        </div>
                    </GridListItem>
                )}
            </GridList>
        </div>
    )
}
