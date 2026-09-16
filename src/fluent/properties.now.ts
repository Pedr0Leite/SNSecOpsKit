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

// --- ServiceNow CVE watch ---------------------------------------------------

export const cveWatchEnabled = Property({
    $id: Now.ID["prop-cve-enabled"],
    name: "x_335329_secops.cve.enabled",
    type: "boolean",
    value: true,
    description:
        "Run the daily ServiceNow CVE sweep. Turning this off stops all outbound calls to the CVE services.",
    roles: { write: [secopsAdminRole] },
})

export const cveCreateIncidents = Property({
    $id: Now.ID["prop-cve-create-incidents"],
    name: "x_335329_secops.cve.create_incidents",
    type: "boolean",
    value: true,
    description:
        "Raise a Security Incident for each CVE that affects this instance, and for each one whose version match is uncertain. Turn off to keep the tracking table only.",
    roles: { write: [secopsAdminRole] },
})

export const cveBackfillMonths = Property({
    $id: Now.ID["prop-cve-backfill-months"],
    name: "x_335329_secops.cve.backfill_months",
    type: "integer",
    value: 6,
    description:
        "How far back the FIRST run looks. Later runs only fetch what changed since the last successful sweep. Clear x_335329_secops.cve.last_run to force another backfill.",
    roles: { write: [secopsAdminRole] },
})

export const cveKeyword = Property({
    $id: Now.ID["prop-cve-keyword"],
    name: "x_335329_secops.cve.keyword",
    type: "string",
    value: "ServiceNow",
    description: "Keyword searched at NVD. Every ServiceNow CVE to date is published by the vendor CNA and matches this.",
    roles: { write: [secopsAdminRole] },
})

export const cveConnector = Property({
    $id: Now.ID["prop-cve-connector"],
    name: "x_335329_secops.cve.connector",
    type: "string",
    value: "CVE Program (NVD + CVE Services)",
    description:
        "Name of the connector used to reach the CVE services. Point this at a different connector to route through a MID Server or a proxy.",
    roles: { write: [secopsAdminRole] },
})

export const cveIncidentTable = Property({
    $id: Now.ID["prop-cve-incident-table"],
    name: "x_335329_secops.cve.incident_table",
    type: "string",
    value: "sn_si_incident",
    description:
        "Table that receives the Security Incident. If Security Incident Response is absent the CVE is still tracked, without an incident.",
    roles: { write: [secopsAdminRole] },
})

export const cveWatermark = Property({
    $id: Now.ID["prop-cve-watermark"],
    name: "x_335329_secops.cve.last_run",
    type: "string",
    value: "",
    description:
        "Internal watermark: the end of the last SUCCESSFUL sweep. It only advances when a sweep completes without errors, so a failed window is retried rather than skipped. Clear it to force a full backfill.",
    roles: { write: [secopsAdminRole] },
})
