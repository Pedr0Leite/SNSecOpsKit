/**
 * SecOpsRegistry - the configuration layer.
 *
 * Every table name, property name and config lookup lives here, so the rest of the framework never
 * hardcodes one. Connector and endpoint records are read with GlideRecord (framework-internal
 * config reads that must succeed regardless of the caller's ACLs); anything surfaced to an end
 * user goes through GlideRecordSecure in SecOpsTargetWriter and SecOpsConsoleAjax instead.
 */
var SecOpsRegistry = Class.create()

SecOpsRegistry.prototype = {
    initialize: function () {
        this.log = new SecOpsLog('SecOpsRegistry')
    },

    // --- table names -------------------------------------------------------
    TABLE_CONNECTOR: 'x_335329_secops_connector',
    TABLE_ENDPOINT: 'x_335329_secops_endpoints',
    TABLE_FIELD_MAP: 'x_335329_secops_field_map',
    TABLE_TRANSACTION: 'x_335329_secops_transaction',
    TABLE_VULN_STAGE: 'x_335329_secops_vuln_stage',
    TABLE_CVE_WATCH: 'x_335329_secops_cve_watch',

    // --- property names ----------------------------------------------------
    PROP_TIMEOUT: 'x_335329_secops.http.timeout_ms',
    PROP_MAX_RETRIES: 'x_335329_secops.http.max_retries',
    PROP_RETENTION_DAYS: 'x_335329_secops.log.retention_days',
    PROP_REDACT_KEYS: 'x_335329_secops.redact.extra_keys',
    PROP_INGEST_MAX: 'x_335329_secops.ingest.max_records',
    PROP_DETONATE_MAX: 'x_335329_secops.detonate.max_indicators',
    PROP_AUTO_ENRICH: 'x_335329_secops.enrichment.auto_enabled',
    PROP_VR_PROMOTION: 'x_335329_secops.vr.promotion_enabled',
    PROP_VR_ENTRY_TABLE: 'x_335329_secops.vr.entry_table',
    PROP_VR_ITEM_TABLE: 'x_335329_secops.vr.item_table',
    PROP_CVE_ENABLED: 'x_335329_secops.cve.enabled',
    PROP_CVE_CREATE_SIR: 'x_335329_secops.cve.create_incidents',
    PROP_CVE_BACKFILL_MONTHS: 'x_335329_secops.cve.backfill_months',
    PROP_CVE_KEYWORD: 'x_335329_secops.cve.keyword',
    PROP_CVE_CONNECTOR: 'x_335329_secops.cve.connector',
    PROP_CVE_WATERMARK: 'x_335329_secops.cve.last_run',
    PROP_CVE_SIR_TABLE: 'x_335329_secops.cve.incident_table',
    PROP_CVE_INITIAL_DONE: 'x_335329_secops.cve.initial_run_complete',
    PROP_CVE_FIRST_RUN_SIR_MONTHS: 'x_335329_secops.cve.first_run_sir_months',

    // --- typed property access --------------------------------------------
    getString: function (name, fallback) {
        var value = gs.getProperty(name, fallback === undefined ? '' : fallback)
        return value === null || value === undefined ? '' : String(value)
    },

    getInt: function (name, fallback) {
        var raw = gs.getProperty(name, String(fallback))
        var parsed = parseInt(raw, 10)
        return isNaN(parsed) ? fallback : parsed
    },

    getBool: function (name, fallback) {
        var raw = gs.getProperty(name, fallback ? 'true' : 'false')
        return String(raw).toLowerCase() === 'true'
    },

    // --- connectors --------------------------------------------------------
    /** Returns a GlideRecord positioned on the connector, or null. */
    getConnector: function (connectorId) {
        if (!connectorId) {
            return null
        }
        var gr = new GlideRecord(this.TABLE_CONNECTOR)
        if (!gr.isValid() || !gr.get(String(connectorId))) {
            return null
        }
        return gr
    },

    /** Active connectors, optionally filtered by category. */
    listActiveConnectors: function (category) {
        var results = []
        var gr = new GlideRecord(this.TABLE_CONNECTOR)
        if (!gr.isValid()) {
            return results
        }
        gr.addQuery('active', 'true')
        if (category) {
            gr.addQuery('category', String(category))
        }
        gr.orderBy('name')
        gr.query()
        while (gr.next()) {
            results.push(this.connectorToObject(gr))
        }
        return results
    },

    connectorToObject: function (gr) {
        return {
            sys_id: gr.getUniqueValue(),
            name: gr.getValue('name'),
            vendor: gr.getValue('vendor'),
            category: gr.getValue('category'),
            active: gr.getValue('active') === 'true' || gr.getValue('active') === '1',
            base_url: gr.getValue('base_url'),
            auth_type: gr.getValue('auth_type'),
            connection_alias: gr.getValue('connection_alias'),
            auth_profile_id: gr.getValue('auth_profile_id'),
            mid_server: gr.getValue('mid_server'),
            // RESTMessageV2.setMIDServer() needs the MID Server NAME, not the reference sys_id.
            mid_server_name: gr.getValue('mid_server') ? gr.getDisplayValue('mid_server') : '',
            http_timeout_ms: this.toInt(gr.getValue('http_timeout_ms'), this.getInt(this.PROP_TIMEOUT, 30000)),
            // Clamped here so a value written by a script, import set or the Table API cannot
            // produce a zero-attempt or runaway retry loop downstream.
            max_retries: this.clamp(this.toInt(gr.getValue('max_retries'), this.getInt(this.PROP_MAX_RETRIES, 2)), 0, 5),
            health_endpoint_path: gr.getValue('health_endpoint_path'),
            health_status: gr.getValue('health_status'),
            last_health_check: gr.getValue('last_health_check'),
            last_health_message: gr.getValue('last_health_message'),
        }
    },

    // --- endpoints ---------------------------------------------------------
    /** Returns a GlideRecord positioned on the endpoint, or null. */
    getEndpoint: function (endpointId) {
        if (!endpointId) {
            return null
        }
        var gr = new GlideRecord(this.TABLE_ENDPOINT)
        if (!gr.isValid() || !gr.get(String(endpointId))) {
            return null
        }
        return gr
    },

    /**
     * Resolves the endpoint a capability should use. When no connector is supplied the lowest
     * ordered active endpoint for that capability across all active connectors wins, which is what
     * makes "enrich this observable" work without the caller naming a vendor.
     */
    findEndpointForCapability: function (capability, connectorId) {
        if (!capability) {
            return null
        }
        var gr = new GlideRecord(this.TABLE_ENDPOINT)
        if (!gr.isValid()) {
            return null
        }
        gr.addQuery('capability', String(capability))
        gr.addQuery('active', 'true')
        // Dot-walked so the owning connector's active flag is part of the query rather than a
        // per-row lookup inside the loop.
        gr.addQuery('connector.active', 'true')
        if (connectorId) {
            gr.addQuery('connector', String(connectorId))
        }
        gr.orderBy('order')
        gr.setLimit(1)
        gr.query()

        return gr.next() ? this.endpointToObject(gr) : null
    },

    /**
     * Resolves an endpoint by its name.
     *
     * Capability lookup cannot separate two endpoints that share one - the CVE feed needs a search
     * call and a detail call, both 'custom' on the same connector. Name is what distinguishes them,
     * so the caller names what it wants instead of relying on `order`.
     */
    findEndpointByName: function (name, connectorId) {
        if (!name) {
            return null
        }
        var gr = new GlideRecord(this.TABLE_ENDPOINT)
        if (!gr.isValid()) {
            return null
        }
        gr.addQuery('name', String(name))
        gr.addQuery('active', 'true')
        gr.addQuery('connector.active', 'true')
        if (connectorId) {
            gr.addQuery('connector', String(connectorId))
        }
        gr.setLimit(1)
        gr.query()

        return gr.next() ? this.endpointToObject(gr) : null
    },

    /** Resolves a connector by name. The CVE feed names its connector in a property. */
    findConnectorByName: function (name) {
        if (!name) {
            return null
        }
        var gr = new GlideRecord(this.TABLE_CONNECTOR)
        if (!gr.isValid()) {
            return null
        }
        gr.addQuery('name', String(name))
        gr.setLimit(1)
        gr.query()

        return gr.next() ? this.connectorToObject(gr) : null
    },

    /** All active endpoints for a capability - used when an action should fan out to every tool. */
    listEndpointsForCapability: function (capability) {
        var results = []
        if (!capability) {
            return results
        }
        var gr = new GlideRecord(this.TABLE_ENDPOINT)
        if (!gr.isValid()) {
            return results
        }
        gr.addQuery('capability', String(capability))
        gr.addQuery('active', 'true')
        gr.addQuery('connector.active', 'true')
        gr.orderBy('order')
        gr.query()

        while (gr.next()) {
            results.push(this.endpointToObject(gr))
        }
        return results
    },

    endpointToObject: function (gr) {
        return {
            sys_id: gr.getUniqueValue(),
            name: gr.getValue('name'),
            connector: gr.getValue('connector'),
            capability: gr.getValue('capability'),
            active: gr.getValue('active') === 'true' || gr.getValue('active') === '1',
            http_method: gr.getValue('http_method'),
            path: gr.getValue('path'),
            request_template: gr.getValue('request_template'),
            request_headers: gr.getValue('request_headers'),
            response_root: gr.getValue('response_root'),
            success_codes: gr.getValue('success_codes'),
            order: this.toInt(gr.getValue('order'), 100),
        }
    },

    // --- field mappings ----------------------------------------------------
    getFieldMaps: function (endpointId) {
        var maps = []
        if (!endpointId) {
            return maps
        }
        var gr = new GlideRecord(this.TABLE_FIELD_MAP)
        if (!gr.isValid()) {
            return maps
        }
        gr.addQuery('endpoint', String(endpointId))
        gr.orderBy('order')
        gr.query()

        while (gr.next()) {
            maps.push({
                sys_id: gr.getUniqueValue(),
                source_path: gr.getValue('source_path'),
                target_table: gr.getValue('target_table'),
                target_field: gr.getValue('target_field'),
                transform: gr.getValue('transform') || 'none',
                default_value: gr.getValue('default_value'),
                mandatory: gr.getValue('mandatory') === 'true' || gr.getValue('mandatory') === '1',
                order: this.toInt(gr.getValue('order'), 100),
            })
        }
        return maps
    },

    toInt: function (value, fallback) {
        var parsed = parseInt(value, 10)
        return isNaN(parsed) ? fallback : parsed
    },

    clamp: function (value, min, max) {
        return Math.max(min, Math.min(max, value))
    },

    type: 'SecOpsRegistry',
}
