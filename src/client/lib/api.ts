import type { ConnectorResponse, WorkQuery, WorkResponse } from './types'

const BASE = '/api/x_335329_secops/secops_console'

/**
 * Every call carries the session token ServiceNow injects as window.g_ck. Without it the platform
 * rejects the request even though the session cookie is present.
 */
function headers(): HeadersInit {
    return {
        Accept: 'application/json',
        'X-UserToken': window.g_ck,
    }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { method: 'GET', headers: headers(), signal })

    if (!response.ok) {
        throw new Error(await describeFailure(response))
    }

    const payload = await response.json()
    // Scripted REST wraps script output in `result`; a platform-level error does not.
    return (payload?.result ?? payload) as T
}

/** Turns an HTTP failure into something an analyst can act on, not a status code. */
async function describeFailure(response: Response): Promise<string> {
    if (response.status === 401 || response.status === 403) {
        return 'You do not have access to this data. You need a SecOps connector role — ask your administrator.'
    }

    let detail = ''
    try {
        const body = await response.json()
        detail = body?.error?.message || body?.result?.error || ''
    } catch {
        detail = ''
    }

    if (response.status >= 500) {
        return detail || 'The server could not load this. Check the application logs on the instance.'
    }
    return detail || `Request failed (HTTP ${response.status}).`
}

export function fetchWork(query: WorkQuery, signal?: AbortSignal): Promise<WorkResponse> {
    const params = new URLSearchParams()
    params.set('scope', query.scope)
    params.set('limit', '200')
    if (query.sources.length) params.set('sources', query.sources.join(','))
    if (query.severities.length) params.set('severities', query.severities.join(','))
    if (query.search.trim()) params.set('q', query.search.trim())

    return getJson<WorkResponse>(`${BASE}/work?${params.toString()}`, signal)
}

export function fetchConnectors(signal?: AbortSignal): Promise<ConnectorResponse> {
    return getJson<ConnectorResponse>(`${BASE}/connectors`, signal)
}

/** Opens the underlying platform record in a new tab. */
export function recordUrl(table: string, sysId: string): string {
    return `/${encodeURIComponent(table)}.do?sys_id=${encodeURIComponent(sysId)}`
}
