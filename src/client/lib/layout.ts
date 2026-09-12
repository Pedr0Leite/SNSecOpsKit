/**
 * Per-user panel layout for the security overview.
 *
 * Stored in sys_user_preference rather than a table of our own: it is the platform-native place for
 * this, it survives upgrades, and users already write their own preferences constantly, so the ACLs
 * are known-good. Verified working through the Table API.
 *
 * Widths are discrete fractions, not free pixels. That removes collision and compaction maths
 * entirely and keeps the grid tidy no matter what a user does to it.
 */

export type PanelWidth = 'third' | 'half' | 'two-thirds' | 'full'

export const WIDTHS: Array<{ value: PanelWidth; label: string }> = [
    { value: 'third', label: '1/3' },
    { value: 'half', label: '1/2' },
    { value: 'two-thirds', label: '2/3' },
    { value: 'full', label: 'Full' },
]

export interface PanelState {
    id: string
    width: PanelWidth
    hidden: boolean
}

export type Layout = PanelState[]

/** One preference row per page, so the console and the overview never overwrite each other. */
export const OVERVIEW_LAYOUT = 'x_335329_secops.overview.layout'
export const CONSOLE_LAYOUT = 'x_335329_secops.console.layout'

function headers(extra?: HeadersInit): HeadersInit {
    return { Accept: 'application/json', 'X-UserToken': window.g_ck, ...(extra || {}) }
}

/**
 * Merges a stored layout over the panels the app currently defines.
 *
 * Deliberately driven by `defaults`: a panel added in a later release appears for users who already
 * have a saved layout, and a panel that no longer exists is dropped rather than rendering blank.
 */
export function reconcile(defaults: Layout, stored: Layout | null): Layout {
    if (!stored || stored.length === 0) return defaults

    const byId = new Map(stored.map((panel) => [panel.id, panel]))
    const known = new Set(defaults.map((panel) => panel.id))

    const ordered: Layout = []
    stored.forEach((panel) => {
        if (known.has(panel.id)) {
            const fallback = defaults.find((candidate) => candidate.id === panel.id)!
            ordered.push({
                id: panel.id,
                width: panel.width || fallback.width,
                hidden: Boolean(panel.hidden),
            })
        }
    })

    defaults.forEach((panel) => {
        if (!byId.has(panel.id)) ordered.push(panel)
    })

    return ordered
}

export function move(layout: Layout, id: string, direction: -1 | 1): Layout {
    const index = layout.findIndex((panel) => panel.id === id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= layout.length) return layout

    const next = layout.slice()
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    return next
}

export function reorder(layout: Layout, fromId: string, toId: string): Layout {
    if (fromId === toId) return layout
    const from = layout.findIndex((panel) => panel.id === fromId)
    const to = layout.findIndex((panel) => panel.id === toId)
    if (from === -1 || to === -1) return layout

    const next = layout.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
}

export function setWidth(layout: Layout, id: string, width: PanelWidth): Layout {
    return layout.map((panel) => (panel.id === id ? { ...panel, width } : panel))
}

export function setHidden(layout: Layout, id: string, hidden: boolean): Layout {
    return layout.map((panel) => (panel.id === id ? { ...panel, hidden } : panel))
}

// ------------------------------------------------------------- persistence

export async function loadLayout(pref: string, userId: string, signal?: AbortSignal): Promise<Layout | null> {
    const params = new URLSearchParams({
        sysparm_query: `name=${pref}^user=${userId}`,
        sysparm_fields: 'sys_id,value',
        sysparm_limit: '1',
    })

    try {
        const response = await fetch(`/api/now/table/sys_user_preference?${params}`, { headers: headers(), signal })
        if (!response.ok) return null

        const { result } = await response.json()
        if (!result?.length) return null

        const parsed = JSON.parse(result[0].value)
        return Array.isArray(parsed) ? (parsed as Layout) : null
    } catch {
        // A layout that cannot be read is not worth failing the page over - fall back to defaults.
        return null
    }
}

export async function saveLayout(pref: string, userId: string, layout: Layout): Promise<boolean> {
    const params = new URLSearchParams({
        sysparm_query: `name=${pref}^user=${userId}`,
        sysparm_fields: 'sys_id',
        sysparm_limit: '1',
    })

    try {
        const existing = await fetch(`/api/now/table/sys_user_preference?${params}`, { headers: headers() })
        const body = JSON.stringify(layout)

        if (existing.ok) {
            const { result } = await existing.json()
            if (result?.length) {
                const update = await fetch(`/api/now/table/sys_user_preference/${result[0].sys_id}`, {
                    method: 'PATCH',
                    headers: headers({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ value: body }),
                })
                return update.ok
            }
        }

        const create = await fetch('/api/now/table/sys_user_preference', {
            method: 'POST',
            headers: headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name: pref, value: body, type: 'string', user: userId }),
        })
        return create.ok
    } catch {
        return false
    }
}

export async function clearLayout(pref: string, userId: string): Promise<void> {
    const params = new URLSearchParams({
        sysparm_query: `name=${pref}^user=${userId}`,
        sysparm_fields: 'sys_id',
        sysparm_limit: '1',
    })

    try {
        const existing = await fetch(`/api/now/table/sys_user_preference?${params}`, { headers: headers() })
        if (!existing.ok) return
        const { result } = await existing.json()
        if (!result?.length) return

        await fetch(`/api/now/table/sys_user_preference/${result[0].sys_id}`, { method: 'DELETE', headers: headers() })
    } catch {
        /* nothing to clear */
    }
}
