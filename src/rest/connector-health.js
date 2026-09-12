/**
 * GET /api/x_335329_secops/secops_connector/health
 *
 * Current health of every active connector. Intended for the console and for external monitoring,
 * so it reports stored health rather than making live outbound calls - polling this endpoint must
 * never itself generate third-party traffic.
 */
;(function process(request, response) {
    var registry = new SecOpsRegistry()
    var connectors = registry.listActiveConnectors()

    var summary = { healthy: 0, degraded: 0, down: 0, unknown: 0 }
    var rows = []

    for (var i = 0; i < connectors.length; i++) {
        var connector = connectors[i]
        var health = connector.health_status || 'unknown'
        if (summary[health] === undefined) {
            health = 'unknown'
        }
        summary[health]++

        rows.push({
            sys_id: connector.sys_id,
            name: connector.name,
            vendor: connector.vendor,
            category: connector.category,
            health_status: health,
            last_health_check: connector.last_health_check,
            last_health_message: connector.last_health_message,
        })
    }

    response.setStatus(200)
    response.setBody({
        ok: true,
        total: connectors.length,
        summary: summary,
        connectors: rows,
    })
})(request, response)
