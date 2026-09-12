import '@servicenow/sdk/global'
import {
    Table,
    StringColumn,
    BooleanColumn,
    ChoiceColumn,
    ReferenceColumn,
    IntegerColumn,
    TableNameColumn,
} from '@servicenow/sdk/core'

/**
 * Declarative mapping rules: pull `source_path` out of the third-party JSON response and write it
 * to `target_field` on `target_table`. Target table/field are data, not code, so the framework
 * adapts to SecOps schema differences between releases without a new app version.
 */
export const x_335329_secops_field_map = Table({
    name: 'x_335329_secops_field_map',
    label: 'SecOps Field Mapping',
    display: 'source_path',
    audit: true,
    accessibleFrom: 'public',
    actions: { read: true, create: true, update: true, delete: true },
    index: [{ name: 'idx_map_endpoint', unique: false, element: 'endpoint' }],
    schema: {
        endpoint: ReferenceColumn({
            label: 'Endpoint',
            referenceTable: 'x_335329_secops_endpoints',
            mandatory: true,
            cascadeRule: 'delete',
        }),
        source_path: StringColumn({
            label: 'Source JSON path',
            maxLength: 512,
            mandatory: true,
        }),
        target_table: TableNameColumn({ label: 'Target table' }),
        target_field: StringColumn({ label: 'Target field', maxLength: 100, mandatory: true }),
        transform: ChoiceColumn({
            label: 'Transform',
            dropdown: 'dropdown_without_none',
            default: 'none',
            choices: {
                none: 'None',
                trim: 'Trim whitespace',
                lower: 'Lower case',
                upper: 'Upper case',
                number: 'To number',
                boolean: 'To boolean',
                json: 'Serialize to JSON',
                iso_date: 'ISO 8601 to GlideDateTime',
            },
        }),
        default_value: StringColumn({ label: 'Default value', maxLength: 1000 }),
        mandatory: BooleanColumn({ label: 'Mandatory', default: false }),
        order: IntegerColumn({ label: 'Order', default: 100 }),
    },
})
