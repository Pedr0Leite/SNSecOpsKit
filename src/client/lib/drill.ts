/**
 * Drill-in: the records behind a number.
 *
 * Runs through the platform Table API as the SIGNED-IN USER, so it is ACL-filtered. The counts on
 * the charts are not - they are true organisation-wide totals from GlideAggregate.
 *
 * Those two facts are both correct and will legitimately disagree for a restricted viewer. That is
 * the point of `visible` vs `total`: the UI states the difference out loud instead of leaving a
 * dashboard that appears to contradict itself.
 */

export interface DrillDatum {
    key: string
    label: string
    count: number
    table: string
    query: string | null
}

export interface DrillRow {
    sys_id: string
    primary: string
    secondary: string
    tertiary: string
}

export interface DrillResult {
    rows: DrillRow[]
    visible: number
    total: number
    table: string
    query: string
}

const MAX_ROWS = 50

/** Fields worth showing per table, most identifying first. */
function fieldsFor(table: string): { fields: string[]; primary: string; secondary: string; tertiary: string } {
    if (table.startsWith('sn_si_')) {
        return {
            fields: ['sys_id', 'number', 'short_description', 'state', 'assigned_to', 'opened_at'],
            primary: 'number',
            secondary: 'short_description',
            tertiary: 'state',
        }
    }
    if (table.endsWith('_vuln_stage')) {
        return {
            fields: ['sys_id', 'cve', 'title', 'severity', 'ci_identifier', 'source'],
            primary: 'cve',
            secondary: 'title',
            tertiary: 'ci_identifier',
        }
    }
    if (table.endsWith('_transaction')) {
        return {
            fields: ['sys_id', 'correlation_id', 'capability', 'state', 'http_status', 'error_message'],
            primary: 'capability',
            secondary: 'error_message',
            tertiary: 'state',
        }
    }
    if (table.endsWith('_connector')) {
        return {
            fields: ['sys_id', 'name', 'vendor', 'health_status', 'last_health_message'],
            primary: 'name',
            secondary: 'last_health_message',
            tertiary: 'health_status',
        }
    }
    return { fields: ['sys_id'], primary: 'sys_id', secondary: '', tertiary: '' }
}

function displayOf(record: Record<string, unknown>, field: string): string {
    if (!field) return ''
    const value = record[field]
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
        const ref = value as { display_value?: string; value?: string }
        return ref.display_value || ref.value || ''
    }
    return String(value)
}

export async function fetchDrill(datum: DrillDatum, signal?: AbortSignal): Promise<DrillResult> {
    // null means the grouping value could not be expressed as a safe query. An EMPTY query is
    // valid and means "the whole table", which is what a headline total drills into.
    if (datum.query === null || datum.query === undefined) {
        throw new Error('This value cannot be drilled into — its grouping key contains a character that is not safe in a query.')
    }

    const spec = fieldsFor(datum.table)
    const params = new URLSearchParams({
        sysparm_query: datum.query,
        sysparm_fields: spec.fields.join(','),
        sysparm_display_value: 'all',
        sysparm_limit: String(MAX_ROWS),
    })

    const response = await fetch(`/api/now/table/${encodeURIComponent(datum.table)}?${params}`, {
        headers: { Accept: 'application/json', 'X-UserToken': window.g_ck },
        signal,
    })

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('You do not have access to these records.')
        }
        throw new Error(`Could not load these records (HTTP ${response.status}).`)
    }

    // The platform reports the ACL-filtered match count in this header; the body is capped.
    const headerCount = Number(response.headers.get('X-Total-Count'))
    const { result } = await response.json()
    const records = (result || []) as Array<Record<string, unknown>>

    return {
        rows: records.map((record) => ({
            sys_id: displayOf(record, 'sys_id'),
            primary: displayOf(record, spec.primary),
            secondary: displayOf(record, spec.secondary),
            tertiary: displayOf(record, spec.tertiary),
        })),
        visible: Number.isFinite(headerCount) ? headerCount : records.length,
        total: datum.count,
        table: datum.table,
        query: datum.query,
    }
}

/** The platform list view for this query — everything the drill-in deliberately cannot do. */
export function listUrl(table: string, query: string): string {
    return `/${encodeURIComponent(table)}_list.do?sysparm_query=${encodeURIComponent(query)}`
}
