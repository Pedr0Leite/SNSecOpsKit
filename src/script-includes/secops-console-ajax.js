/**
 * SecOpsConsoleAjax - GlideAjax surface for the connector console.
 *
 * Every method re-checks the caller's role on the server. A client-callable script include is a
 * public entry point: the widget hiding a button is a UX affordance, not a control.
 *
 * Reads use GlideRecordSecure so a viewer only ever sees rows their ACLs allow.
 */
var SecOpsConsoleAjax = Class.create()

SecOpsConsoleAjax.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {
    ROLE_VIEWER: 'x_335329_secops.viewer',
    ROLE_OPERATOR: 'x_335329_secops.operator',

    /** Connector health plus recent transactions, for the console landing view. */
    getConsole: function () {
        if (!this._canView()) {
            return this._denied()
        }

        var registry = new SecOpsRegistry()
        var payload = { connectors: [], transactions: [], generated: new GlideDateTime().getValue() }

        var connectors = new GlideRecordSecure(registry.TABLE_CONNECTOR)
        if (connectors.isValid()) {
            connectors.orderBy('name')
            connectors.query()
            while (connectors.next()) {
                payload.connectors.push({
                    sys_id: connectors.getUniqueValue(),
                    name: connectors.getValue('name'),
                    vendor: connectors.getValue('vendor'),
                    category: connectors.getDisplayValue('category'),
                    active: connectors.getValue('active') === 'true' || connectors.getValue('active') === '1',
                    health_status: connectors.getValue('health_status') || 'unknown',
                    last_health_check: connectors.getValue('last_health_check'),
                    last_health_message: connectors.getValue('last_health_message'),
                })
            }
        }

        payload.transactions = this._recentTransactions(registry, 25)
        return new SecOpsJson().stringify(payload)
    },

    /** Tests one connector on demand. Requires the operator role - this makes an outbound call. */
    testConnection: function () {
        if (!this._canOperate()) {
            return this._denied()
        }

        var connectorId = this.getParameter('sysparm_connector')
        if (!connectorId) {
            return new SecOpsJson().stringify({ ok: false, error: 'No connector supplied' })
        }

        var result = new SecOpsHealthChecker().check(String(connectorId))
        return new SecOpsJson().stringify(result)
    },

    /** Recent transactions only, for polling the log table without reloading the page. */
    getTransactions: function () {
        if (!this._canView()) {
            return this._denied()
        }
        var registry = new SecOpsRegistry()
        var limitParam = parseInt(this.getParameter('sysparm_limit'), 10)
        var limit = isNaN(limitParam) ? 25 : Math.min(Math.max(limitParam, 1), 100)
        return new SecOpsJson().stringify({ transactions: this._recentTransactions(registry, limit) })
    },

    _recentTransactions: function (registry, limit) {
        var rows = []
        var gr = new GlideRecordSecure(registry.TABLE_TRANSACTION)
        if (!gr.isValid()) {
            return rows
        }
        gr.orderByDesc('sys_created_on')
        gr.setLimit(limit)
        gr.query()
        while (gr.next()) {
            rows.push({
                sys_id: gr.getUniqueValue(),
                correlation_id: gr.getValue('correlation_id'),
                connector: gr.getDisplayValue('connector'),
                endpoint: gr.getDisplayValue('endpoint'),
                capability: gr.getValue('capability'),
                state: gr.getValue('state'),
                http_status: gr.getValue('http_status'),
                duration_ms: gr.getValue('duration_ms'),
                error_message: gr.getValue('error_message'),
                created: gr.getValue('sys_created_on'),
            })
        }
        return rows
    },

    _canView: function () {
        return gs.hasRole(this.ROLE_VIEWER) || gs.hasRole(this.ROLE_OPERATOR) || gs.hasRole('x_335329_secops.admin')
    },

    _canOperate: function () {
        return gs.hasRole(this.ROLE_OPERATOR) || gs.hasRole('x_335329_secops.admin')
    },

    _denied: function () {
        return new SecOpsJson().stringify({ ok: false, error: 'You do not have permission to perform this action' })
    },

    type: 'SecOpsConsoleAjax',
})
