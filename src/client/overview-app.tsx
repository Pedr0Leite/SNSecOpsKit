import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from 'react-aria-components'
import { fetchOverview, type CountDatum, type Overview } from './lib/metrics'
import { useTheme } from './lib/useTheme'
import {
    clearLayout,
    loadLayout,
    OVERVIEW_LAYOUT,
    move,
    reconcile,
    reorder,
    saveLayout,
    setHidden,
    setWidth,
    type Layout,
    type PanelWidth,
} from './lib/layout'
import { ThemeSwitch } from './components/Controls'
import { BarChart, Donut, Metric, NoData, StackedBar, Trend } from './components/charts/Charts'
import type { Slice } from './components/charts/geometry'
import { PanelHost, type PanelDef } from './components/PanelHost'
import { DrillPane } from './components/DrillPane'
import type { DrillDatum } from './lib/drill'
import { injectStyles } from './lib/styles'

injectStyles()

const REFRESH_MS = 120_000

export default function OverviewApp() {
    const [theme, setTheme] = useTheme()
    const [data, setData] = useState<Overview | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState(0)

    const [layout, setLayout] = useState<Layout | null>(null)
    const [editing, setEditing] = useState(false)
    const [drill, setDrill] = useState<DrillDatum | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)

        fetchOverview(controller.signal)
            .then((response) => {
                setData(response.metrics)
                setUserId(response.user?.sys_id ?? null)
                setError(null)
            })
            .catch((cause: Error) => {
                if (cause.name !== 'AbortError') setError(cause.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })

        return () => controller.abort()
    }, [token])

    useEffect(() => {
        const timer = window.setInterval(() => setToken((value) => value + 1), REFRESH_MS)
        return () => window.clearInterval(timer)
    }, [])

    const panels = useMemo(() => (data ? buildPanels(data, setDrill) : []), [data])
    const defaults = useMemo<Layout>(
        () => panels.map((panel) => ({ id: panel.id, width: panel.defaultWidth, hidden: false })),
        [panels]
    )

    // Layout loads once the panels AND the user are known: the preference is scoped to a user
    // sys_id, and writing one without it would create a global preference that applies to everyone.
    useEffect(() => {
        if (defaults.length === 0 || layout || !userId) return
        let cancelled = false
        loadLayout(OVERVIEW_LAYOUT, userId).then((stored) => {
            if (!cancelled) setLayout(reconcile(defaults, stored))
        })
        return () => {
            cancelled = true
        }
    }, [defaults, layout, userId])

    const persist = useCallback(
        (next: Layout) => {
            setLayout(next)
            if (userId) void saveLayout(OVERVIEW_LAYOUT, userId, next)
        },
        [userId]
    )

    const reset = useCallback(() => {
        setLayout(defaults)
        if (userId) void clearLayout(OVERVIEW_LAYOUT, userId)
    }, [defaults, userId])

    const refresh = useCallback(() => setToken((value) => value + 1), [])

    return (
        <div className="app">
            <header className="topbar">
                <span className="topbar__name">Security overview</span>
                <span className="topbar__spacer" />

                {layout ? (
                    <>
                        <Button
                            className={editing ? 'react-aria-Button btn--primary' : 'react-aria-Button'}
                            onPress={() => setEditing((value) => !value)}
                        >
                            {editing ? 'Done' : 'Edit layout'}
                        </Button>
                        {editing ? (
                            <Button className="react-aria-Button" onPress={reset}>
                                Reset
                            </Button>
                        ) : null}
                    </>
                ) : null}

                <ThemeSwitch theme={theme} onChange={setTheme} />
                <a className="react-aria-Button" href="/x_335329_secops_analyst_console.do">
                    Open console
                </a>
            </header>

            <main className="main main--wide">
                {error ? (
                    <div className="state state--error" role="alert">
                        <div className="state__title">Could not load the overview</div>
                        <p>{error}</p>
                        <Button className="react-aria-Button" onPress={refresh}>
                            Try again
                        </Button>
                    </div>
                ) : loading && !data ? (
                    <div className="grid">
                        {[0, 1, 2, 3].map((index) => (
                            <div className="panel skeleton" key={index} />
                        ))}
                    </div>
                ) : data && layout ? (
                    <>
                        <HeadlineBand data={data} onDrill={setDrill} />

                        {editing ? (
                            <p className="notice">
                                Drag a panel to reorder it, or use the arrows. Set a width with ⅓ ½ ⅔ 1. Your layout is
                                saved to your user preferences.
                            </p>
                        ) : null}

                        <div className="split" data-open={String(Boolean(drill))}>
                            <PanelHost
                                panels={panels}
                                layout={layout}
                                editing={editing}
                                onMove={(id, direction) => persist(move(layout, id, direction))}
                                onDrop={(from, to) => persist(reorder(layout, from, to))}
                                onWidth={(id, width: PanelWidth) => persist(setWidth(layout, id, width))}
                                onHide={(id, hidden) => persist(setHidden(layout, id, hidden))}
                            />
                            {drill ? <DrillPane datum={drill} onClose={() => setDrill(null)} /> : null}
                        </div>

                        <p className="footnote">
                            Organisation-wide totals, refreshed every two minutes. Generated {data.generated}. Clicking a
                            value shows only the records you have access to.
                        </p>
                    </>
                ) : null}
            </main>
        </div>
    )
}

function HeadlineBand({ data, onDrill }: { data: Overview; onDrill: (datum: DrillDatum) => void }) {
    const { incidents, findings, integration } = data
    const critical = incidents.by_severity.find((datum) => datum.key === 'critical')
    const ageing = incidents.aging.find((datum) => datum.key === 'over_7d')
    const rate = integration.transactions.success_rate
    const impaired = integration.connector_totals.down + integration.connector_totals.degraded

    return (
        <section className="band">
            <Metric
                value={incidents.open}
                label="open incidents"
                onPress={incidents.available ? () => onDrill(asDrill('open', 'Open incidents', incidents.open, incidents.table, incidents.open_query)) : undefined}
            />
            <Metric
                value={critical?.count ?? 0}
                label="critical"
                tone={(critical?.count ?? 0) > 0 ? 'var(--sev-critical)' : undefined}
                onPress={critical ? () => onDrill(critical) : undefined}
            />
            <Metric
                value={ageing?.count ?? 0}
                label="open over 7 days"
                tone={(ageing?.count ?? 0) > 0 ? 'var(--sev-high)' : undefined}
                caption="ageing out"
                onPress={ageing ? () => onDrill(ageing) : undefined}
            />
            <Metric
                value={findings.total}
                label="vulnerability findings"
                onPress={
                    findings.total > 0
                        ? () => onDrill(asDrill('findings', 'Vulnerability findings', findings.total, findings.table, findings.total_query))
                        : undefined
                }
            />
            <Metric
                value={rate === null ? '—' : `${rate}%`}
                label="integration success"
                tone={rate === null ? undefined : rate >= 95 ? 'var(--sev-low)' : rate >= 80 ? 'var(--sev-medium)' : 'var(--sev-critical)'}
                caption={integration.transactions.total > 0 ? `${integration.transactions.total} calls logged` : 'no calls yet'}
            />
            <Metric
                value={impaired}
                label="connectors impaired"
                tone={
                    integration.connector_totals.down > 0
                        ? 'var(--sev-critical)'
                        : integration.connector_totals.degraded > 0
                          ? 'var(--sev-medium)'
                          : undefined
                }
            />
        </section>
    )
}

function asDrill(key: string, label: string, count: number, table: string, query: string | null): DrillDatum {
    return { key, label, count, table, query }
}

/** Chart colour by severity key, so findings and incidents read the same way. */
const SEVERITY_COLOR: Record<string, string> = {
    critical: 'var(--sev-critical)',
    high: 'var(--sev-high)',
    medium: 'var(--sev-medium)',
    low: 'var(--sev-low)',
    info: 'var(--sev-info)',
    informational: 'var(--sev-info)',
    unknown: 'var(--ink-3)',
}

function toSlices(rows: CountDatum[], color: string | ((row: CountDatum) => string)): Slice[] {
    return rows.map((row) => ({
        label: row.label,
        value: row.count,
        color: typeof color === 'function' ? color(row) : color,
        drill: row,
    }))
}

function buildPanels(data: Overview, onDrill: (datum: DrillDatum) => void): PanelDef[] {
    const { incidents, findings, integration } = data
    const severityColor = (row: CountDatum) => SEVERITY_COLOR[row.key] || 'var(--accent)'
    const agingColor = (row: CountDatum) =>
        row.key === 'over_7d' ? 'var(--sev-critical)' : row.key === 'd3_7' ? 'var(--sev-high)' : 'var(--accent)'

    return [
        {
            id: 'incident-trend',
            title: 'Incidents opened',
            hint: `last ${incidents.trend.labels.length} days`,
            defaultWidth: 'two-thirds',
            render: () =>
                incidents.available ? (
                    <>
                        <Trend values={incidents.trend.opened} labels={incidents.trend.labels} />
                        {incidents.trend.truncated ? (
                            <p className="footnote">Scan cap reached — the trend may understate recent volume.</p>
                        ) : null}
                    </>
                ) : (
                    <NoData message="Security Incident Response is not installed on this instance." />
                ),
        },
        {
            id: 'incident-severity',
            title: 'Open incidents by severity',
            hint: 'priority 1 counts as critical',
            defaultWidth: 'third',
            render: () => (
                <Donut
                    slices={toSlices(incidents.by_severity, severityColor)}
                    centerLabel="open"
                    centerValue={incidents.open}
                    onDrill={onDrill}
                />
            ),
        },
        {
            id: 'incident-aging',
            title: 'How long incidents have been open',
            defaultWidth: 'third',
            render: () => <BarChart slices={toSlices(incidents.aging, agingColor)} onDrill={onDrill} />,
        },
        {
            id: 'incident-group',
            title: 'Where the load sits',
            hint: 'open incidents by assignment group',
            defaultWidth: 'third',
            render: () => <BarChart slices={toSlices(incidents.by_group, 'var(--accent)')} onDrill={onDrill} />,
        },
        {
            id: 'incident-state',
            title: 'Incidents by state',
            defaultWidth: 'third',
            render: () => <BarChart slices={toSlices(incidents.by_state, 'var(--sev-info)')} onDrill={onDrill} />,
        },
        {
            id: 'finding-severity',
            title: 'Vulnerability findings by severity',
            defaultWidth: 'half',
            render: () => <StackedBar slices={toSlices(findings.by_severity, severityColor)} onDrill={onDrill} />,
        },
        {
            id: 'finding-source',
            title: 'Findings by source',
            hint: 'which feed is producing the volume',
            defaultWidth: 'half',
            render: () => <BarChart slices={toSlices(findings.by_source, 'var(--sev-medium)')} onDrill={onDrill} />,
        },
        {
            id: 'finding-ci',
            title: 'Most affected assets',
            defaultWidth: 'half',
            render: () => (
                <>
                    <BarChart slices={toSlices(findings.top_ci, 'var(--sev-high)')} onDrill={onDrill} />
                    {findings.unmatched_ci > 0 ? (
                        <p className="footnote">
                            <button
                                type="button"
                                className="linkish"
                                onClick={() =>
                                    onDrill(
                                        asDrill(
                                            'unmatched_ci',
                                            'Findings with no matched CI',
                                            findings.unmatched_ci,
                                            findings.table,
                                            findings.unmatched_ci_query
                                        )
                                    )
                                }
                            >
                                {findings.unmatched_ci} findings have no matched CI
                            </button>{' '}
                            — they are counted here but attached to no asset.
                        </p>
                    ) : null}
                </>
            ),
        },
        {
            id: 'integration-trend',
            title: 'Integration throughput',
            hint: `last ${integration.trend.labels.length} days`,
            defaultWidth: 'half',
            render: () => (
                <>
                    <Trend values={integration.trend.ok} labels={integration.trend.labels} color="var(--sev-low)" />
                    {integration.trend.failed.some((value) => value > 0) ? (
                        <Trend
                            values={integration.trend.failed}
                            labels={integration.trend.labels}
                            color="var(--sev-critical)"
                        />
                    ) : (
                        <p className="footnote">No failed calls in this window.</p>
                    )}
                </>
            ),
        },
        {
            id: 'connector-health',
            title: 'Connector health',
            defaultWidth: 'third',
            render: () => (
                <BarChart
                    slices={toSlices(integration.connectors, (row) =>
                        row.key === 'healthy'
                            ? 'var(--sev-low)'
                            : row.key === 'degraded'
                              ? 'var(--sev-medium)'
                              : row.key === 'down'
                                ? 'var(--sev-critical)'
                                : 'var(--ink-3)'
                    )}
                    onDrill={onDrill}
                />
            ),
        },
        {
            id: 'integration-capability',
            title: 'What the connectors are doing',
            hint: 'calls by capability',
            defaultWidth: 'third',
            render: () => <BarChart slices={toSlices(integration.by_capability, 'var(--accent)')} onDrill={onDrill} />,
        },
        {
            id: 'integration-outcomes',
            title: 'Call outcomes',
            defaultWidth: 'third',
            render: () => (
                <>
                    <StackedBar
                        slices={toSlices(integration.outcomes, (row) =>
                            row.key === 'success'
                                ? 'var(--sev-low)'
                                : row.key === 'failed'
                                  ? 'var(--sev-critical)'
                                  : 'var(--sev-medium)'
                        )}
                        onDrill={onDrill}
                    />
                    {integration.transactions.avg_duration_ms !== null ? (
                        <p className="footnote">Average successful call: {integration.transactions.avg_duration_ms} ms</p>
                    ) : null}
                </>
            ),
        },
    ]
}
