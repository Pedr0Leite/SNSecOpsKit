import { useEffect, useState } from 'react'
import { Button, Checkbox, CheckboxGroup, Label, Popover, Dialog, DialogTrigger } from 'react-aria-components'
import { fetchDrill, listUrl, loadColumnPrefs, saveColumnPrefs, type DrillDatum, type DrillResult } from '../lib/drill'
import { recordUrl } from '../lib/api'

export function DrillPane({ datum, onClose }: { datum: DrillDatum; onClose: () => void }) {
    const [result, setResult] = useState<DrillResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [columns, setColumns] = useState<string[]>([])

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setError(null)
        setResult(null)

        fetchDrill(datum, controller.signal)
            .then((loaded) => {
                setResult(loaded)
                setColumns(loadColumnPrefs(loaded.table, loaded.defaultColumns))
            })
            .catch((cause: Error) => {
                if (cause.name !== 'AbortError') setError(cause.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })

        return () => controller.abort()
    }, [datum])

    function updateColumns(next: string[]) {
        // CheckboxGroup reports check order, not field order — re-sort to the table's fixed
        // priority so toggling a box never reshuffles the columns already on screen.
        const ordered = result ? result.columns.filter((field) => next.includes(field)) : next
        // At least one column — an empty row grid is a broken pane, not a valid preference.
        const safe = ordered.length > 0 ? ordered : columns
        setColumns(safe)
        if (result) saveColumnPrefs(result.table, safe)
    }

    return (
        <aside className="pane" aria-label={`Records behind ${datum.label}`}>
            <header className="pane__head">
                <div className="pane__ident">
                    <strong>{datum.label}</strong>
                    <span className="footnote">{datum.count} total</span>
                </div>
                <div className="pane__actions">
                    {result && result.columns.length > 1 ? (
                        <DialogTrigger>
                            <Button className="react-aria-Button">Columns</Button>
                            <Popover placement="bottom end">
                                <Dialog className="column-picker">
                                    <CheckboxGroup value={columns} onChange={updateColumns}>
                                        <Label>Show columns</Label>
                                        {result.columns.map((field) => (
                                            <Checkbox key={field} value={field}>
                                                {result.labels[field] || field}
                                            </Checkbox>
                                        ))}
                                    </CheckboxGroup>
                                </Dialog>
                            </Popover>
                        </DialogTrigger>
                    ) : null}
                    {datum.query ? (
                        <Button
                            className="react-aria-Button"
                            onPress={() => window.open(listUrl(datum.table, datum.query as string), '_blank', 'noopener')}
                        >
                            Open in list view
                        </Button>
                    ) : null}
                    <Button className="react-aria-Button pane__close" onPress={onClose} aria-label="Close">
                        ✕
                    </Button>
                </div>
            </header>

            <div className="pane__body">
                {error ? (
                    <div className="state state--error" role="alert">
                        {error}
                    </div>
                ) : loading ? (
                    <>
                        <div className="skeleton" />
                        <div className="skeleton" />
                        <div className="skeleton" />
                    </>
                ) : result ? (
                    <>
                        <AccessNote result={result} />
                        {result.rows.length === 0 ? (
                            <p className="chart-empty">No records you can see match this.</p>
                        ) : (
                            <ul className="drill">
                                {result.rows.map((row) => (
                                    <li key={row.sys_id}>
                                        <button
                                            type="button"
                                            className="drill__row"
                                            style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
                                            onClick={() =>
                                                window.open(recordUrl(result.table, row.sys_id), '_blank', 'noopener')
                                            }
                                        >
                                            {columns.map((field, index) => (
                                                <span
                                                    key={field}
                                                    className={index === 0 ? 'drill__primary mono' : 'drill__secondary'}
                                                    title={row.values[field] || ''}
                                                >
                                                    {row.values[field] || (index === 0 ? '—' : '')}
                                                </span>
                                            ))}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                ) : null}
            </div>
        </aside>
    )
}

/**
 * States the gap between the true total and what this user can see.
 *
 * Without this line the page looks like it contradicts itself: the chart says 12, the list shows 3.
 * With it, both numbers are true and the difference is explained.
 */
function AccessNote({ result }: { result: DrillResult }) {
    const hidden = result.total - result.visible

    if (hidden > 0) {
        return (
            <p className="notice">
                Showing {result.visible} of {result.total}. You do not have access to the other {hidden}.
            </p>
        )
    }

    if (result.visible > result.rows.length) {
        return (
            <p className="footnote">
                Showing the first {result.rows.length} of {result.visible}. Open the list view for all of them.
            </p>
        )
    }

    return null
}
