/**
 * Scheduled job - close out transactions parked for deferred retry.
 *
 * Deliberate scope: this job EXPIRES stale retry_pending transactions, it does not replay them.
 *
 * Replay would require storing the full outbound request, and the only copy this application keeps
 * is redacted precisely so credentials never sit in a table. Replaying from a redacted body would
 * send a broken request; storing an unredacted one to enable replay would be a worse trade. Feeds
 * that matter are pulled on a schedule and recover on their next run; interactive calls are better
 * retried by the analyst who can see the result.
 *
 * Upgrade path if true replay is ever needed: persist a request envelope keyed by transaction with
 * credential material resolved at send time (never stored), then replay through SecOpsRestClient.
 */
;(function expireDeferredRetries() {
    var registry = new SecOpsRegistry()
    var log = new SecOpsLog('ExpireDeferredRetries')

    try {
        var now = new GlideDateTime().getValue()

        var gr = new GlideRecord(registry.TABLE_TRANSACTION)
        if (!gr.isValid()) {
            return
        }
        gr.addQuery('state', 'retry_pending')
        gr.addQuery('next_retry', '<', now)
        gr.setLimit(1000)
        gr.query()

        var expired = 0
        while (gr.next()) {
            gr.setValue('state', 'failed')
            var existing = gr.getValue('error_message') || ''
            gr.setValue(
                'error_message',
                (existing + ' | Deferred retry window elapsed; the third party was still rate limiting or unavailable.').substring(
                    0,
                    1000
                )
            )
            if (gr.update()) {
                expired++
            }
        }

        if (expired > 0) {
            log.warn('Expired deferred retries - a connector is persistently rate limited or down', { expired: expired })
        }
    } catch (e) {
        log.error('Deferred retry expiry failed', { error: String(e) })
    }
})()
