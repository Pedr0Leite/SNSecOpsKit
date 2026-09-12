import '@servicenow/sdk/global'
import { ScheduledScript } from '@servicenow/sdk/core'

/**
 * Background maintenance.
 *
 * The health sweep is active on install because it only touches connectors an administrator has
 * already activated (there are none at install time, so it is a no-op until the app is configured).
 */

export const connectorHealthSweep = ScheduledScript({
    $id: Now.ID['job-connector-health-sweep'],
    name: 'SecOps Universal - Connector health sweep',
    active: true,
    frequency: 'periodically',
    executionInterval: { hours: 1 },
    script: Now.include('../../jobs/connector-health-sweep.js'),
})

export const transactionCleanup = ScheduledScript({
    $id: Now.ID['job-transaction-cleanup'],
    name: 'SecOps Universal - Transaction log cleanup',
    active: true,
    frequency: 'daily',
    executionTime: { hours: 2, minutes: 15, seconds: 0 },
    script: Now.include('../../jobs/transaction-cleanup.js'),
})

export const expireDeferredRetries = ScheduledScript({
    $id: Now.ID['job-expire-deferred-retries'],
    name: 'SecOps Universal - Expire deferred retries',
    active: true,
    frequency: 'periodically',
    executionInterval: { minutes: 15 },
    script: Now.include('../../jobs/expire-deferred-retries.js'),
})
