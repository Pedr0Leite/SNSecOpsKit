import '@servicenow/sdk/global'
import {
    Table,
    StringColumn,
    ChoiceColumn,
    ReferenceColumn,
    IntegerColumn,
    DateTimeColumn,
    MultiLineTextColumn,
    TableNameColumn,
} from '@servicenow/sdk/core'

/**
 * Execution log for every outbound call and inbound ingestion. Request and response bodies are
 * redacted before they are written here - see SecOpsJson.redact.
 */
export const x_335329_secops_transaction = Table({
    name: 'x_335329_secops_transaction',
    label: 'SecOps Connector Transaction',
    display: 'correlation_id',
    audit: false,
    allowWebServiceAccess: true,
    accessibleFrom: 'public',
    actions: { read: true, create: true, update: true, delete: true },
    index: [
        { name: 'idx_txn_state', unique: false, element: 'state' },
        { name: 'idx_txn_correlation', unique: false, element: 'correlation_id' },
    ],
    schema: {
        correlation_id: StringColumn({ label: 'Correlation ID', maxLength: 64, readOnly: true }),
        connector: ReferenceColumn({
            label: 'Connector',
            referenceTable: 'x_335329_secops_connector',
            cascadeRule: 'none',
        }),
        endpoint: ReferenceColumn({
            label: 'Endpoint',
            referenceTable: 'x_335329_secops_endpoints',
            cascadeRule: 'none',
        }),
        capability: StringColumn({ label: 'Capability', maxLength: 40, readOnly: true }),
        state: ChoiceColumn({
            label: 'State',
            dropdown: 'dropdown_without_none',
            default: 'pending',
            choices: {
                pending: 'Pending',
                success: 'Success',
                failed: 'Failed',
                retry_pending: 'Retry pending',
                skipped: 'Skipped',
            },
        }),
        http_status: IntegerColumn({ label: 'HTTP status', readOnly: true }),
        duration_ms: IntegerColumn({ label: 'Duration (ms)', readOnly: true }),
        source_table: TableNameColumn({ label: 'Source table' }),
        source_record: StringColumn({ label: 'Source record sys_id', maxLength: 32 }),
        request_summary: MultiLineTextColumn({ label: 'Request (redacted)', maxLength: 8000, readOnly: true }),
        response_summary: MultiLineTextColumn({ label: 'Response (redacted)', maxLength: 8000, readOnly: true }),
        error_message: StringColumn({ label: 'Error message', maxLength: 1000, readOnly: true }),
        retry_count: IntegerColumn({ label: 'Retry count', default: 0 }),
        next_retry: DateTimeColumn({ label: 'Next retry' }),
    },
})
