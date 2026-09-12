/**
 * Record read/write for the detail pane.
 *
 * These calls go straight to the platform Table API under the SIGNED-IN USER's session, not
 * through this application's scoped API. That is deliberate:
 *
 *   - the console never acts with elevated rights, so it can never become a privilege-escalation
 *     path into Security Incident Response;
 *   - ACLs and data policies apply natively, exactly as they would on the real form;
 *   - editing needs no cross-scope WRITE privilege for this app at all.
 *
 * The trade is that a user who cannot write a field simply gets a 403 - which is the correct
 * answer, and the pane surfaces it rather than pretending the save worked.
 */

export interface FieldValue {
    display_value: string
    value: string
}

export type RecordData = Record<string, FieldValue>

export interface ChoiceOption {
    value: string
    label: string
}

export interface FieldSpec {
    name: string
    label: string
    type: 'text' | 'textarea' | 'choice' | 'readonly'
    choices?: ChoiceOption[]
}

function headers(extra?: HeadersInit): HeadersInit {
    return {
        Accept: 'application/json',
        'X-UserToken': window.g_ck,
        ...(extra || {}),
    }
}

async function failure(response: Response, action: string): Promise<string> {
    if (response.status === 403) {
        return `You do not have permission to ${action} this record.`
    }
    if (response.status === 404) {
        return 'That record no longer exists.'
    }
    try {
        const body = await response.json()
        const detail: string = body?.error?.detail || body?.error?.message || ''
        // A business rule abort is the most common save failure and the message is the useful part.
        if (detail) return detail
    } catch {
        /* fall through */
    }
    return `Could not ${action} the record (HTTP ${response.status}).`
}

export async function fetchRecord(table: string, sysId: string, signal?: AbortSignal): Promise<RecordData> {
    const params = new URLSearchParams({ sysparm_display_value: 'all' })
    const response = await fetch(`/api/now/table/${encodeURIComponent(table)}/${encodeURIComponent(sysId)}?${params}`, {
        headers: headers(),
        signal,
    })

    if (!response.ok) {
        throw new Error(await failure(response, 'read'))
    }
    const { result } = await response.json()
    return result as RecordData
}

export async function saveRecord(table: string, sysId: string, changes: Record<string, string>): Promise<RecordData> {
    const response = await fetch(`/api/now/table/${encodeURIComponent(table)}/${encodeURIComponent(sysId)}`, {
        method: 'PATCH',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(changes),
    })

    if (!response.ok) {
        throw new Error(await failure(response, 'save'))
    }
    const { result } = await response.json()
    return result as RecordData
}

/** Choice options for a field, read from sys_choice. Returns [] when the field is not a choice. */
export async function fetchChoices(table: string, element: string, signal?: AbortSignal): Promise<ChoiceOption[]> {
    const params = new URLSearchParams({
        sysparm_query: `name=${table}^element=${element}^inactive=false^ORDERBYsequence`,
        sysparm_fields: 'value,label',
        sysparm_limit: '60',
    })

    const response = await fetch(`/api/now/table/sys_choice?${params}`, { headers: headers(), signal })
    if (!response.ok) {
        return []
    }

    const { result } = await response.json()
    return (result as ChoiceOption[]).filter((choice) => choice.value !== '')
}

/**
 * Which fields the pane offers per table.
 *
 * Reference fields (assigned_to, assignment_group) are deliberately NOT editable here: a correct
 * reference picker needs typeahead, and SIR additionally validates that the assignee belongs to
 * the assignment group. "Assign to me" covers the action analysts actually take, without pretending
 * to be the full form - the Open record button is there for everything else.
 */
export function editableFields(table: string): FieldSpec[] {
    if (table.startsWith('sn_si_')) {
        return [
            { name: 'short_description', label: 'Short description', type: 'text' },
            { name: 'state', label: 'State', type: 'choice' },
            { name: 'priority', label: 'Priority', type: 'choice' },
            { name: 'severity', label: 'Severity', type: 'choice' },
            { name: 'assigned_to', label: 'Assigned to', type: 'readonly' },
            { name: 'assignment_group', label: 'Assignment group', type: 'readonly' },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'work_notes', label: 'Add a work note', type: 'textarea' },
        ]
    }

    return [
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'state', label: 'State', type: 'choice' },
        { name: 'severity', label: 'Severity', type: 'choice' },
        { name: 'cve', label: 'CVE', type: 'readonly' },
        { name: 'source', label: 'Source', type: 'readonly' },
        { name: 'ci_identifier', label: 'CI identifier', type: 'readonly' },
        { name: 'promotion_message', label: 'Promotion message', type: 'readonly' },
    ]
}
