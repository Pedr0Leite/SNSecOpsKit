export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export type Scope = 'me' | 'team' | 'all'

export type SourceKey = 'sir' | 'findings'

export interface WorkRow {
    sys_id: string
    table: string
    kind: 'incident' | 'task' | 'finding'
    number: string | null
    title: string
    severity: Severity
    state: string | null
    assigned_to: string | null
    assignment_group: string | null
    mine: boolean
    my_team: boolean
    opened: string | null
    dwell_hours: number | null
    source?: string | null
    ci?: string | null
}

export interface WorkSummary {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
    mine: number
    unassigned: number
}

export interface WorkResponse {
    ok: boolean
    rows: WorkRow[]
    summary: WorkSummary
    total: number
    truncated: boolean
    scope: Scope
    user: { name: string; sys_id: string }
}

export type Health = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface Connector {
    sys_id: string
    name: string
    vendor: string | null
    category: string | null
    active: boolean
    health_status: Health
    last_health_check: string | null
    last_health_message: string | null
}

export interface ConnectorResponse {
    ok: boolean
    connectors: Connector[]
    summary: Record<string, number>
}

export interface WorkQuery {
    scope: Scope
    sources: SourceKey[]
    severities: Severity[]
    search: string
}
