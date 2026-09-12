/**
 * Pure geometry for the SVG charts.
 *
 * Kept separate from the components so the maths is unit-testable without a DOM. Every function
 * here is total: bad input produces a sane shape rather than NaN in a path attribute, because a
 * NaN in an SVG `d` silently renders nothing and is miserable to debug.
 */

/**
 * What sits behind a charted value.
 *
 * Two kinds, because the two pages count differently. The overview aggregates server-side and can
 * only describe its numbers as a `table` + `query`. The console charts rows it already holds, so it
 * names the exact `ids` - which cannot drift from the chart, and needs no second query.
 */
export interface DrillTarget {
    key: string
    label: string
    count: number
    table: string
    query: string | null
    ids?: string[]
}

export interface Slice {
    label: string
    value: number
    color: string
    /** Present and resolvable means the chart datum is drillable. */
    drill?: DrillTarget
}

/** A drill target only works if it can actually name records. */
export function drillable(drill?: DrillTarget): boolean {
    if (!drill) return false
    return Boolean(drill.query) || Boolean(drill.ids && drill.ids.length > 0)
}

/** Largest value in a series, never below 1 so a zero series still produces usable scales. */
export function maxValue(values: number[]): number {
    const max = values.reduce((best, value) => (Number.isFinite(value) && value > best ? value : best), 0)
    return max > 0 ? max : 1
}

/** Value as a 0-100 percentage of `max`. Clamped, so a rogue value cannot overflow a bar. */
export function percent(value: number, max: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0
    const scale = max > 0 ? max : 1
    return Math.max(0, Math.min(100, (value / scale) * 100))
}

/** Cumulative widths for a stacked bar, as percentages that always sum to <= 100. */
export function stack(slices: Slice[]): Array<Slice & { offset: number; width: number }> {
    const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0)
    if (total <= 0) return []

    let offset = 0
    return slices
        .filter((slice) => slice.value > 0)
        .map((slice) => {
            const width = (slice.value / total) * 100
            const segment = { ...slice, offset, width }
            offset += width
            return segment
        })
}

/**
 * Donut arc path. Angles run clockwise from 12 o'clock.
 *
 * A full-circle arc is degenerate in SVG (start and end coincide, so nothing draws), so a single
 * slice covering the whole ring is emitted as two half arcs.
 */
export function arcPath(startFraction: number, endFraction: number, radius: number, thickness: number): string {
    const sweep = endFraction - startFraction
    if (sweep <= 0) return ''

    if (sweep >= 0.9999) {
        return [arcSegment(0, 0.5, radius, thickness), arcSegment(0.5, 1, radius, thickness)].join(' ')
    }
    return arcSegment(startFraction, endFraction, radius, thickness)
}

function arcSegment(startFraction: number, endFraction: number, radius: number, thickness: number): string {
    const inner = radius - thickness
    const start = pointOn(startFraction, radius)
    const end = pointOn(endFraction, radius)
    const innerStart = pointOn(endFraction, inner)
    const innerEnd = pointOn(startFraction, inner)
    const large = endFraction - startFraction > 0.5 ? 1 : 0

    return [
        `M ${start.x} ${start.y}`,
        `A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`,
        `L ${innerStart.x} ${innerStart.y}`,
        `A ${inner} ${inner} 0 ${large} 0 ${innerEnd.x} ${innerEnd.y}`,
        'Z',
    ].join(' ')
}

function pointOn(fraction: number, radius: number): { x: number; y: number } {
    const angle = fraction * Math.PI * 2 - Math.PI / 2
    return {
        x: round(Math.cos(angle) * radius),
        y: round(Math.sin(angle) * radius),
    }
}

/** Fractional start/end for each slice of a donut. */
export function ring(slices: Slice[]): Array<Slice & { start: number; end: number }> {
    const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0)
    if (total <= 0) return []

    let cursor = 0
    return slices
        .filter((slice) => slice.value > 0)
        .map((slice) => {
            const start = cursor
            const end = cursor + slice.value / total
            cursor = end
            return { ...slice, start, end }
        })
}

/**
 * Smoothed area + line path for a trend. Returns empty strings for fewer than two points, which
 * the component renders as an explicit "not enough data" rather than a misleading flat line.
 */
export function trendPaths(values: number[], width: number, height: number): { line: string; area: string } {
    if (values.length < 2) return { line: '', area: '' }

    const max = maxValue(values)
    const step = width / (values.length - 1)
    const points = values.map((value, index) => ({
        x: round(index * step),
        y: round(height - (Math.max(0, value) / max) * height),
    }))

    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    const area = `${line} L ${round(width)} ${height} L 0 ${height} Z`
    return { line, area }
}

/** Two decimals is plenty for path data and keeps the emitted markup small. */
function round(value: number): number {
    return Math.round(value * 100) / 100
}

/** Bucket boundaries for the aging chart, in hours. */
export const AGING_BUCKETS = [
    { key: 'under_24h', label: 'Under 24h', max: 24 },
    { key: 'd1_3', label: '1-3 days', max: 72 },
    { key: 'd3_7', label: '3-7 days', max: 168 },
    { key: 'over_7d', label: 'Over 7 days', max: Infinity },
] as const

export type AgingKey = (typeof AGING_BUCKETS)[number]['key']

/** Which bucket a dwell falls in, or null if there is no usable dwell. */
export function bucketOf(hours: number | null): AgingKey | null {
    if (hours === null || !Number.isFinite(hours)) return null
    const bucket = AGING_BUCKETS.find((candidate) => hours < candidate.max) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1]
    return bucket.key
}

export function bucketByAge(hours: Array<number | null>): Record<AgingKey, number> {
    const counts: Record<AgingKey, number> = { under_24h: 0, d1_3: 0, d3_7: 0, over_7d: 0 }

    hours.forEach((value) => {
        const key = bucketOf(value)
        if (key) counts[key]++
    })

    return counts
}
