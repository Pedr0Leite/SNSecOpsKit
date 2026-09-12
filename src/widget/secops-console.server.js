/**
 * Connector console - server script.
 *
 * Role checks happen here, on the server. The client only decides what to draw.
 * Reads use GlideRecordSecure so a viewer sees exactly what their ACLs permit.
 */
;(function () {
    var registry = new SecOpsRegistry()
    var json = new SecOpsJson()

    data.canView =
        gs.hasRole('x_335329_secops.viewer') || gs.hasRole('x_335329_secops.operator') || gs.hasRole('x_335329_secops.admin')
    data.canOperate = gs.hasRole('x_335329_secops.operator') || gs.hasRole('x_335329_secops.admin')
    data.connectors = []
    data.transactions = []
    data.summary = { healthy: 0, degraded: 0, down: 0, unknown: 0 }
    data.testResult = null
    data.error = null

    if (!data.canView) {
        data.error = gs.getMessage('You do not have permission to view the SecOps connector console.')
        return
    }

    // Only an operator may trigger an outbound call from the console.
    if (input && input.action === 'test_connection') {
        if (!data.canOperate) {
            data.error = gs.getMessage('You do not have permission to test connections.')
        } else if (!input.connector) {
            data.error = gs.getMessage('No connector was selected.')
        } else {
            try {
                data.testResult = new SecOpsHealthChecker().check(String(input.connector))
            } catch (e) {
                data.error = gs.getMessage('The connection test failed unexpectedly. Check the application logs.')
            }
        }
    }

    var connectors = new GlideRecordSecure(registry.TABLE_CONNECTOR)
    if (connectors.isValid()) {
        connectors.orderBy('name')
        connectors.query()
        while (connectors.next()) {
            var health = connectors.getValue('health_status') || 'unknown'
            if (data.summary[health] === undefined) {
                health = 'unknown'
            }
            data.summary[health]++

            data.connectors.push({
                sys_id: connectors.getUniqueValue(),
                name: connectors.getValue('name'),
                vendor: connectors.getValue('vendor'),
                category: connectors.getDisplayValue('category'),
                active: connectors.getValue('active') === 'true' || connectors.getValue('active') === '1',
                health_status: health,
                last_health_check: connectors.getValue('last_health_check'),
                last_health_message: connectors.getValue('last_health_message'),
            })
        }
    }

    var limit = parseInt(options && options.log_limit ? options.log_limit : 25, 10)
    if (isNaN(limit) || limit < 1 || limit > 100) {
        limit = 25
    }

    var transactions = new GlideRecordSecure(registry.TABLE_TRANSACTION)
    if (transactions.isValid()) {
        transactions.orderByDesc('sys_created_on')
        transactions.setLimit(limit)
        transactions.query()
        while (transactions.next()) {
            data.transactions.push({
                sys_id: transactions.getUniqueValue(),
                correlation_id: transactions.getValue('correlation_id'),
                connector: transactions.getDisplayValue('connector'),
                endpoint: transactions.getDisplayValue('endpoint'),
                capability: transactions.getValue('capability'),
                state: transactions.getValue('state'),
                http_status: transactions.getValue('http_status'),
                duration_ms: transactions.getValue('duration_ms'),
                error_message: transactions.getValue('error_message'),
                created: transactions.getValue('sys_created_on'),
            })
        }
    }
})()
