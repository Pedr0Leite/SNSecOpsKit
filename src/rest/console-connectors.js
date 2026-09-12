/**
 * GET /api/x_335329_secops/secops_console/connectors
 *
 * Connector health for the dashboard's status strip. Reports STORED health only - polling this
 * must never generate third-party traffic. Reads are ACL-enforced, so a viewer sees exactly the
 * connectors their role permits.
 */
;(function process(request, response) {
    var registry = new SecOpsRegistry()
    var rows = []
    var summary = { total: 0, healthy: 0, degraded: 0, down: 0, unknown: 0, inactive: 0 }

    var gr = new GlideRecordSecure(registry.TABLE_CONNECTOR)
    if (gr.isValid()) {
        gr.orderBy('name')
        gr.setLimit(100)
        gr.query()

        while (gr.next()) {
            var active = gr.getValue('active') === 'true' || gr.getValue('active') === '1'
            var health = gr.getValue('health_status') || 'unknown'
            if (summary[health] === undefined) {
                health = 'unknown'
            }

            summary.total++
            if (active) {
                summary[health]++
            } else {
                summary.inactive++
            }

            rows.push({
                sys_id: gr.getUniqueValue(),
                name: gr.getValue('name'),
                vendor: gr.getValue('vendor'),
                category: gr.getDisplayValue('category'),
                active: active,
                health_status: health,
                last_health_check: gr.getValue('last_health_check'),
                last_health_message: gr.getValue('last_health_message'),
            })
        }
    }

    response.setStatus(200)
    response.setBody({ ok: true, connectors: rows, summary: summary })
})(request, response)
