import { SEVERITIES, type Scope, type WorkRow } from '../lib/types'
import { AGING_BUCKETS, bucketOf, type DrillTarget, type Slice } from './charts/geometry'
import { BarChart, Donut, Metric, StackedBar, type DrillHandler } from './charts/Charts'
import type { PanelDef } from './PanelHost'

/**
 * "How am I doing?"
 *
 * Computed entirely from the rows already on screen - no extra request, and it can never disagree
 * with the list beneath it. That consistency is worth more here than any metric a second query
 * could add: a chart that contradicts the list it sits above destroys trust in both.
 *
 * It also makes drill-in exact. The overview has to describe its numbers as a query and accept that
 * a restricted viewer sees fewer records than the count claims. Here every value names the precise
 * rows it was computed from, which are by definition rows this user can already see.
 */

/** Table is unused for an id-backed target: the console drills into rows it already holds. */
function target(key: string, label: string, matched: WorkRow[]): DrillTarget {
    return { key, label, count: matched.length, table: '', query: null, ids: matched.map((row) => row.sys_id) }
}

const SEVERITY_LABEL: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Info',
}

function formatDwell(hours: number | null): string {
    if (hours === null) return '—'
    if (hours < 1) return '<1h'
    if (hours < 48) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
}

export function buildMyMetricsPanels(rows: WorkRow[], scope: Scope, onDrill: DrillHandler): PanelDef[] {
    const scopeWord = scope === 'me' ? 'assigned to you' : scope === 'team' ? 'across your team' : 'across the instance'

    const bySeverity: Slice[] = SEVERITIES.map((severity) => {
        const matched = rows.filter((row) => row.severity === severity)
        return {
            label: SEVERITY_LABEL[severity],
            value: matched.length,
            color: `var(--sev-${severity})`,
            drill: target(severity, `${SEVERITY_LABEL[severity]} in view`, matched),
        }
    }).filter((slice) => slice.value > 0)

    const byAge: Slice[] = AGING_BUCKETS.map((bucket) => {
        const matched = rows.filter((row) => bucketOf(row.dwell_hours) === bucket.key)
        return {
            label: bucket.label,
            value: matched.length,
            color:
                bucket.key === 'over_7d'
                    ? 'var(--sev-critical)'
                    : bucket.key === 'd3_7'
                      ? 'var(--sev-high)'
                      : 'var(--accent)',
            drill: target(bucket.key, `Open ${bucket.label.toLowerCase()}`, matched),
        }
    })

    const kinds: Array<[WorkRow['kind'], string, string]> = [
        ['incident', 'Security incidents', 'var(--accent)'],
        ['task', 'Response tasks', 'var(--sev-medium)'],
        ['finding', 'Vulnerability findings', 'var(--sev-low)'],
    ]
    const byKind: Slice[] = kinds.map(([kind, label, color]) => {
        const matched = rows.filter((row) => row.kind === kind)
        return { label, value: matched.length, color, drill: target(kind, label, matched) }
    })

    const critical = rows.filter((row) => row.severity === 'critical')
    const stale = rows.filter((row) => (row.dwell_hours ?? 0) >= 24)
    const unassigned = rows.filter((row) => !row.assigned_to && row.kind !== 'finding')

    const dwells = rows
        .map((row) => row.dwell_hours)
        .filter((hours): hours is number => hours !== null)
        .sort((a, b) => a - b)
    const medianDwell = dwells.length ? dwells[Math.floor(dwells.length / 2)] : null

    const oldest = rows.reduce<WorkRow | null>(
        (worst, row) => ((row.dwell_hours ?? 0) > (worst?.dwell_hours ?? -1) ? row : worst),
        null
    )

    return [
        {
            id: 'my-severity',
            title: 'Where the risk sits',
            hint: scopeWord,
            defaultWidth: 'third',
            render: () => <Donut slices={bySeverity} centerLabel="in view" centerValue={rows.length} onDrill={onDrill} />,
        },
        {
            id: 'my-age',
            title: 'How long it has been waiting',
            hint: 'dwell since opened',
            defaultWidth: 'third',
            render: () => (
                <>
                    <BarChart slices={byAge} onDrill={onDrill} />
                    {oldest ? (
                        <p className="footnote">
                            Oldest: <span className="mono">{oldest.number}</span> — {oldest.title} (
                            {formatDwell(oldest.dwell_hours)})
                        </p>
                    ) : null}
                </>
            ),
        },
        {
            id: 'my-glance',
            title: 'At a glance',
            defaultWidth: 'third',
            render: () => (
                <div className="metrics">
                    <Metric
                        value={critical.length}
                        label="critical"
                        tone="var(--sev-critical)"
                        onPress={critical.length ? () => onDrill(target('critical', 'Critical in view', critical)) : undefined}
                    />
                    <Metric
                        value={stale.length}
                        label="over 24h"
                        caption="needs a nudge"
                        onPress={stale.length ? () => onDrill(target('stale', 'Waiting over 24h', stale)) : undefined}
                    />
                    <Metric
                        value={unassigned.length}
                        label="unassigned"
                        onPress={
                            unassigned.length ? () => onDrill(target('unassigned', 'Unassigned', unassigned)) : undefined
                        }
                    />
                    <Metric value={formatDwell(medianDwell)} label="median dwell" />
                </div>
            ),
        },
        {
            id: 'my-kind',
            title: 'What kind of work',
            hint: 'incidents, tasks and findings',
            defaultWidth: 'full',
            render: () => <StackedBar slices={byKind} onDrill={onDrill} />,
        },
    ]
}
