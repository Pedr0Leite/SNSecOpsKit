'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

const sandbox = loadScriptIncludes(['secops-json.js'])
const json = new sandbox.SecOpsJson()

test('parse returns null for malformed or empty input instead of throwing', () => {
    assert.strictEqual(json.parse('{not json'), null)
    assert.strictEqual(json.parse(''), null)
    assert.strictEqual(json.parse(null), null)
    assert.strictEqual(json.parse(undefined), null)
})

test('parse passes through already-parsed objects', () => {
    const obj = { a: 1 }
    assert.strictEqual(json.parse(obj), obj)
})

test('get reads dotted, indexed and bracketed paths', () => {
    const payload = {
        data: {
            results: [{ verdict: 'malicious', score: 9 }, { verdict: 'clean' }],
        },
    }
    assert.strictEqual(json.get(payload, 'data.results.0.verdict'), 'malicious')
    assert.strictEqual(json.get(payload, 'data.results[0].verdict'), 'malicious')
    assert.strictEqual(json.get(payload, 'data.results[1].verdict'), 'clean')
    assert.strictEqual(json.get(payload, 'data.results[0].score'), 9)
})

test('get returns the fallback for missing paths, not undefined', () => {
    const payload = { a: { b: 1 } }
    assert.strictEqual(json.get(payload, 'a.missing'), null)
    assert.strictEqual(json.get(payload, 'a.missing', 'default'), 'default')
    assert.strictEqual(json.get(payload, 'a.b.c.d'), null)
    assert.strictEqual(json.get(payload, 'x[5].y'), null)
    assert.strictEqual(json.get(null, 'a'), null)
    assert.strictEqual(json.get({ a: 1 }, ''), null)
})

test('get does not walk into inherited prototype properties', () => {
    // A third-party payload must never be able to reach toString/constructor.
    assert.strictEqual(json.get({}, 'constructor'), null)
    assert.strictEqual(json.get({}, 'toString'), null)
    assert.strictEqual(json.get({ a: {} }, 'a.__proto__'), null)
})

test('get handles out-of-range and non-numeric array indexes', () => {
    const payload = { list: [1, 2] }
    assert.strictEqual(json.get(payload, 'list.5'), null)
    assert.strictEqual(json.get(payload, 'list.abc'), null)
    assert.strictEqual(json.get(payload, 'list.-1'), null)
})

test('redact masks credential-shaped keys at any depth', () => {
    const payload = {
        user: 'analyst',
        password: 'hunter2',
        nested: { api_key: 'abc123', client_secret: 's3cret', keep: 'visible' },
        list: [{ token: 'xyz' }, { safe: 'ok' }],
    }
    const redacted = json.redact(payload)

    assert.strictEqual(redacted.user, 'analyst')
    assert.strictEqual(redacted.password, '***REDACTED***')
    assert.strictEqual(redacted.nested.api_key, '***REDACTED***')
    assert.strictEqual(redacted.nested.client_secret, '***REDACTED***')
    assert.strictEqual(redacted.nested.keep, 'visible')
    assert.strictEqual(redacted.list[0].token, '***REDACTED***')
    assert.strictEqual(redacted.list[1].safe, 'ok')
})

test('redact does not mutate the original payload', () => {
    const payload = { password: 'hunter2' }
    json.redact(payload)
    assert.strictEqual(payload.password, 'hunter2')
})

test('redact honours extra keys supplied by the redact property', () => {
    const redacted = json.redact({ employee_ssn: '123', other: 'x' }, 'employee_ssn')
    assert.strictEqual(redacted.employee_ssn, '***REDACTED***')
    assert.strictEqual(redacted.other, 'x')
})

test('redact matches keys case-insensitively and as substrings', () => {
    const redacted = json.redact({ Authorization: 'Bearer x', X_API_KEY: 'k', refreshToken: 'r' })
    assert.strictEqual(redacted.Authorization, '***REDACTED***')
    assert.strictEqual(redacted.X_API_KEY, '***REDACTED***')
    assert.strictEqual(redacted.refreshToken, '***REDACTED***')
})

test('truncate marks truncation and respects the limit', () => {
    const long = 'a'.repeat(500)
    const out = json.truncate(long, 100)
    assert.strictEqual(out.length, 100)
    assert.ok(out.endsWith('...[truncated]'))
    assert.strictEqual(json.truncate('short', 100), 'short')
    assert.strictEqual(json.truncate(null, 100), '')
})

test('forLog redacts, serializes and truncates together', () => {
    const out = json.forLog({ password: 'hunter2', note: 'x'.repeat(200) }, 120)
    assert.ok(out.indexOf('hunter2') === -1, 'secret must not survive into a log field')
    assert.ok(out.length <= 120)
})

test('stringify never throws on circular structures', () => {
    const circular = {}
    circular.self = circular
    assert.strictEqual(json.stringify(circular), '')
})
