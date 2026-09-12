'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

const sandbox = loadScriptIncludes(['secops-json.js', 'secops-log.js', 'secops-field-mapper.js'])
const mapper = new sandbox.SecOpsFieldMapper()

function rule(overrides) {
    return Object.assign(
        { source_path: 'value', target_table: 'target', target_field: 'field', transform: 'none', mandatory: false, order: 100 },
        overrides
    )
}

test('maps a value into the configured table and field', () => {
    const out = mapper.apply({ value: 'abc' }, [rule({})], 'fallback')
    assert.deepStrictEqual(out.byTable, { target: { field: 'abc' } })
    assert.strictEqual(out.applied, 1)
    assert.deepStrictEqual(out.errors, [])
})

test('falls back to the default table when the rule leaves target_table empty', () => {
    const out = mapper.apply({ value: 'abc' }, [rule({ target_table: '' })], 'fallback')
    assert.deepStrictEqual(out.byTable, { fallback: { field: 'abc' } })
})

test('reports an error when a mandatory mapping resolves to nothing', () => {
    const out = mapper.apply({}, [rule({ source_path: 'missing', mandatory: true })], 'fallback')
    assert.strictEqual(out.applied, 0)
    assert.strictEqual(out.errors.length, 1)
    assert.ok(out.errors[0].indexOf('Mandatory') !== -1)
})

test('silently skips an optional mapping that resolves to nothing', () => {
    const out = mapper.apply({}, [rule({ source_path: 'missing' })], 'fallback')
    assert.deepStrictEqual(out.byTable, {})
    assert.deepStrictEqual(out.errors, [])
})

test('uses the default value when the source path is absent', () => {
    const out = mapper.apply({}, [rule({ source_path: 'missing', default_value: 'fallback-value' })], 'target')
    assert.deepStrictEqual(out.byTable, { target: { field: 'fallback-value' } })
})

test('applies each transform', () => {
    assert.strictEqual(mapper.transform('  x  ', 'trim'), 'x')
    assert.strictEqual(mapper.transform('AbC', 'lower'), 'abc')
    assert.strictEqual(mapper.transform('AbC', 'upper'), 'ABC')
    assert.strictEqual(mapper.transform('7.5', 'number'), 7.5)
    assert.strictEqual(mapper.transform('true', 'boolean'), true)
    assert.strictEqual(mapper.transform('no', 'boolean'), false)
    assert.strictEqual(mapper.transform({ a: 1 }, 'json'), '{"a":1}')
})

test('number transform yields null for non-numeric input rather than NaN', () => {
    assert.strictEqual(mapper.transform('abc', 'number'), null)
})

test('boolean transform yields null for values that are neither true nor false', () => {
    assert.strictEqual(mapper.transform('maybe', 'boolean'), null)
})

test('iso_date transform converts to the ServiceNow date/time format', () => {
    assert.strictEqual(mapper.transform('2026-01-15T10:30:00Z', 'iso_date'), '2026-01-15 10:30:00')
    assert.strictEqual(mapper.transform('2026-01-15 10:30:00', 'iso_date'), '2026-01-15 10:30:00')
    assert.strictEqual(mapper.transform('2026-01-15', 'iso_date'), '2026-01-15 00:00:00')
    assert.strictEqual(mapper.transform('not a date', 'iso_date'), null)
})

test('the none transform serializes objects instead of producing [object Object]', () => {
    assert.strictEqual(mapper.transform({ a: 1 }, 'none'), '{"a":1}')
    assert.strictEqual(mapper.transform('plain', 'none'), 'plain')
})

test('collects values for several tables from one payload', () => {
    const out = mapper.apply({ a: '1', b: '2' }, [
        rule({ source_path: 'a', target_table: 't1', target_field: 'f1' }),
        rule({ source_path: 'b', target_table: 't2', target_field: 'f2' }),
    ])
    assert.deepStrictEqual(out.byTable, { t1: { f1: '1' }, t2: { f2: '2' } })
    assert.strictEqual(out.applied, 2)
})

test('reports a rule with no resolvable target instead of writing to undefined', () => {
    const out = mapper.apply({ value: 'x' }, [rule({ target_table: '' })], null)
    assert.strictEqual(out.applied, 0)
    assert.strictEqual(out.errors.length, 1)
})

test('returns an empty result when there are no rules', () => {
    const out = mapper.apply({ value: 'x' }, [], 'target')
    assert.deepStrictEqual(out.byTable, {})
    assert.strictEqual(out.applied, 0)
})
