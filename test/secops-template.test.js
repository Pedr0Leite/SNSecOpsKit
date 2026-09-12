'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

const sandbox = loadScriptIncludes(['secops-json.js', 'secops-template.js'])
const template = new sandbox.SecOpsTemplate()

test('render substitutes simple and nested placeholders', () => {
    const out = template.render('{"ioc":"${observable.value}","type":"${observable.type}"}', {
        observable: { value: '1.2.3.4', type: 'IP Address' },
    })
    assert.strictEqual(out, '{"ioc":"1.2.3.4","type":"IP Address"}')
})

test('render replaces unresolved placeholders with empty string', () => {
    const out = template.render('value=${missing.path}', {})
    assert.strictEqual(out, 'value=')
})

test('render tolerates whitespace inside the placeholder', () => {
    const out = template.render('${ observable.value }', { observable: { value: 'x' } })
    assert.strictEqual(out, 'x')
})

test('render serializes object values rather than emitting [object Object]', () => {
    const out = template.render('${payload}', { payload: { a: 1 } })
    assert.strictEqual(out, '{"a":1}')
})

test('render does not execute anything in the template', () => {
    // The template language is pure substitution; script-looking input stays literal.
    const out = template.render('${a}', { a: '${b}' })
    assert.strictEqual(out, '${b}', 'substituted values must not be re-scanned for placeholders')
})

test('render handles empty and null templates', () => {
    assert.strictEqual(template.render('', {}), '')
    assert.strictEqual(template.render(null, {}), '')
    assert.strictEqual(template.render(undefined, {}), '')
})

test('renderJson returns a parsed object and null for invalid output', () => {
    const ok = template.renderJson('{"v":"${x}"}', { x: 'abc' })
    assert.deepStrictEqual(ok, { v: 'abc' })

    const bad = template.renderJson('{"v": ${x}}', { x: undefined })
    assert.strictEqual(bad, null, 'an unresolvable placeholder that breaks JSON must yield null')
})

test('placeholders lists each dependency once', () => {
    const found = template.placeholders('${a.b} ${c} ${a.b}')
    assert.deepStrictEqual(found, ['a.b', 'c'])
    assert.deepStrictEqual(template.placeholders(''), [])
    assert.deepStrictEqual(template.placeholders(null), [])
})
