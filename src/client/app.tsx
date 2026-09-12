import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchConnectors, fetchWork } from './lib/api'
import type { Connector, Scope, Severity, SourceKey, WorkResponse, WorkRow } from './lib/types'
import { SEVERITIES } from './lib/types'
import { useTheme } from './lib/useTheme'
import { ScopePicker, SearchBox, SeverityPicker, SourcePicker, ThemeSwitch } from './components/Controls'
import { WorkList } from './components/WorkList'
import { RecordPane } from './components/RecordPane'
import { buildMyMetricsPanels } from './components/MyMetrics'
import { PanelHost } from './components/PanelHost'
import { NoData } from './components/charts/Charts'
import type { DrillTarget } from './components/charts/geometry'
import {
    clearLayout,
    CONSOLE_LAYOUT,
    loadLayout,
    move,
    reconcile,
    reorder,
    saveLayout,
    setHidden,
    setWidth,
    type Layout,
    type PanelWidth,
} from './lib/layout'
import { ConnectorStrip, EmptyState, ErrorState, LoadingRows, SummaryStrip } from './components/Panels'
import { Button } from 'react-aria-components'
import { injectStyles } from './lib/styles'

injectStyles()

type Tab = 'queue' | 'metrics'

/** Connector health is polled; the work queue is not, so a refresh never surprises a reader. */
const CONNECTOR_POLL_MS = 60_000

export default function App() {
    const [theme, setTheme] = useTheme()

    const [scope, setScope] = useState<Scope>('me')
    const [sources, setSources] = useState<SourceKey[]>(['sir', 'findings'])
    const [severities, setSeverities] = useState<Severity[]>([])
    const [search, setSearch] = useState('')

    const [work, setWork] = useState<WorkResponse | null>(null)
    const [connectors, setConnectors] = useState<Connector[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reloadToken, setReloadToken] = useState(0)
    const [selected, setSelected] = useState<WorkRow | null>(null)
    const [tab, setTab] = useState<Tab>('queue')

    // Drill-in from a chart. Holding sys_ids rather than a re-derived predicate means the list can
    // never disagree with the number that was clicked.
    const [pinned, setPinned] = useState<{ label: string; ids: string[] } | null>(null)
    const [layout, setLayout] = useState<Layout | null>(null)
    const [editing, setEditing] = useState(false)

    const debounced = useDebounced(search, 250)
    const query = useMemo(
        () => ({ scope, sources, severities, search: debounced }),
        [scope, sources, severities, debounced]
    )

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)

        fetchWork(query, controller.signal)
            .then((response) => {
                setWork(response)
                setError(null)
            })
            .catch((cause: Error) => {
                if (cause.name !== 'AbortError') {
                    setError(cause.message)
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            })

        return () => controller.abort()
    }, [query, reloadToken])

    useEffect(() => {
        const controller = new AbortController()

        const load = () =>
            fetchConnectors(controller.signal)
                .then((response) => setConnectors(response.connectors))
                .catch(() => {
                    /* connector health is supporting information - never block the queue on it */
                })

        load()
        const timer = window.setInterval(load, CONNECTOR_POLL_MS)
        return () => {
            controller.abort()
            window.clearInterval(timer)
        }
    }, [])

    const severityCounts = useMemo(() => {
        if (!work) return null
        return SEVERITIES.reduce(
            (counts, severity) => ({ ...counts, [severity]: work.summary[severity] }),
            {} as Record<Severity, number>
        )
    }, [work])

    // Drilling in sends the reader to the queue, where records are already openable and editable.
    // A separate read-only pane would be a second, worse list sitting next to the real one.
    const drillIn = useCallback((drill: DrillTarget) => {
        setPinned({ label: drill.label, ids: drill.ids ?? [] })
        setSelected(null)
        setTab('queue')
    }, [])

    // Changing the filters invalidates a pinned set - those ids came from a different question.
    useEffect(() => setPinned(null), [query])

    const rows = useMemo(() => {
        const all = work?.rows ?? []
        if (!pinned) return all
        const ids = new Set(pinned.ids)
        return all.filter((row) => ids.has(row.sys_id))
    }, [work, pinned])

    const panels = useMemo(() => buildMyMetricsPanels(work?.rows ?? [], scope, drillIn), [work, scope, drillIn])
    const defaults = useMemo<Layout>(
        () => panels.map((panel) => ({ id: panel.id, width: panel.defaultWidth, hidden: false })),
        [panels]
    )

    const userId = work?.user?.sys_id ?? null

    // Loads once the user is known: a sys_user_preference written without an explicit user is
    // global, so one analyst's layout would silently become everyone's default.
    useEffect(() => {
        if (layout || !userId || defaults.length === 0) return
        let cancelled = false
        loadLayout(CONSOLE_LAYOUT, userId).then((stored) => {
            if (!cancelled) setLayout(reconcile(defaults, stored))
        })
        return () => {
            cancelled = true
        }
    }, [defaults, layout, userId])

    const persist = useCallback(
        (next: Layout) => {
            setLayout(next)
            if (userId) void saveLayout(CONSOLE_LAYOUT, userId, next)
        },
        [userId]
    )

    const resetLayout = useCallback(() => {
        setLayout(defaults)
        if (userId) void clearLayout(CONSOLE_LAYOUT, userId)
    }, [defaults, userId])

    const showEverything = useCallback(() => {
        setScope('all')
        setSeverities([])
        setSearch('')
    }, [])

    const retry = useCallback(() => setReloadToken((token) => token + 1), [])

    // A saved edit can change severity, state or assignment, so the queue behind the pane is
    // refreshed rather than left showing what the row used to say.
    const afterSave = useCallback(() => setReloadToken((token) => token + 1), [])

    // The selected row must follow the refreshed data, and disappear if it filtered out.
    useEffect(() => {
        if (!selected || !work) return
        const stillListed = work.rows.find((row) => row.sys_id === selected.sys_id)
        setSelected(stillListed ?? null)
        // Intentionally keyed on `work` only: re-running on `selected` would fight the user.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [work])

    return (
        <div className="app">
            <header className="topbar">
                <span className="topbar__name">SecOps console</span>

                <div className="tabs" role="tablist" aria-label="View">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'queue'}
                        className="tab"
                        onClick={() => setTab('queue')}
                    >
                        Queue
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'metrics'}
                        className="tab"
                        onClick={() => setTab('metrics')}
                    >
                        My metrics
                    </button>
                </div>

                <span className="topbar__spacer" />

                {tab === 'metrics' && layout ? (
                    <>
                        <Button
                            className={editing ? 'react-aria-Button btn--primary' : 'react-aria-Button'}
                            onPress={() => setEditing((value) => !value)}
                        >
                            {editing ? 'Done' : 'Edit layout'}
                        </Button>
                        {editing ? (
                            <Button className="react-aria-Button" onPress={resetLayout}>
                                Reset
                            </Button>
                        ) : null}
                    </>
                ) : null}

                <ThemeSwitch theme={theme} onChange={setTheme} />
                <a className="react-aria-Button" href="/x_335329_secops_security_overview.do">
                    Security overview
                </a>
                {work?.user?.name ? <span className="topbar__user">{work.user.name}</span> : null}
            </header>

            <div className="layout">
                <nav className="rail" aria-label="Filters">
                    <ScopePicker scope={scope} onChange={setScope} />
                    <SourcePicker sources={sources} onChange={setSources} />
                    <SeverityPicker severities={severities} counts={severityCounts} onChange={setSeverities} />
                    <SearchBox value={search} onChange={setSearch} />
                </nav>

                <main className="main">
                    {work ? <SummaryStrip summary={work.summary} truncated={work.truncated} /> : null}

                    <ConnectorStrip connectors={connectors} />

                    {error ? (
                        <ErrorState message={error} onRetry={retry} />
                    ) : loading && !work ? (
                        <LoadingRows />
                    ) : tab === 'metrics' ? (
                        (work?.rows.length ?? 0) === 0 ? (
                            <NoData message="No work in view. The charts fill in as soon as there is something to show." />
                        ) : layout ? (
                            <>
                                {editing ? (
                                    <p className="notice">
                                        Drag a panel to reorder it, or use the arrows. Set a width with 1/3, 1/2, 2/3 or
                                        Full. Your layout is saved to your user preferences.
                                    </p>
                                ) : null}
                                <PanelHost
                                    panels={panels}
                                    layout={layout}
                                    editing={editing}
                                    onMove={(id, direction) => persist(move(layout, id, direction))}
                                    onDrop={(from, to) => persist(reorder(layout, from, to))}
                                    onWidth={(id, width: PanelWidth) => persist(setWidth(layout, id, width))}
                                    onHide={(id, hidden) => persist(setHidden(layout, id, hidden))}
                                />
                                <p className="footnote">
                                    Charted from the {work?.rows.length ?? 0} records in view. Click a value to open
                                    those records in the queue.
                                </p>
                            </>
                        ) : (
                            <div className="grid">
                                {[0, 1, 2].map((index) => (
                                    <div className="panel skeleton" key={index} />
                                ))}
                            </div>
                        )
                    ) : work && work.rows.length > 0 ? (
                        <>
                            {pinned ? (
                                <p className="notice">
                                    Showing the {rows.length} {rows.length === 1 ? 'record' : 'records'} behind{' '}
                                    <strong>{pinned.label}</strong>.{' '}
                                    <button type="button" className="linkish" onClick={() => setPinned(null)}>
                                        Show the whole queue
                                    </button>
                                </p>
                            ) : null}

                            <div className="split" data-open={String(Boolean(selected))}>
                                <WorkList
                                    rows={rows}
                                    selectedId={selected?.sys_id ?? null}
                                    onSelect={setSelected}
                                    compact={Boolean(selected)}
                                />
                                {selected ? (
                                    <RecordPane
                                        key={selected.sys_id}
                                        row={selected}
                                        currentUserId={work.user.sys_id}
                                        onClose={() => setSelected(null)}
                                        onSaved={afterSave}
                                    />
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <EmptyState scope={scope} onWiden={showEverything} />
                    )}
                </main>
            </div>
        </div>
    )
}

/** Keeps typing from firing a request per keystroke. */
function useDebounced(value: string, delay: number): string {
    const [debounced, setDebounced] = useState(value)
    const timer = useRef<number | undefined>(undefined)

    useEffect(() => {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setDebounced(value), delay)
        return () => window.clearTimeout(timer.current)
    }, [value, delay])

    return debounced
}
