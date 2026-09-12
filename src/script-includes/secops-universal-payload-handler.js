/**
 * SecOpsUniversalPayloadHandler - the abstract handler every capability extends.
 *
 * It owns the shape of an integration call so the concrete handlers only describe what is specific
 * to their use case:
 *
 *   resolve endpoint -> build context -> call -> unwrap response -> map fields -> write -> report
 *
 * Subclasses override CAPABILITY, DEFAULT_TARGET_TABLE and the onSuccess/onFailure hooks. They
 * should not re-implement transport, logging, mapping or error handling.
 *
 * Instantiate directly only for a 'custom' capability; otherwise use one of the concrete handlers.
 */
var SecOpsUniversalPayloadHandler = Class.create()

SecOpsUniversalPayloadHandler.prototype = {
    initialize: function (source) {
        this.registry = new SecOpsRegistry()
        this.rest = new SecOpsRestClient()
        this.mapper = new SecOpsFieldMapper()
        this.writer = new SecOpsTargetWriter()
        this.json = new SecOpsJson()
        this.log = new SecOpsLog(source || 'SecOpsUniversalPayloadHandler')
    },

    /** Overridden by subclasses. */
    CAPABILITY: 'custom',
    DEFAULT_TARGET_TABLE: null,

    /**
     * Executes this handler's capability.
     *
     * @param context  values exposed to ${...} placeholders in the endpoint configuration
     * @param options  { connector, endpoint, source_table, source_record, correlation_id,
     *                   write (default true), capability }
     * @returns { ok, error, status, payload, writes, transaction, endpoint, connector }
     */
    run: function (context, options) {
        var opts = options || {}
        var ctx = context || {}
        var capability = opts.capability || this.CAPABILITY

        var endpoint = opts.endpoint || this.registry.findEndpointForCapability(capability, opts.connector)
        if (!endpoint) {
            return this.result(false, 'No active endpoint is configured for capability "' + capability + '"')
        }

        var callResult = this.rest.execute(endpoint, ctx, opts)

        if (!callResult.ok && callResult.status === 401) {
            this.reportExpiredCredential(endpoint)
        }

        var response = this.result(callResult.ok, callResult.error)
        response.status = callResult.status
        response.transaction = callResult.transaction
        response.endpoint = endpoint.sys_id
        response.connector = endpoint.connector

        if (!callResult.ok) {
            this.onFailure(response, ctx, opts)
            return response
        }

        response.payload = this.extractResult(callResult.parsed, endpoint)

        if (opts.write !== false) {
            response.writes = this.mapAndWrite(response.payload, endpoint, opts)

            // A 200 from the third party whose mapped records were refused is NOT a success. Every
            // caller reads `ok`; if it stayed true here, a rejected write would be invisible.
            if (response.writes && !response.writes.ok) {
                response.ok = false
                response.error = response.writes.errors.join('; ')
                this.onFailure(response, ctx, opts)
                return response
            }
        }

        this.onSuccess(response, ctx, opts)
        return response
    },

    /**
     * Safely parses an inbound payload. Accepts an already-parsed object, a JSON string, or
     * anything else (returning null) - inbound data is untrusted and must never throw here.
     */
    parsePayload: function (raw) {
        return this.json.parse(raw)
    },

    /** Applies the endpoint's response_root so mappings start from the interesting node. */
    extractResult: function (parsed, endpoint) {
        if (parsed === null || parsed === undefined) {
            return null
        }
        if (!endpoint || !endpoint.response_root) {
            return parsed
        }
        var rooted = this.json.get(parsed, endpoint.response_root, null)
        if (rooted === null) {
            this.log.warn('Response root path matched nothing; falling back to the full body', {
                endpoint: endpoint.name,
                response_root: endpoint.response_root,
            })
            return parsed
        }
        return rooted
    },

    /** Runs the endpoint's field mappings and writes the results. */
    mapAndWrite: function (payload, endpoint, options) {
        var opts = options || {}
        var summary = { ok: true, records: [], errors: [], skippedFields: [] }

        var maps = this.registry.getFieldMaps(endpoint.sys_id)
        if (maps.length === 0) {
            return summary
        }

        var mapped = this.mapper.apply(payload, maps, opts.defaultTable || this.DEFAULT_TARGET_TABLE)
        if (mapped.errors.length > 0) {
            summary.ok = false
            summary.errors = mapped.errors
            this.log.warn('Field mapping reported problems', { endpoint: endpoint.name, errors: mapped.errors })
            return summary
        }

        var tables = Object.keys(mapped.byTable)
        for (var i = 0; i < tables.length; i++) {
            var table = tables[i]
            var values = this.decorate(mapped.byTable[table], table, options)
            var written = this.writer.write(table, values, {
                secure: opts.secure !== false,
                coalesce: opts.coalesce,
            })

            if (written.ok) {
                summary.records.push({ table: table, sys_id: written.sys_id, updated: written.updated })
            } else {
                summary.ok = false
                summary.errors.push(written.error)
            }
            if (written.skipped.length > 0) {
                summary.skippedFields = summary.skippedFields.concat(written.skipped)
            }
        }

        return summary
    },

    /** Hook: last chance to add or override values before they are written. */
    decorate: function (values) {
        return values
    },

    /**
     * Logs an actionable diagnostic for an HTTP 401.
     *
     * There is deliberately no automatic token refresh here. The platform refreshes OAuth tokens
     * behind setAuthenticationProfile, so a 401 on an OAuth connector means the stored grant is
     * genuinely dead and needs a human to re-authorize it - and GlideOAuthClient has no
     * refreshToken() method to call anyway (its documented surface is getToken, requestToken,
     * requestTokenByRequest and revokeToken). Retrying a dead grant can lock the service account
     * out, so the framework reports instead of guessing.
     */
    reportExpiredCredential: function (endpoint) {
        var connectorGr = this.registry.getConnector(endpoint.connector)
        if (!connectorGr) {
            this.log.error('HTTP 401 from an endpoint whose connector could not be read', { endpoint: endpoint.name })
            return
        }

        var name = connectorGr.getValue('name')
        var authType = connectorGr.getValue('auth_type')

        if (authType === 'oauth2') {
            this.log.error(
                'HTTP 401: the OAuth grant for connector "' +
                    name +
                    '" is rejected. Re-authorize the OAuth profile (Application Registry > the entity used by this connector); it cannot be refreshed automatically.'
            )
            return
        }

        if (authType === 'alias') {
            this.log.error(
                'HTTP 401: the third party rejected the credential in the Connection & Credential Alias for connector "' +
                    name +
                    '". Check the credential is current and has the required scope.'
            )
            return
        }

        this.log.error('HTTP 401 from connector "' + name + '" (auth type ' + authType + '). Check its credentials.')
    },

    /** Hook for subclasses. */
    onSuccess: function () {},

    /** Hook for subclasses. */
    onFailure: function () {},

    result: function (ok, error) {
        return {
            ok: Boolean(ok),
            error: error || null,
            status: 0,
            payload: null,
            writes: null,
            transaction: null,
            endpoint: null,
            connector: null,
        }
    },

    type: 'SecOpsUniversalPayloadHandler',
}
