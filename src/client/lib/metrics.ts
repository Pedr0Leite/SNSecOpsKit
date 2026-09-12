/** A number plus the table and query that produced it, so the UI can drill into it. */
export interface CountDatum {
    key: string
    label: string
    count: number
    table: string
    query: string | null
}

export interface IncidentMetrics {
    available: boolean
    table: string
    open: number
    open_query: string
    by_severity: CountDatum[]
    by_state: CountDatum[]
    by_group: CountDatum[]
    aging: CountDatum[]
    trend: { labels: string[]; opened: number[]; ok: number[]; failed: number[]; truncated: boolean }
}

export interface FindingMetrics {
    table: string
    total: number
    by_severity: CountDatum[]
    by_state: CountDatum[]
    by_source: CountDatum[]
    top_ci: CountDatum[]
    unmatched_ci: number
    unmatched_ci_query: string
}

export interface IntegrationMetrics {
    table: string
    connector_table: string
    connectors: CountDatum[]
    connector_totals: Record<'total' | 'healthy' | 'degraded' | 'down' | 'unknown' | 'inactive', number>
    outcomes: CountDatum[]
    transactions: {
        total: number
        success: number
        failed: number
        retry_pending: number
        success_rate: number | null
        avg_duration_ms: number | null
    }
    by_capability: CountDatum[]
    trend: { labels: string[]; opened: number[]; ok: number[]; failed: number[]; truncated: boolean }
}

export interface Overview {
    generated: string
    incidents: IncidentMetrics
    findings: FindingMetrics
    integration: IntegrationMetrics
}

export interface OverviewResponse {
    metrics: Overview
    user: { name: string; sys_id: string }
}

export async function fetchOverview(signal?: AbortSignal): Promise<OverviewResponse> {
    const response = await fetch('/api/x_335329_secops/secops_console/overview', {
        headers: { Accept: 'application/json', 'X-UserToken': window.g_ck },
        signal,
    })

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('You do not have access to the security overview. You need a SecOps connector role.')
        }
        throw new Error(`Could not load the overview (HTTP ${response.status}).`)
    }

    const payload = await response.json()
    const body = payload?.result ?? payload
    if (!body?.ok) {
        throw new Error(body?.error || 'The overview could not be built.')
    }
    return { metrics: body.metrics as Overview, user: body.user }
}
