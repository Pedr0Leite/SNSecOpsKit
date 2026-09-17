import test from 'node:test'
import assert from 'node:assert'
import {
    AGING_BUCKETS,
    arcPath,
    bucketByAge,
    bucketOf,
    drillable,
    maxValue,
    percent,
    ring,
    stack,
    trendPaths,
    type Slice,
} from '../src/client/components/charts/geometry.ts'

/**
 * Chart geometry fails silently: a NaN in an SVG path renders nothing at all, and a wrong bucket
 * boundary just shows the wrong number confidently. Both are worth testing.
 */

function slice(label: string, value: number): Slice {
    return { label, value, color: 'var(--accent)' }
}

// ------------------------------------------------------------------- scales

test('maxValue never returns zero, so a zero series still scales', () => {
    assert.strictEqual(maxValue([3, 9, 4]), 9)
    assert.strictEqual(maxValue([0, 0]), 1)
    assert.strictEqual(maxValue([]), 1)
    assert.strictEqual(maxValue([Number.NaN, 2]), 2)
})

test('percent clamps and never emits NaN', () => {
    assert.strictEqual(percent(5, 10), 50)
    assert.strictEqual(percent(20, 10), 100, 'a rogue value cannot overflow its bar')
    assert.strictEqual(percent(-3, 10), 0)
    assert.strictEqual(percent(Number.NaN, 10), 0)
    assert.strictEqual(percent(5, 0), 100)
})

// ------------------------------------------------------------------- stacks

test('stack produces widths that sum to 100 and skips empty slices', () => {
    const segments = stack([slice('a', 1), slice('b', 3), slice('c', 0)])
    assert.deepStrictEqual(segments.map((s) => s.label), ['a', 'b'])
    assert.strictEqual(Math.round(segments[0].width), 25)
    assert.strictEqual(Math.round(segments[1].width), 75)
    assert.strictEqual(Math.round(segments[1].offset), 25)
    assert.strictEqual(Math.round(segments.reduce((sum, s) => sum + s.width, 0)), 100)
})

test('stack returns nothing for an all-zero series rather than dividing by zero', () => {
    assert.deepStrictEqual(stack([slice('a', 0), slice('b', 0)]), [])
    assert.deepStrictEqual(stack([]), [])
})

// -------------------------------------------------------------------- rings

test('ring fractions run 0 to 1 in order', () => {
    const arcs = ring([slice('a', 1), slice('b', 1), slice('c', 2)])
    assert.strictEqual(arcs[0].start, 0)
    assert.strictEqual(arcs[arcs.length - 1].end, 1)
    assert.strictEqual(arcs[1].start, arcs[0].end, 'slices must be contiguous')
    assert.strictEqual(arcs[2].end - arcs[2].start, 0.5)
})

test('arcPath emits valid numbers, never NaN', () => {
    const path = arcPath(0, 0.25, 52, 16)
    assert.ok(path.length > 0)
    assert.ok(!path.includes('NaN'), 'a NaN in a path renders nothing and is invisible to debug')
})

test('a single full-circle slice is drawn as two arcs, not a degenerate one', () => {
    // Start and end coincide at 360 degrees, so one arc command draws nothing at all.
    const full = arcPath(0, 1, 52, 16)
    const commands = full.match(/A /g) || []
    assert.ok(commands.length >= 4, 'expected two arc segments (2 outer + 2 inner sweeps)')
    assert.ok(!full.includes('NaN'))
})

test('a zero-width arc produces no path', () => {
    assert.strictEqual(arcPath(0.5, 0.5, 52, 16), '')
    assert.strictEqual(arcPath(0.5, 0.2, 52, 16), '')
})

// ------------------------------------------------------------------ trends

test('trendPaths needs at least two points', () => {
    assert.deepStrictEqual(trendPaths([], 100, 50), { line: '', area: '' })
    assert.deepStrictEqual(trendPaths([5], 100, 50), { line: '', area: '' })
})

test('trendPaths spans the full width and closes the area', () => {
    const { line, area } = trendPaths([0, 10, 5], 100, 50)
    assert.ok(line.startsWith('M 0 '))
    assert.ok(line.includes('L 100 '), 'the last point sits on the right edge')
    assert.ok(area.endsWith('Z'), 'the area must be a closed shape')
    assert.ok(!line.includes('NaN') && !area.includes('NaN'))
})

test('a flat series still produces a drawable line', () => {
    const { line } = trendPaths([4, 4, 4], 100, 50)
    assert.ok(line.length > 0)
    assert.ok(!line.includes('NaN'))
})

// ------------------------------------------------------------------ buckets

test('aging buckets split on the documented boundaries', () => {
    const counts = bucketByAge([0, 23, 24, 71, 72, 167, 168, 500])
    assert.strictEqual(counts.under_24h, 2, '0 and 23 hours')
    assert.strictEqual(counts.d1_3, 2, '24 and 71 hours')
    assert.strictEqual(counts.d3_7, 2, '72 and 167 hours')
    assert.strictEqual(counts.over_7d, 2, '168 and 500 hours')
})

test('aging buckets ignore unmeasurable ages instead of miscounting them', () => {
    const counts = bucketByAge([null, Number.NaN, 5])
    assert.strictEqual(counts.under_24h, 1)
    assert.strictEqual(counts.d1_3 + counts.d3_7 + counts.over_7d, 0)
})

test('every bucket key is covered by a definition', () => {
    const counts = bucketByAge([])
    assert.deepStrictEqual(Object.keys(counts).sort(), AGING_BUCKETS.map((b) => b.key).sort())
})

test('a value is drillable when it names either a query or some ids', () => {
    const base = { key: 'k', label: 'K', count: 1, table: 'x' }
    assert.strictEqual(drillable(undefined), false)
    assert.strictEqual(drillable({ ...base, query: null }), false, 'null means the value is not safely queryable')
    assert.strictEqual(drillable({ ...base, query: '' }), true, 'an empty query means the whole table, which is a real list')
    assert.strictEqual(drillable({ ...base, query: null, ids: [] }), false, 'an empty id set is not a drill')
    assert.strictEqual(drillable({ ...base, query: 'active=true' }), true)
    assert.strictEqual(drillable({ ...base, query: null, ids: ['abc'] }), true)
})

test('bucketOf agrees with the counts bucketByAge produces', () => {
    const hours = [0.5, 30, 100, 400, null]
    const counts = bucketByAge(hours)
    AGING_BUCKETS.forEach((bucket) => {
        const mine = hours.filter((value) => bucketOf(value) === bucket.key).length
        assert.strictEqual(mine, counts[bucket.key], `${bucket.key} disagrees`)
    })
})
