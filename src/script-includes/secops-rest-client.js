/**
 * SecOpsRestClient - the single outbound HTTP path for the whole framework.
 *
 * Responsibilities: resolve credentials (never store them), build the request from the endpoint
 * configuration, execute with a bounded retry policy, and record a redacted transaction.
 *
 * Retry note: scoped applications have no gs.sleep(), so there is no in-process backoff. Transient
 * failures are retried immediately up to max_retries; anything still failing with a
 * back-pressure status (429/503) is parked as 'retry_pending' with a next_retry timestamp for the
 * "SecOps Connector Deferred Retry" scheduled job. Busy-waiting on a worker thread would be worse
 * than waiting for the next job run.
 */
var SecOpsRestClient = Class.create()

SecOpsRestClient.prototype = {
    initialize: function () {
        this.registry = new SecOpsRegistry()
        this.json = new SecOpsJson()
        this.template = new SecOpsTemplate()
        this.transactions = new SecOpsTransactionLogger()
        this.log = new SecOpsLog('SecOpsRestClient')
    },

    RETRYABLE_STATUS: [0, 408, 425, 429, 500, 502, 503, 504],
    BACKPRESSURE_STATUS: [429, 503],

    /**
     * Executes one configured endpoint.
     *
     * @param endpoint  endpoint object from SecOpsRegistry.endpointToObject
     * @param context   values available to ${...} placeholders in the path/body/headers
     * @param options   { source_table, source_record, correlation_id, skipLogging }
     * @returns { ok, status, body, parsed, error, transaction, duration_ms, attempts }
     */
    execute: function (endpoint, context, options) {
        var opts = options || {}
        var ctx = context || {}

        if (!endpoint || !endpoint.sys_id) {
            return this.failure('No endpoint supplied', null)
        }

        var connectorGr = this.registry.getConnector(endpoint.connector)
        if (!connectorGr) {
            return this.failure('Connector not found for endpoint ' + endpoint.name, null)
        }
        var connector = this.registry.connectorToObject(connectorGr)

        if (!connector.active) {
            return this.failure('Connector ' + connector.name + ' is inactive', null)
        }

        var request
        try {
            request = this.buildRequest(connector, endpoint, ctx)
        } catch (e) {
            return this.failure('Unable to build request: ' + String(e), null)
        }
        if (request.error) {
            return this.failure(request.error, null)
        }

        var transactionId = null
        if (!opts.skipLogging) {
            transactionId = this.transactions.open({
                correlation_id: opts.correlation_id,
                connector: connector.sys_id,
                endpoint: endpoint.sys_id,
                capability: endpoint.capability,
                source_table: opts.source_table,
                source_record: opts.source_record,
                request: { method: request.method, url: request.url, headers: request.headers, body: request.bodyObject },
            })
        }

        var result = this.send(connector, endpoint, request)
        result.transaction = transactionId

        if (transactionId) {
            this.transactions.close(transactionId, {
                state: this.transactionState(result),
                http_status: result.status,
                duration_ms: result.duration_ms,
                response: result.parsed !== null ? result.parsed : result.body,
                error: result.error,
                retry_count: result.attempts > 0 ? result.attempts - 1 : 0,
                next_retry: result.next_retry,
            })
        }

        return result
    },

    /** Runs the request, retrying transient failures up to the connector's max_retries. */
    send: function (connector, endpoint, request) {
        // Always at least one attempt. A max_retries below zero (reachable through a script, an
        // import set or the Table API - the dictionary min is only a form constraint) would
        // otherwise skip the loop entirely and leave `last` null.
        var maxAttempts = Math.max(1, connector.max_retries + 1)
        var successCodes = this.successCodes(endpoint.success_codes)
        var started = new GlideDateTime().getNumericValue()
        var last = null

        for (var attempt = 1; attempt <= maxAttempts; attempt++) {
            last = this.attempt(connector, request, successCodes)
            last.attempts = attempt

            if (last.ok || !this.isRetryable(last.status)) {
                break
            }
            if (attempt < maxAttempts) {
                this.log.warn('Retrying connector call', {
                    connector: connector.name,
                    endpoint: endpoint.name,
                    status: last.status,
                    attempt: attempt,
                })
            }
        }

        last.duration_ms = new GlideDateTime().getNumericValue() - started

        if (!last.ok && this.isBackpressure(last.status)) {
            last.next_retry = this.nextRetryTimestamp()
        }

        return last
    },

    /** A single HTTP round trip. Never throws - transport failures come back as status 0. */
    attempt: function (connector, request, successCodes) {
        var message
        try {
            message = new sn_ws.RESTMessageV2()
            message.setEndpoint(request.url)
            message.setHttpMethod(request.method)
            message.setHttpTimeout(connector.http_timeout_ms)

            var headerNames = Object.keys(request.headers)
            for (var i = 0; i < headerNames.length; i++) {
                message.setRequestHeader(headerNames[i], request.headers[headerNames[i]])
            }

            if (request.body !== '' && request.method !== 'GET' && request.method !== 'DELETE') {
                message.setRequestBody(request.body)
            }

            this.applyAuthentication(message, connector, request)

            // setMIDServer takes the MID Server NAME, not its sys_id.
            if (connector.mid_server_name) {
                message.setMIDServer(connector.mid_server_name)
            }
        } catch (e) {
            return this.failure('Unable to prepare REST message: ' + String(e), 0)
        }

        var response
        try {
            response = message.execute()
        } catch (e) {
            // Transport-level failure (DNS, TLS, timeout) - retryable.
            return this.failure('Transport error: ' + String(e), 0)
        }

        var status = parseInt(response.getStatusCode(), 10)
        if (isNaN(status)) {
            status = 0
        }
        var body = response.getBody()
        var transportError = response.getErrorMessage()

        var result = {
            ok: successCodes.indexOf(status) !== -1,
            status: status,
            body: this.json.truncate(body, 32000),
            parsed: this.json.parse(body),
            error: null,
            attempts: 1,
            duration_ms: 0,
            next_retry: null,
        }

        if (!result.ok) {
            result.error = transportError
                ? 'HTTP ' + status + ': ' + transportError
                : 'HTTP ' + status + ' (expected one of ' + successCodes.join(',') + ')'
        }

        return result
    },

    /**
     * Credentials are resolved at call time and never persisted by this application.
     *
     * 'alias' is the recommended path: a Connection & Credential Alias keeps the secret in the
     * platform credential store, supports per-environment values, and is what IntegrationHub uses.
     */
    applyAuthentication: function (message, connector, request) {
        if (connector.auth_type === 'none') {
            return
        }

        if (connector.auth_type === 'alias') {
            if (request.credentials && request.credentials.user_name) {
                message.setBasicAuth(request.credentials.user_name, request.credentials.password || '')
            }
            return
        }

        if (connector.auth_type === 'basic' || connector.auth_type === 'oauth2') {
            if (!connector.auth_profile_id) {
                throw new Error('Connector ' + connector.name + ' has auth type ' + connector.auth_type + ' but no profile sys_id')
            }
            // The platform refreshes OAuth tokens behind setAuthenticationProfile; an expired
            // grant surfaces as a 401 and is reported to the administrator rather than retried
            // blindly, because a wrong retry on an expired grant can lock the account out.
            message.setAuthenticationProfile(connector.auth_type, connector.auth_profile_id)
        }
    },

    /** Assembles url, method, headers and body from the connector + endpoint configuration. */
    buildRequest: function (connector, endpoint, context) {
        var credentials = null
        var baseUrl = connector.base_url || ''

        if (connector.auth_type === 'alias') {
            if (!connector.connection_alias) {
                return { error: 'Connector ' + connector.name + ' uses an alias but none is selected' }
            }
            var connection = this.resolveConnection(connector.connection_alias)
            if (!connection) {
                return {
                    error:
                        'Connection & Credential Alias could not be resolved for ' +
                        connector.name +
                        ' - check the alias has an active connection for this domain and that the running user can read it',
                }
            }
            credentials = connection.credentials
            if (connection.url) {
                baseUrl = connection.url
            }
        }

        var path = this.template.render(endpoint.path, context)
        var url = this.joinUrl(baseUrl, path)
        if (!url) {
            return { error: 'Endpoint ' + endpoint.name + ' produced an empty URL' }
        }

        var headers = { Accept: 'application/json' }
        var method = String(endpoint.http_method || 'post').toUpperCase()
        var bodyObject = null
        var body = ''
        var expectsJson = false

        if (endpoint.request_template) {
            expectsJson = this.template.looksLikeJson(endpoint.request_template)
            // Values are JSON-escaped for a JSON template so a quote or backslash in an indicator
            // cannot break the body or inject extra keys.
            body = this.template.render(endpoint.request_template, context, { jsonEscape: expectsJson })

            if (expectsJson) {
                bodyObject = this.json.parse(body)
                if (bodyObject === null) {
                    // Refuse to send a body that was meant to be JSON and is not. Sending it would
                    // produce an opaque 400 from the third party and a log entry that hides the cause.
                    return {
                        error:
                            'Endpoint ' +
                            endpoint.name +
                            ' produced a request body that is not valid JSON after substitution - check the request body template',
                    }
                }
                headers['Content-Type'] = 'application/json'
            }
        }

        var configuredHeaders = this.json.parse(this.template.render(endpoint.request_headers, context, { jsonEscape: true }))
        if (configuredHeaders && typeof configuredHeaders === 'object') {
            var names = Object.keys(configuredHeaders)
            for (var i = 0; i < names.length; i++) {
                headers[names[i]] = String(configuredHeaders[names[i]])
            }
        }

        // An API key held in the credential store can be injected as a header without the
        // administrator ever pasting it into a configuration record.
        if (credentials && credentials.api_key) {
            headers['Authorization'] = headers['Authorization'] || 'Bearer ' + credentials.api_key
        }

        // A non-JSON body with no declared content type is rejected by many APIs with 400/415.
        // We do not guess the type - we name the fix.
        if (body !== '' && !expectsJson && !headers['Content-Type']) {
            this.log.warn(
                'Request body has no Content-Type. Set one in the endpoint\'s "Additional request headers".',
                { endpoint: endpoint.name }
            )
        }

        return {
            url: url,
            method: method,
            headers: headers,
            body: body,
            bodyObject: bodyObject !== null ? bodyObject : body,
            credentials: credentials,
        }
    },

    /**
     * Reads a Connection & Credential Alias. Returns null when absent or not readable.
     *
     * The scoped ConnectionInfo API exposes exactly four methods - getAttribute,
     * getCredentialAttribute, getDataMap and getExtendedAttributes. There is no getConnectionUrl():
     * the URL is an attribute named 'connection_url'.
     */
    resolveConnection: function (aliasId) {
        try {
            var provider = new sn_cc.ConnectionInfoProvider()
            var info = provider.getConnectionInfo(String(aliasId))
            if (!info) {
                return null
            }
            return {
                url: info.getAttribute('connection_url'),
                credentials: {
                    user_name: info.getCredentialAttribute('user_name'),
                    password: info.getCredentialAttribute('password'),
                    api_key: info.getCredentialAttribute('api_key'),
                },
            }
        } catch (e) {
            this.log.error('Connection alias lookup failed', { alias: aliasId, error: String(e) })
            return null
        }
    },

    joinUrl: function (baseUrl, path) {
        var cleanPath = path === null || path === undefined ? '' : String(path)
        // An absolute path in the endpoint record overrides the connector base URL entirely.
        if (/^https?:\/\//i.test(cleanPath)) {
            return cleanPath
        }
        var base = baseUrl === null || baseUrl === undefined ? '' : String(baseUrl)
        if (base === '') {
            return cleanPath
        }
        if (cleanPath === '') {
            return base
        }
        return base.replace(/\/+$/, '') + '/' + cleanPath.replace(/^\/+/, '')
    },

    successCodes: function (raw) {
        var codes = []
        var text = raw === null || raw === undefined || raw === '' ? '200,201,202,204' : String(raw)
        var parts = text.split(',')
        for (var i = 0; i < parts.length; i++) {
            var code = parseInt(parts[i].replace(/^\s+|\s+$/g, ''), 10)
            if (!isNaN(code)) {
                codes.push(code)
            }
        }
        return codes.length > 0 ? codes : [200, 201, 202, 204]
    },

    isRetryable: function (status) {
        return this.RETRYABLE_STATUS.indexOf(status) !== -1
    },

    isBackpressure: function (status) {
        return this.BACKPRESSURE_STATUS.indexOf(status) !== -1
    },

    nextRetryTimestamp: function () {
        var when = new GlideDateTime()
        when.addSeconds(300)
        return when.getValue()
    },

    transactionState: function (result) {
        if (result.ok) {
            return 'success'
        }
        return result.next_retry ? 'retry_pending' : 'failed'
    },

    failure: function (message, status) {
        this.log.error(message)
        return {
            ok: false,
            status: status === null || status === undefined ? 0 : status,
            body: '',
            parsed: null,
            error: message,
            attempts: 0,
            duration_ms: 0,
            next_retry: null,
            transaction: null,
        }
    },

    type: 'SecOpsRestClient',
}
