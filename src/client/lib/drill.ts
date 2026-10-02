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

/** One record's field values, keyed by field name. Column choice decides which of these render. */
export interface DrillRow {
    sys_id: string
    values: Record<string, string>
}

export interface DrillResult {
    rows: DrillRow[]
    visible: number
    total: number
    table: string
    query: string
    /** Every field available to show as a column, most identifying first. */
    columns: string[]
    /** Human-readable label per field in `columns`. */
    labels: Record<string, string>
    /** Sane starting column set — what the pane shows before a user customises it. */
    defaultColumns: string[]
}

const MAX_ROWS = 50

/** Fields worth showing per table, most identifying first. Same list is fetched and offered as columns. */
function fieldsFor(table: string): { fields: string[]; labels: Record<string, string>; defaultColumns: string[] } {
    if (table.startsWith('sn_si_')) {
        return {
            fields: ['number', 'short_description', 'state', 'priority', 'assigned_to', 'opened_at'],
            labels: {
                number: 'Number',
                short_description: 'Short description',
                state: 'State',
                priority: 'Priority',
                assigned_to: 'Assigned to',
                opened_at: 'Opened',
            },
            defaultColumns: ['number', 'short_description', 'state'],
        }
    }
    if (table.endsWith('_vuln_stage')) {
        return {
            fields: ['cve', 'title', 'severity', 'ci_identifier', 'source', 'first_seen'],
            labels: {
                cve: 'CVE',
                title: 'Title',
                severity: 'Severity',
                ci_identifier: 'CI',
                source: 'Source',
                first_seen: 'First seen',
            },
            defaultColumns: ['cve', 'title', 'ci_identifier'],
        }
    }
    if (table.endsWith('_transaction')) {
        return {
            fields: ['correlation_id', 'capability', 'state', 'http_status', 'error_message', 'duration_ms'],
            labels: {
                correlation_id: 'Correlation ID',
                capability: 'Capability',
                state: 'State',
                http_status: 'HTTP status',
                error_message: 'Error',
                duration_ms: 'Duration (ms)',
            },
            defaultColumns: ['capability', 'error_message', 'state'],
        }
    }
    if (table.endsWith('_connector')) {
        return {
            fields: ['name', 'vendor', 'health_status', 'last_health_message', 'active'],
            labels: {
                name: 'Name',
                vendor: 'Vendor',
                health_status: 'Health',
                last_health_message: 'Last message',
                active: 'Active',
            },
            defaultColumns: ['name', 'last_health_message', 'health_status'],
        }
    }
    return { fields: ['sys_id'], labels: { sys_id: 'ID' }, defaultColumns: ['sys_id'] }
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
        sysparm_fields: ['sys_id', ...spec.fields].join(','),
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
            values: Object.fromEntries(spec.fields.map((field) => [field, displayOf(record, field)])),
        })),
        visible: Number.isFinite(headerCount) ? headerCount : records.length,
        total: datum.count,
        table: datum.table,
        query: datum.query,
        columns: spec.fields,
        labels: spec.labels,
        defaultColumns: spec.defaultColumns,
    }
}

const COLUMN_PREF_PREFIX = 'secops.drill.columns.'

/** Per-viewer column choice for one table's drill list. Falls back silently — this is a display convenience, not state that must persist. */
export function loadColumnPrefs(table: string, fallback: string[]): string[] {
    try {
        const raw = window.localStorage.getItem(COLUMN_PREF_PREFIX + table)
        if (!raw) return fallback
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : fallback
    } catch {
        return fallback
    }
}

export function saveColumnPrefs(table: string, columns: string[]): void {
    try {
        window.localStorage.setItem(COLUMN_PREF_PREFIX + table, JSON.stringify(columns))
    } catch {
        // Private browsing / storage disabled — the picker still works for this session.
    }
}

/** The platform list view for this query — everything the drill-in deliberately cannot do. */
export function listUrl(table: string, query: string): string {
    return `/${encodeURIComponent(table)}_list.do?sysparm_query=${encodeURIComponent(query)}`
}
