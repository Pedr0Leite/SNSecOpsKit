/**
 * Scheduled job - trim the connector transaction log.
 *
 * The log grows with every outbound call, so an unbounded table is a real problem on a busy SOC.
 * Retention is configurable; deletion is capped per run so the job cannot hold a long transaction.
 */
;(function cleanUpTransactions() {
    var registry = new SecOpsRegistry()
    var log = new SecOpsLog('TransactionCleanup')

    var retentionDays = registry.getInt(registry.PROP_RETENTION_DAYS, 30)
    if (retentionDays <= 0) {
        log.info('Transaction cleanup disabled (retention is zero or negative)')
        return
    }

    var MAX_PER_RUN = 5000

    try {
        var cutoff = new GlideDateTime()
        cutoff.addSeconds(-1 * retentionDays * 86400)

        var gr = new GlideRecord(registry.TABLE_TRANSACTION)
        if (!gr.isValid()) {
            return
        }
        gr.addQuery('sys_created_on', '<', cutoff.getValue())
        // Never delete a transaction that is still waiting to be retried.
        gr.addQuery('state', '!=', 'retry_pending')
        gr.setLimit(MAX_PER_RUN)
        gr.query()

        var deleted = 0
        var examined = 0
        while (gr.next()) {
            examined++
            if (gr.deleteRecord()) {
                deleted++
            }
        }

        // `capped` must come from rows EXAMINED, not rows deleted. Deriving it from successful
        // deletes would report a drained backlog whenever a delete was refused - hiding the one
        // signal that matters, since this job is the only thing bounding the table.
        log.info('Transaction cleanup finished', {
            deleted: deleted,
            examined: examined,
            refused: examined - deleted,
            retention_days: retentionDays,
            capped: examined === MAX_PER_RUN,
        })
    } catch (e) {
        log.error('Transaction cleanup failed', { error: String(e) })
    }
})()
