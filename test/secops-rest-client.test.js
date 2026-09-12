'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

const FILES = [
    'secops-json.js',
    'secops-log.js',
    'secops-template.js',
    'secops-registry.js',
    'secops-transaction-logger.js',
    'secops-rest-client.js',
]

function connector(overrides) {
    return Object.assign(
        {
            sys_id: 'c1',
            name: 'TestTI',
            active: 'true',
            category: 'threat_intel',
            auth_type: 'none',
            base_url: 'https://api.example.com',
            http_timeout_ms: '5000',
            max_retries: '2',
        },
        overrides
    )
}

function endpoint(overrides) {
    return Object.assign(
        {
            sys_id: 'e1',
            name: 'Lookup',
            connector: 'c1',
            capability: 'enrich',
            active: 'true',
            http_method: 'post',
            path: '/v1/lookup',
            request_template: '{"ioc":"${ioc}"}',
            request_headers: '',
            response_root: '',
            success_codes: '200',
            order: '100',
        },
        overrides
    )
}

function makeClient(options) {
    const opts = options || {}
    const db = {
        x_335329_secops_connector: [connector(opts.connector)],
        x_335329_secops_endpoints: [endpoint(opts.endpoint)],
        x_335329_secops_field_map: [],
        x_335329_secops_transaction: [],
    }
    const sandbox = loadScriptIncludes(FILES, {
        db: db,
        properties: opts.properties || {},
        connections: opts.connections,
        restResponder: opts.restResponder,
    })
    const registry = new sandbox.SecOpsRegistry()
    return { client: new sandbox.SecOpsRestClient(), sandbox, registry }
}

function resolveEndpoint(registry) {
    return registry.findEndpointForCapability('enrich')
}

test('joinUrl combines base and path, and honours an absolute path', () => {
    const { client } = makeClient()
    assert.strictEqual(client.joinUrl('https://a.example.com', '/v1/x'), 'https://a.example.com/v1/x')
    assert.strictEqual(client.joinUrl('https://a.example.com/', '/v1/x'), 'https://a.example.com/v1/x')
    assert.strictEqual(client.joinUrl('https://a.example.com', 'v1/x'), 'https://a.example.com/v1/x')
    assert.strictEqual(client.joinUrl('https://a.example.com', 'https://other.example.com/y'), 'https://other.example.com/y')
    assert.strictEqual(client.joinUrl('', '/v1/x'), '/v1/x')
    assert.strictEqual(client.joinUrl('https://a.example.com', ''), 'https://a.example.com')
})

test('successCodes parses a list and falls back to sane defaults', () => {
    const { client } = makeClient()
    assert.deepStrictEqual(client.successCodes('200,201'), [200, 201])
    assert.deepStrictEqual(client.successCodes(' 200 , 204 '), [200, 204])
    assert.deepStrictEqual(client.successCodes(''), [200, 201, 202, 204])
    assert.deepStrictEqual(client.successCodes(null), [200, 201, 202, 204])
    assert.deepStrictEqual(client.successCodes('garbage'), [200, 201, 202, 204])
})

test('a successful call renders the template and reports ok', () => {
    const { client, sandbox, registry } = makeClient({
        restResponder: () => ({ status: 200, body: '{"verdict":"malicious"}' }),
    })

    const result = client.execute(resolveEndpoint(registry), { ioc: '8.8.8.8' })

    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.status, 200)
    assert.deepStrictEqual(result.parsed, { verdict: 'malicious' })
    assert.strictEqual(sandbox._restCalls.length, 1)
    assert.strictEqual(sandbox._restCalls[0].endpoint, 'https://api.example.com/v1/lookup')
    assert.strictEqual(sandbox._restCalls[0].method, 'POST')
    assert.strictEqual(sandbox._restCalls[0].body, '{"ioc":"8.8.8.8"}')
})

test('retries a transient 500 and succeeds on a later attempt', () => {
    const { client, sandbox, registry } = makeClient({
        restResponder: (state, callNumber) =>
            callNumber < 3 ? { status: 500, body: 'boom' } : { status: 200, body: '{"ok":true}' },
    })

    const result = client.execute(resolveEndpoint(registry), {})

    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.attempts, 3)
    assert.strictEqual(sandbox._restCalls.length, 3)
})

test('does not retry a 400 - a bad request will never succeed on repeat', () => {
    const { client, sandbox, registry } = makeClient({
        restResponder: () => ({ status: 400, body: '{"error":"bad"}' }),
    })

    const result = client.execute(resolveEndpoint(registry), {})

    assert.strictEqual(result.ok, false)
    assert.strictEqual(result.attempts, 1)
    assert.strictEqual(sandbox._restCalls.length, 1)
})

test('stops after max_retries and reports failure', () => {
    const { client, sandbox, registry } = makeClient({
        restResponder: () => ({ status: 500, body: 'boom' }),
    })

    const result = client.execute(resolveEndpoint(registry), {})

    assert.strictEqual(result.ok, false)
    assert.strictEqual(result.attempts, 3, 'max_retries 2 means 3 attempts total')
    assert.strictEqual(sandbox._restCalls.length, 3)
})

test('parks a 429 for deferred retry instead of hammering the third party', () => {
    const { client, registry, sandbox } = makeClient({
        restResponder: () => ({ status: 429, body: 'slow down' }),
    })

    const result = client.execute(resolveEndpoint(registry), {})

    assert.strictEqual(result.ok, false)
    assert.ok(result.next_retry, 'a back-pressure response must schedule a later retry')
    const txn = sandbox._db.x_335329_secops_transaction[0]
    assert.strictEqual(txn.state, 'retry_pending')
})

test('a transport exception is reported as status 0 and retried', () => {
    const { client, registry, sandbox } = makeClient({
        restResponder: (state, callNumber) => (callNumber === 1 ? { throws: 'connection reset' } : { status: 200, body: '{}' }),
    })

    const result = client.execute(resolveEndpoint(registry), {})

    assert.strictEqual(result.ok, true)
    assert.strictEqual(sandbox._restCalls.length, 2)
})

test('writes a transaction with redacted request and response bodies', () => {
    const { client, sandbox, registry } = makeClient({
        endpoint: { request_template: '{"api_key":"${secret}","ioc":"${ioc}"}' },
        restResponder: () => ({ status: 200, body: '{"access_token":"super-secret","verdict":"clean"}' }),
    })

    client.execute(resolveEndpoint(registry), { secret: 'hunter2', ioc: '1.1.1.1' })

    const txn = sandbox._db.x_335329_secops_transaction[0]
    assert.strictEqual(txn.state, 'success')
    assert.ok(txn.request_summary.indexOf('hunter2') === -1, 'a secret in the request body must not be logged')
    assert.ok(txn.response_summary.indexOf('super-secret') === -1, 'a token in the response must not be logged')
    assert.ok(txn.response_summary.indexOf('clean') !== -1, 'non-secret response data is still recorded')
})

test('refuses to call an inactive connector', () => {
    const { client, sandbox, registry } = makeClient({ connector: { active: 'false' } })
    // The endpoint lookup itself filters inactive connectors, so resolve directly.
    const ep = registry.endpointToObject(
        (() => {
            const gr = new sandbox.SecOpsRegistry().getEndpoint('e1')
            return gr
        })()
    )

    const result = client.execute(ep, {})

    assert.strictEqual(result.ok, false)
    assert.ok(result.error.indexOf('inactive') !== -1)
    assert.strictEqual(sandbox._restCalls.length, 0, 'no HTTP call may be made for an inactive connector')
})

test('reports a clear error when a credential alias cannot be resolved', () => {
    const { client, sandbox, registry } = makeClient({
        connector: { auth_type: 'alias', connection_alias: 'alias-missing' },
        connections: {},
    })

    const result = client.execute(resolveEndpoint(registry), {})

    assert.strictEqual(result.ok, false)
    assert.ok(result.error.indexOf('Connection & Credential Alias') !== -1)
    assert.strictEqual(sandbox._restCalls.length, 0, 'no call may be made without resolved credentials')
})

test('uses the connection alias url and credentials when configured', () => {
    const { client, sandbox, registry } = makeClient({
        connector: { auth_type: 'alias', connection_alias: 'alias1', base_url: 'https://ignored.example.com' },
        connections: {
            alias1: { url: 'https://from-alias.example.com', credentials: { user_name: 'svc', password: 'p' } },
        },
        restResponder: () => ({ status: 200, body: '{}' }),
    })

    const result = client.execute(resolveEndpoint(registry), {})

    assert.strictEqual(result.ok, true)
    assert.strictEqual(sandbox._restCalls[0].endpoint, 'https://from-alias.example.com/v1/lookup')
    assert.deepStrictEqual(sandbox._restCalls[0].basicAuth, { user: 'svc', password: 'p' })
})

test('an auth profile connector without a profile sys_id fails instead of calling anonymously', () => {
    const { client, sandbox, registry } = makeClient({
        connector: { auth_type: 'oauth2', auth_profile_id: '' },
    })

    const result = client.execute(resolveEndpoint(registry), {})

    assert.strictEqual(result.ok, false)
    assert.strictEqual(sandbox._restCalls.length, 0, 'never silently downgrade to an unauthenticated call')
})

test('extra headers from the endpoint are applied', () => {
    const { client, sandbox, registry } = makeClient({
        endpoint: { request_headers: '{"X-Scan-Profile":"${profile}"}' },
        restResponder: () => ({ status: 200, body: '{}' }),
    })

    client.execute(resolveEndpoint(registry), { profile: 'deep' })

    assert.strictEqual(sandbox._restCalls[0].headers['X-Scan-Profile'], 'deep')
    assert.strictEqual(sandbox._restCalls[0].headers['Accept'], 'application/json')
})

test('GET requests do not carry a body', () => {
    const { client, sandbox, registry } = makeClient({
        endpoint: { http_method: 'get', path: '/v1/lookup/${ioc}', request_template: '' },
        restResponder: () => ({ status: 200, body: '{}' }),
    })

    client.execute(resolveEndpoint(registry), { ioc: '8.8.8.8' })

    assert.strictEqual(sandbox._restCalls[0].method, 'GET')
    assert.strictEqual(sandbox._restCalls[0].body, '')
    assert.strictEqual(sandbox._restCalls[0].endpoint, 'https://api.example.com/v1/lookup/8.8.8.8')
})
