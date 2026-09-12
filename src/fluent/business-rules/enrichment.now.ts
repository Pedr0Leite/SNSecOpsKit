import '@servicenow/sdk/global'
import { BusinessRule } from '@servicenow/sdk/core'

/**
 * Automatic enrichment triggers.
 *
 * Both rules ship INACTIVE and are additionally gated by x_335329_secops.enrichment.auto_enabled.
 * Two independent switches is deliberate: enabling automation that spends a customer's third-party
 * API quota should never happen as a side effect of installing an application.
 *
 * They also run `async` so an outbound HTTP call never sits inside the analyst's transaction.
 */

export const enrichOnObservableLink = BusinessRule({
    $id: Now.ID['br-enrich-on-observable-link'],
    name: 'SecOps Universal - Enrich observable on link to incident',
    table: 'sn_ti_m2m_task_observable',
    when: 'async',
    action: ['insert'],
    active: false,
    order: 1000,
    description:
        'Template: enriches an observable through the configured threat intelligence connectors when it is attached to a security incident. Inactive by default.',
    script: Now.include('../../business-rules/enrich-on-observable-link.js'),
})

export const enrichOnObservableFindingChange = BusinessRule({
    $id: Now.ID['br-enrich-on-observable-finding-change'],
    name: 'SecOps Universal - Re-enrich observable on finding reset',
    table: 'sn_ti_observable',
    when: 'async',
    action: ['update'],
    active: false,
    order: 1000,
    filterCondition: 'findingCHANGES',
    description:
        'Template: re-runs enrichment when an analyst resets an observable finding to Unknown. Inactive by default.',
    script: Now.include('../../business-rules/enrich-on-observable-finding-change.js'),
})
