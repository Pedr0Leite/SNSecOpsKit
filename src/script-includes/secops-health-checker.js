/**
 * SecOpsHealthChecker - tests reachability of a connector and records the verdict.
 *
 * Shared by the console widget (on demand), the UI action and the scheduled poller, so the health
 * shown in the console and the health recorded on the record can never disagree.
 */
var SecOpsHealthChecker = Class.create()

SecOpsHealthChecker.prototype = {
    initialize: function () {
        this.registry = new SecOpsRegistry()
        this.rest = new SecOpsRestClient()
        this.log = new SecOpsLog('SecOpsHealthChecker')
    },

    /**
     * @param connectorId sys_id on x_335329_secops_connector
     * @returns { ok, status, health, message, connector, duration_ms }
     */
    check: function (connectorId) {
        var outcome = { ok: false, status: 0, health: 'unknown', message: '', connector: connectorId, duration_ms: 0 }

        var connectorGr = this.registry.getConnector(connectorId)
        if (!connectorGr) {
            outcome.message = 'Connector not found'
            return outcome
        }
        var connector = this.registry.connectorToObject(connectorGr)
        outcome.connector_name = connector.name

        if (!connector.active) {
            outcome.health = 'unknown'
            outcome.message = 'Connector is inactive - not tested'
            this.record(connectorId, outcome.health, outcome.message)
            return outcome
        }

        var endpoint = this.resolveHealthEndpoint(connector)
        if (!endpoint) {
            outcome.health = 'unknown'
            outcome.message =
                'No health check configured. Add an endpoint with capability "Health check", or set a health check path on the connector.'
            this.record(connectorId, outcome.health, outcome.message)
            return outcome
        }

        var result = this.rest.execute(endpoint, { connector: connector }, {
            source_table: this.registry.TABLE_CONNECTOR,
            source_record: connectorId,
        })

        outcome.ok = result.ok
        outcome.status = result.status
        outcome.duration_ms = result.duration_ms
        outcome.health = this.classify(result)
        outcome.message = result.ok ? 'Reachable (HTTP ' + result.status + ')' : result.error || 'Unreachable'

        this.record(connectorId, outcome.health, outcome.message)
        return outcome
    },

    /** Checks every active connector. Used by the scheduled poller. */
    checkAll: function () {
        var summary = { checked: 0, healthy: 0, degraded: 0, down: 0, unknown: 0 }
        var connectors = this.registry.listActiveConnectors()
        for (var i = 0; i < connectors.length; i++) {
            var result = this.check(connectors[i].sys_id)
            summary.checked++
            if (summary[result.health] !== undefined) {
                summary[result.health]++
            }
        }
        this.log.info('Connector health sweep complete', summary)
        return summary
    },

    /**
     * Prefers a configured 'health' endpoint. Falls back to a synthetic GET against the
     * connector's health check path so a connector can be tested before any endpoint exists.
     */
    resolveHealthEndpoint: function (connector) {
        var configured = this.registry.findEndpointForCapability('health', connector.sys_id)
        if (configured) {
            return configured
        }
        if (!connector.health_endpoint_path && !connector.base_url) {
            return null
        }
        return {
            sys_id: 'synthetic-health-' + connector.sys_id,
            name: connector.name + ' health probe',
            connector: connector.sys_id,
            capability: 'health',
            active: true,
            http_method: 'get',
            path: connector.health_endpoint_path || '',
            request_template: '',
            request_headers: '',
            response_root: '',
            success_codes: '200,201,202,204',
            order: 100,
        }
    },

    /** A reachable-but-erroring endpoint is 'degraded'; no answer at all is 'down'. */
    classify: function (result) {
        if (result.ok) {
            return 'healthy'
        }
        if (result.status === 0) {
            return 'down'
        }
        if (result.status >= 500) {
            return 'degraded'
        }
        // 4xx means the service answered - it is up, but the configuration or credential is wrong.
        return 'degraded'
    },

    record: function (connectorId, health, message) {
        try {
            var gr = new GlideRecord(this.registry.TABLE_CONNECTOR)
            if (!gr.isValid() || !gr.get(String(connectorId))) {
                return false
            }
            gr.setValue('health_status', health)
            gr.setValue('last_health_check', new GlideDateTime().getValue())
            gr.setValue('last_health_message', String(message).substring(0, 1000))
            return Boolean(gr.update())
        } catch (e) {
            this.log.warn('Unable to record connector health', { connector: connectorId, error: String(e) })
            return false
        }
    },

    type: 'SecOpsHealthChecker',
}
