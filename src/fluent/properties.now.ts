import '@servicenow/sdk/global'
import { Property } from '@servicenow/sdk/core'
import { secopsAdminRole } from './security/roles.now'

/**
 * Runtime configuration.
 *
 * NOTE: no credential is ever stored in a system property. Secrets live in Connection & Credential
 * Aliases and are resolved at call time by sn_cc.ConnectionInfoProvider. Properties here are
 * limited to non-sensitive operational tuning.
 */

export const logLevel = Property({
    $id: Now.ID['prop-log-level'],
    name: 'x_335329_secops.log.level',
    type: 'choicelist',
    value: 'warn',
    choices: ['debug', 'info', 'warn', 'error'],
    description: 'Verbosity of SecOps Universal Connector logging (consumed by GSLog).',
    roles: { write: [secopsAdminRole] },
})

export const httpTimeout = Property({
    $id: Now.ID['prop-http-timeout'],
    name: 'x_335329_secops.http.timeout_ms',
    type: 'integer',
    value: 30000,
    description: 'Default outbound HTTP timeout in milliseconds. A connector record can override this.',
    roles: { write: [secopsAdminRole] },
})

export const httpMaxRetries = Property({
    $id: Now.ID['prop-http-max-retries'],
    name: 'x_335329_secops.http.max_retries',
    type: 'integer',
    value: 2,
    description: 'Default number of immediate retries for transient failures. A connector record can override this.',
    roles: { write: [secopsAdminRole] },
})

export const logRetentionDays = Property({
    $id: Now.ID['prop-log-retention-days'],
    name: 'x_335329_secops.log.retention_days',
    type: 'integer',
    value: 30,
    description: 'Days to keep connector transaction records before the cleanup job removes them.',
    roles: { write: [secopsAdminRole] },
})

export const redactExtraKeys = Property({
    $id: Now.ID['prop-redact-extra-keys'],
    name: 'x_335329_secops.redact.extra_keys',
    type: 'string',
    value: '',
    description:
        'Comma-separated extra payload keys to redact from logs, in addition to the built-in credential key list.',
    roles: { write: [secopsAdminRole] },
})

export const ingestMaxRecords = Property({
    $id: Now.ID['prop-ingest-max-records'],
    name: 'x_335329_secops.ingest.max_records',
    type: 'integer',
    value: 500,
    description: 'Maximum records accepted from a single ingestion payload. Protects against an oversized feed.',
    roles: { write: [secopsAdminRole] },
})

export const detonateMaxIndicators = Property({
    $id: Now.ID['prop-detonate-max-indicators'],
    name: 'x_335329_secops.detonate.max_indicators',
    type: 'integer',
    value: 15,
    description:
        'Maximum indicators detonated per security incident. Each one is a synchronous outbound call, so keep this small - raising it risks exhausting the transaction quota and leaving an incident half-processed.',
    roles: { write: [secopsAdminRole] },
})

export const autoEnrichmentEnabled = Property({
    $id: Now.ID['prop-auto-enrichment'],
    name: 'x_335329_secops.enrichment.auto_enabled',
    type: 'boolean',
    value: false,
    description:
        'Allow the observable business rules to enrich automatically. Off by default - automatic enrichment consumes third-party API quota.',
    roles: { write: [secopsAdminRole] },
})

export const vrPromotionEnabled = Property({
    $id: Now.ID['prop-vr-promotion'],
    name: 'x_335329_secops.vr.promotion_enabled',
    type: 'boolean',
    value: false,
    description:
        'Allow staged vulnerability telemetry to be promoted into Vulnerability Response. Requires the VR subscription.',
    roles: { write: [secopsAdminRole] },
})

export const vrEntryTable = Property({
    $id: Now.ID['prop-vr-entry-table'],
    name: 'x_335329_secops.vr.entry_table',
    type: 'string',
    value: 'sn_vul_third_party_entry',
    description:
        'Vulnerability Response table that receives the vulnerability definition. Note sn_vul_vulnerability is Remediation Tasks, not vulnerabilities.',
    roles: { write: [secopsAdminRole] },
})

export const vrItemTable = Property({
    $id: Now.ID['prop-vr-item-table'],
    name: 'x_335329_secops.vr.item_table',
    type: 'string',
    value: 'sn_vul_vulnerable_item',
    description: 'Vulnerability Response table that receives the per-CI occurrence (the vulnerable item).',
    roles: { write: [secopsAdminRole] },
})
