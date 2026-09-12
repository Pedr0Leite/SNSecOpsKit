import '@servicenow/sdk/global'
import {
    Table,
    StringColumn,
    BooleanColumn,
    ChoiceColumn,
    ReferenceColumn,
    IntegerColumn,
    DateTimeColumn,
    MultiLineTextColumn,
    UrlColumn,
} from '@servicenow/sdk/core'

/**
 * A third-party security system the framework can talk to (SIEM, EDR, TI, SOAR, scanner, sandbox).
 * Credentials are never stored here - they resolve at runtime through the Connection & Credential
 * Alias referenced by `connection_alias`.
 */
export const x_335329_secops_connector = Table({
    name: 'x_335329_secops_connector',
    label: 'SecOps Connector',
    display: 'name',
    audit: true,
    allowWebServiceAccess: true,
    accessibleFrom: 'public',
    actions: { read: true, create: true, update: true, delete: true },
    index: [{ name: 'idx_connector_active', unique: false, element: 'active' }],
    schema: {
        name: StringColumn({ label: 'Name', maxLength: 100, mandatory: true }),
        vendor: StringColumn({ label: 'Vendor', maxLength: 100 }),
        category: ChoiceColumn({
            label: 'Category',
            mandatory: true,
            dropdown: 'dropdown_without_none',
            default: 'threat_intel',
            choices: {
                siem: 'SIEM',
                edr: 'EDR / XDR',
                threat_intel: 'Threat Intelligence',
                soar: 'SOAR',
                scanner: 'Vulnerability Scanner',
                sandbox: 'Malware Sandbox',
                firewall: 'Firewall / NAC',
                other: 'Other',
            },
        }),
        active: BooleanColumn({ label: 'Active', default: false }),
        base_url: UrlColumn({ label: 'Base URL' }),
        connection_alias: ReferenceColumn({
            label: 'Connection & Credential Alias',
            referenceTable: 'sys_alias',
            cascadeRule: 'restrict',
        }),
        auth_type: ChoiceColumn({
            label: 'Authentication type',
            mandatory: true,
            dropdown: 'dropdown_without_none',
            default: 'alias',
            choices: {
                alias: 'Connection & Credential Alias (recommended)',
                basic: 'Basic authentication profile',
                oauth2: 'OAuth 2.0 profile',
                none: 'None (anonymous)',
            },
        }),
        auth_profile_id: StringColumn({ label: 'Authentication profile sys_id', maxLength: 32 }),
        mid_server: ReferenceColumn({ label: 'MID Server', referenceTable: 'ecc_agent' }),
        http_timeout_ms: IntegerColumn({ label: 'HTTP timeout (ms)', default: 30000, min: 1000, max: 180000 }),
        max_retries: IntegerColumn({ label: 'Max immediate retries', default: 2, min: 0, max: 5 }),
        health_endpoint_path: StringColumn({ label: 'Health check path', maxLength: 512 }),
        health_status: ChoiceColumn({
            label: 'Health status',
            readOnly: true,
            default: 'unknown',
            dropdown: 'dropdown_without_none',
            choices: {
                unknown: 'Unknown',
                healthy: 'Healthy',
                degraded: 'Degraded',
                down: 'Down',
            },
        }),
        last_health_check: DateTimeColumn({ label: 'Last health check', readOnly: true }),
        last_health_message: StringColumn({ label: 'Last health message', maxLength: 1000, readOnly: true }),
        description: MultiLineTextColumn({ label: 'Description', maxLength: 4000 }),
    },
})
