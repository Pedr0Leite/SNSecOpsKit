import { useEffect, useState } from 'react'
import { Button } from 'react-aria-components'
import { fetchDrill, listUrl, type DrillDatum, type DrillResult } from '../lib/drill'
import { recordUrl } from '../lib/api'

export function DrillPane({ datum, onClose }: { datum: DrillDatum; onClose: () => void }) {
    const [result, setResult] = useState<DrillResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setError(null)
        setResult(null)

        fetchDrill(datum, controller.signal)
            .then(setResult)
            .catch((cause: Error) => {
                if (cause.name !== 'AbortError') setError(cause.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })

        return () => controller.abort()
    }, [datum])

    return (
        <aside className="pane" aria-label={`Records behind ${datum.label}`}>
            <header className="pane__head">
                <div className="pane__ident">
                    <strong>{datum.label}</strong>
                    <span className="footnote">{datum.count} total</span>
                </div>
                <div className="pane__actions">
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
                                            onClick={() =>
                                                window.open(recordUrl(result.table, row.sys_id), '_blank', 'noopener')
                                            }
                                        >
                                            <span className="drill__primary mono">{row.primary || '—'}</span>
                                            <span className="drill__secondary">{row.secondary || ''}</span>
                                            <span className="footnote">{row.tertiary || ''}</span>
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
