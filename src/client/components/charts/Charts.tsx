import { arcPath, drillable, maxValue, percent, ring, stack, trendPaths, type DrillTarget, type Slice } from './geometry'

/**
 * Hand-rolled SVG charts.
 *
 * Colours are CSS custom properties applied through `fill`/`stroke`, so a theme switch is a pure
 * CSS change with no re-render and no JS-computed palette. That is the main reason these are not a
 * charting library.
 *
 * Every chart is `role="img"` with a text alternative that states the actual numbers - a chart a
 * screen reader cannot read is decoration, not information.
 */

export function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="panel">
            <div className="panel__head">
                <h2 className="panel__title">{title}</h2>
                {hint ? <span className="footnote">{hint}</span> : null}
            </div>
            {children}
        </section>
    )
}

export function NoData({ message = 'Nothing to show yet.' }: { message?: string }) {
    return <p className="chart-empty">{message}</p>
}

export type DrillHandler = (drill: DrillTarget) => void

/** Horizontal bars. The workhorse: readable at any count, no axis needed. */
export function BarChart({ slices, unit = '', onDrill }: { slices: Slice[]; unit?: string; onDrill?: DrillHandler }) {
    if (slices.length === 0 || slices.every((slice) => slice.value === 0)) {
        return <NoData />
    }

    const max = maxValue(slices.map((slice) => slice.value))
    const summary = slices.map((slice) => `${slice.label}: ${slice.value}${unit}`).join(', ')

    return (
        <div className="bars" role="group" aria-label={summary}>
            {slices.map((slice) => {
                const canDrill = Boolean(onDrill) && drillable(slice.drill) && slice.value > 0
                const body = (
                    <>
                        <span className="bar__label" title={slice.label}>
                            {slice.label}
                        </span>
                        <span className="bar__track">
                            <span
                                className="bar__fill"
                                style={{ width: `${percent(slice.value, max)}%`, background: slice.color }}
                            />
                        </span>
                        <span className="bar__value">
                            {slice.value}
                            {unit}
                        </span>
                    </>
                )

                return canDrill ? (
                    <button
                        type="button"
                        className="bar bar--drill"
                        key={slice.label}
                        onClick={() => onDrill!(slice.drill!)}
                        aria-label={`${slice.label}: ${slice.value}${unit}. Show these records.`}
                    >
                        {body}
                    </button>
                ) : (
                    <div className="bar" key={slice.label}>
                        {body}
                    </div>
                )
            })}
        </div>
    )
}

/** One bar, many segments. Good for a mix that should read as a single whole. */
export function StackedBar({ slices, onDrill }: { slices: Slice[]; onDrill?: DrillHandler }) {
    const segments = stack(slices)
    if (segments.length === 0) return <NoData />

    const summary = segments.map((segment) => `${segment.label}: ${segment.value}`).join(', ')

    return (
        <div className="stacked">
            <div className="stacked__track" role="img" aria-label={summary}>
                {segments.map((segment) => (
                    <span
                        key={segment.label}
                        className="stacked__seg"
                        style={{ width: `${segment.width}%`, background: segment.color }}
                        title={`${segment.label}: ${segment.value}`}
                    />
                ))}
            </div>
            <Legend items={segments} onDrill={onDrill} />
        </div>
    )
}

/**
 * The legend doubles as the drill-in control.
 *
 * Segments in a stacked bar and arcs in a donut are often only a few pixels wide - too small to be
 * a reliable click target, and impossible to reach by keyboard. The legend entry is always a
 * comfortable size and lands in the tab order naturally.
 */
function Legend({
    items,
    onDrill,
}: {
    items: Array<{ label: string; value: number; color: string; drill?: DrillTarget }>
    onDrill?: DrillHandler
}) {
    return (
        <ul className="legend">
            {items.map((item) => {
                const canDrill = Boolean(onDrill) && drillable(item.drill) && item.value > 0
                const content = (
                    <>
                        <span className="legend__swatch" style={{ background: item.color }} />
                        {item.label}
                        <span className="legend__value">{item.value}</span>
                    </>
                )

                return (
                    <li key={item.label}>
                        {canDrill ? (
                            <button
                                type="button"
                                className="legend__button"
                                onClick={() => onDrill!(item.drill!)}
                                aria-label={`${item.label}: ${item.value}. Show these records.`}
                            >
                                {content}
                            </button>
                        ) : (
                            content
                        )}
                    </li>
                )
            })}
        </ul>
    )
}

export function Donut({
    slices,
    centerLabel,
    centerValue,
    onDrill,
}: {
    slices: Slice[]
    centerLabel: string
    centerValue: number
    onDrill?: DrillHandler
}) {
    const arcs = ring(slices)
    const summary = arcs.length ? arcs.map((arc) => `${arc.label}: ${arc.value}`).join(', ') : 'No data'

    return (
        <div className="donut">
            <svg viewBox="-60 -60 120 120" className="donut__svg" role="img" aria-label={`${centerLabel} ${centerValue}. ${summary}`}>
                <circle r="52" className="donut__rail" />
                {arcs.map((arc) => {
                    const canDrill = Boolean(onDrill) && drillable(arc.drill)
                    return (
                        <path
                            key={arc.label}
                            d={arcPath(arc.start, arc.end, 52, 16)}
                            fill={arc.color}
                            className={canDrill ? 'donut__arc donut__arc--drill' : 'donut__arc'}
                            onClick={canDrill ? () => onDrill!(arc.drill!) : undefined}
                        />
                    )
                })}
                <text className="donut__value" y="2">
                    {centerValue}
                </text>
                <text className="donut__caption" y="18">
                    {centerLabel}
                </text>
            </svg>
            <Legend items={arcs} onDrill={onDrill} />
        </div>
    )
}

/** Trend over time. Deliberately axis-free: the shape and the endpoints are the message. */
export function Trend({
    values,
    labels,
    color = 'var(--accent)',
}: {
    values: number[]
    labels: string[]
    color?: string
}) {
    if (values.length < 2) {
        return <NoData message="Not enough history yet — this fills in as data arrives." />
    }

    const width = 320
    const height = 72
    const { line, area } = trendPaths(values, width, height)
    const total = values.reduce((sum, value) => sum + value, 0)
    const summary = `${total} over ${values.length} days. ${labels[0]} to ${labels[labels.length - 1]}.`

    return (
        <div className="trend" role="img" aria-label={summary}>
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="trend__svg">
                <path d={area} fill={color} opacity="0.16" />
                <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="trend__axis">
                <span>{labels[0]}</span>
                <span>{labels[labels.length - 1]}</span>
            </div>
        </div>
    )
}

/** A single headline number with an optional qualifier underneath. Clickable when drillable. */
export function Metric({
    value,
    label,
    tone,
    caption,
    onPress,
}: {
    value: string | number
    label: string
    tone?: string
    caption?: string
    onPress?: () => void
}) {
    const body = (
        <>
            <span className="metric__value" style={tone ? { color: tone } : undefined}>
                {value}
            </span>
            <span className="metric__label">{label}</span>
            {caption ? <span className="footnote">{caption}</span> : null}
        </>
    )

    if (!onPress) {
        return <div className="metric">{body}</div>
    }

    return (
        <button type="button" className="metric metric--drill" onClick={onPress} aria-label={`${value} ${label}. Show these records.`}>
            {body}
        </button>
    )
}
