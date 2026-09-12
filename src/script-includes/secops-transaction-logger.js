/**
 * SecOpsTransactionLogger - writes the audit trail for every connector call.
 *
 * open() before the call, close() after. Bodies are redacted and truncated on the way in, so the
 * transaction table can be exposed to analysts without exposing credentials.
 */
var SecOpsTransactionLogger = Class.create()

SecOpsTransactionLogger.prototype = {
    initialize: function () {
        this.registry = new SecOpsRegistry()
        this.json = new SecOpsJson()
        this.log = new SecOpsLog('SecOpsTransactionLogger')
    },

    /**
     * Creates a pending transaction and returns its sys_id (or null when logging is unavailable -
     * a logging failure must never abort the integration it is observing).
     */
    open: function (context) {
        var ctx = context || {}
        try {
            var gr = new GlideRecord(this.registry.TABLE_TRANSACTION)
            if (!gr.isValid()) {
                return null
            }
            gr.initialize()
            gr.setValue('correlation_id', ctx.correlation_id || gs.generateGUID())
            gr.setValue('state', 'pending')
            if (ctx.connector) {
                gr.setValue('connector', ctx.connector)
            }
            if (ctx.endpoint) {
                gr.setValue('endpoint', ctx.endpoint)
            }
            if (ctx.capability) {
                gr.setValue('capability', ctx.capability)
            }
            if (ctx.source_table) {
                gr.setValue('source_table', ctx.source_table)
            }
            if (ctx.source_record) {
                gr.setValue('source_record', ctx.source_record)
            }
            gr.setValue('request_summary', this.summarize(ctx.request))
            gr.setValue('retry_count', 0)
            return gr.insert()
        } catch (e) {
            this.log.warn('Unable to open transaction record', { error: String(e) })
            return null
        }
    },

    /** Finalizes a transaction. `result` carries state, http_status, duration_ms, response, error. */
    close: function (transactionId, result) {
        if (!transactionId) {
            return false
        }
        var outcome = result || {}
        try {
            var gr = new GlideRecord(this.registry.TABLE_TRANSACTION)
            if (!gr.isValid() || !gr.get(String(transactionId))) {
                return false
            }
            gr.setValue('state', outcome.state || 'success')
            if (outcome.http_status !== undefined && outcome.http_status !== null) {
                gr.setValue('http_status', outcome.http_status)
            }
            if (outcome.duration_ms !== undefined && outcome.duration_ms !== null) {
                gr.setValue('duration_ms', outcome.duration_ms)
            }
            if (outcome.response !== undefined) {
                gr.setValue('response_summary', this.summarize(outcome.response))
            }
            if (outcome.error) {
                gr.setValue('error_message', this.json.truncate(String(outcome.error), 1000))
            }
            if (outcome.retry_count !== undefined && outcome.retry_count !== null) {
                gr.setValue('retry_count', outcome.retry_count)
            }
            if (outcome.next_retry) {
                gr.setValue('next_retry', outcome.next_retry)
            }
            gr.update()
            return true
        } catch (e) {
            this.log.warn('Unable to close transaction record', { error: String(e), transaction: transactionId })
            return false
        }
    },

    summarize: function (payload) {
        if (payload === undefined || payload === null) {
            return ''
        }
        var extraKeys = this.registry.getString(this.registry.PROP_REDACT_KEYS, '')
        return this.json.forLog(payload, 8000, extraKeys)
    },

    type: 'SecOpsTransactionLogger',
}
