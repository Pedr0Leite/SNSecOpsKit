import { Button } from 'react-aria-components'
import type { Connector, WorkSummary } from '../lib/types'

export function SummaryStrip({ summary, truncated }: { summary: WorkSummary; truncated: boolean }) {
    return (
        <div className="summary">
            <Stat count={summary.critical} label="critical" sev="critical" />
            <Stat count={summary.high} label="high" sev="high" />
            <Stat count={summary.medium} label="medium" sev="medium" />
            <span className="summary__divider" />
            <Stat count={summary.mine} label="assigned to me" />
            <Stat count={summary.unassigned} label="unassigned" />
            <span className="summary__divider" />
            <Stat count={summary.total} label="in view" />
            {truncated ? <span className="footnote">Showing the most severe. Narrow the filters to see the rest.</span> : null}
        </div>
    )
}

function Stat({ count, label, sev }: { count: number; label: string; sev?: string }) {
    return (
        <span className="summary__stat">
            <span className="summary__count" data-sev={sev}>
                {count}
            </span>
            <span className="summary__label">{label}</span>
        </span>
    )
}

export function ConnectorStrip({ connectors }: { connectors: Connector[] }) {
    if (connectors.length === 0) {
        return <p className="footnote">No connectors configured yet.</p>
    }

    return (
        <div className="connectors">
            {connectors.map((connector) => (
                <span
                    key={connector.sys_id}
                    className="connector"
                    data-inactive={String(!connector.active)}
                    title={connector.last_health_message || undefined}
                >
                    <span className="connector__dot" data-health={connector.active ? connector.health_status : 'unknown'} />
                    {connector.name}
                    {!connector.active ? <span className="footnote">inactive</span> : null}
                </span>
            ))}
        </div>
    )
}

export function LoadingRows() {
    return (
        <div className="worklist" aria-busy="true" aria-label="Loading work queue">
            {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index} className="skeleton" />
            ))}
        </div>
    )
}

/** Empty states point at the next action; they are not decoration. */
export function EmptyState({ scope, onWiden }: { scope: string; onWiden: () => void }) {
    const message =
        scope === 'me'
            ? 'Nothing is assigned to you right now.'
            : scope === 'team'
              ? 'Your team has no open work matching these filters.'
              : 'No work matches these filters.'

    return (
        <div className="state">
            <div className="state__title">{message}</div>
            <p>Widen the filters to see more, or check back when new work arrives.</p>
            {scope !== 'all' ? (
                <Button className="react-aria-Button btn--primary" onPress={onWiden}>
                    Show everything
                </Button>
            ) : null}
        </div>
    )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="state state--error" role="alert">
            <div className="state__title">Could not load the queue</div>
            <p>{message}</p>
            <Button className="react-aria-Button" onPress={onRetry}>
                Try again
            </Button>
        </div>
    )
}
