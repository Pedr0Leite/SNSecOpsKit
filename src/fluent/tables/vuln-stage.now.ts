import '@servicenow/sdk/global'
import {
    Table,
    StringColumn,
    ChoiceColumn,
    ReferenceColumn,
    DateTimeColumn,
    MultiLineTextColumn,
    DecimalColumn,
} from '@servicenow/sdk/core'

/**
 * Staging table for third-party vulnerability telemetry.
 *
 * Inbound data always lands here first - the framework never writes straight into Vulnerability
 * Response. A separate, opt-in promotion step copies staged rows into VR (sn_vul_third_party_entry
 * / sn_vul_vulnerable_item) only when VR is actually installed on the instance. That keeps the app
 * installable on instances without VR and keeps ingestion auditable.
 */
export const x_335329_secops_vuln_stage = Table({
    name: 'x_335329_secops_vuln_stage',
    label: 'SecOps Vulnerability Staging',
    display: 'external_id',
    audit: false,
    allowWebServiceAccess: true,
    accessibleFrom: 'public',
    actions: { read: true, create: true, update: true, delete: true },
    index: [
        { name: 'idx_stage_state', unique: false, element: 'state' },
        { name: 'idx_stage_external', unique: false, element: ['source', 'external_id'] },
    ],
    schema: {
        source: StringColumn({ label: 'Source', maxLength: 100, mandatory: true }),
        external_id: StringColumn({ label: 'External ID', maxLength: 255, mandatory: true }),
        cve: StringColumn({ label: 'CVE / Vulnerability ID', maxLength: 100 }),
        title: StringColumn({ label: 'Title', maxLength: 255 }),
        severity: ChoiceColumn({
            label: 'Severity',
            dropdown: 'dropdown_without_none',
            default: 'unknown',
            choices: {
                critical: 'Critical',
                high: 'High',
                medium: 'Medium',
                low: 'Low',
                informational: 'Informational',
                unknown: 'Unknown',
            },
        }),
        cvss_score: DecimalColumn({ label: 'CVSS score' }),
        ci_identifier: StringColumn({ label: 'CI identifier (raw)', maxLength: 255 }),
        ci: ReferenceColumn({ label: 'Configuration item', referenceTable: 'cmdb_ci', cascadeRule: 'none' }),
        raw_payload: MultiLineTextColumn({ label: 'Raw payload (redacted)', maxLength: 32000 }),
        state: ChoiceColumn({
            label: 'State',
            dropdown: 'dropdown_without_none',
            default: 'new',
            choices: {
                new: 'New',
                mapped: 'Mapped',
                promoted: 'Promoted to VR',
                error: 'Error',
                skipped: 'Skipped',
            },
        }),
        promotion_message: StringColumn({ label: 'Promotion message', maxLength: 1000 }),
        transaction: ReferenceColumn({
            label: 'Transaction',
            referenceTable: 'x_335329_secops_transaction',
            cascadeRule: 'none',
        }),
        first_seen: DateTimeColumn({ label: 'First seen' }),
        last_seen: DateTimeColumn({ label: 'Last seen' }),
    },
})
