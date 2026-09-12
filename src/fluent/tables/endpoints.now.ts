import '@servicenow/sdk/global'
import {
    Table,
    StringColumn,
    BooleanColumn,
    ChoiceColumn,
    ReferenceColumn,
    IntegerColumn,
    MultiLineTextColumn,
} from '@servicenow/sdk/core'

/**
 * One callable operation on a connector. The `capability` decides which handler drives it, so a
 * new third-party tool is onboarded by adding records here - not by writing code.
 */
export const x_335329_secops_endpoints = Table({
    name: 'x_335329_secops_endpoints',
    label: 'SecOps Connector Endpoint',
    display: 'name',
    audit: true,
    allowWebServiceAccess: true,
    accessibleFrom: 'public',
    actions: { read: true, create: true, update: true, delete: true },
    index: [{ name: 'idx_endpoint_capability', unique: false, element: ['connector', 'capability'] }],
    schema: {
        name: StringColumn({ label: 'Name', maxLength: 100, mandatory: true }),
        connector: ReferenceColumn({
            label: 'Connector',
            referenceTable: 'x_335329_secops_connector',
            mandatory: true,
            cascadeRule: 'delete',
        }),
        capability: ChoiceColumn({
            label: 'Capability',
            mandatory: true,
            dropdown: 'dropdown_without_none',
            default: 'enrich',
            choices: {
                enrich: 'Threat intel enrichment',
                detonate: 'Sandbox detonation (phishing)',
                contain: 'Containment / isolation',
                ingest: 'Vulnerability telemetry ingestion',
                health: 'Health check',
                custom: 'Custom',
            },
        }),
        active: BooleanColumn({ label: 'Active', default: false }),
        http_method: ChoiceColumn({
            label: 'HTTP method',
            mandatory: true,
            dropdown: 'dropdown_without_none',
            default: 'post',
            choices: {
                get: 'GET',
                post: 'POST',
                put: 'PUT',
                patch: 'PATCH',
                delete: 'DELETE',
            },
        }),
        path: StringColumn({
            label: 'Path or absolute URL',
            maxLength: 1024,
            mandatory: true,
        }),
        request_template: MultiLineTextColumn({
            label: 'Request body template',
            maxLength: 8000,
        }),
        request_headers: MultiLineTextColumn({
            label: 'Additional request headers (JSON object)',
            maxLength: 4000,
        }),
        response_root: StringColumn({
            label: 'Response root path',
            maxLength: 255,
        }),
        success_codes: StringColumn({
            label: 'Success HTTP codes',
            maxLength: 100,
            default: '200,201,202,204',
        }),
        order: IntegerColumn({ label: 'Order', default: 100 }),
        description: MultiLineTextColumn({ label: 'Description', maxLength: 4000 }),
    },
})
