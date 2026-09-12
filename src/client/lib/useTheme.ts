import { useCallback, useEffect, useState } from 'react'

export const THEMES = ['daylight', 'night', 'matrix'] as const
export type Theme = (typeof THEMES)[number]

const STORAGE_KEY = 'x_335329_secops.theme'

function isTheme(value: unknown): value is Theme {
    return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

/**
 * Initial theme: an explicit previous choice wins, otherwise follow the OS.
 * Storage can throw in a locked-down browser, so every access is guarded.
 */
function initialTheme(): Theme {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (isTheme(stored)) {
            return stored
        }
    } catch {
        /* storage unavailable - fall through to the OS preference */
    }

    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'night' : 'daylight'
}

export function useTheme(): [Theme, (next: Theme) => void] {
    const [theme, setTheme] = useState<Theme>(initialTheme)

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        // Tells the browser to render native controls and scrollbars to match.
        document.documentElement.style.colorScheme = theme === 'daylight' ? 'light' : 'dark'
    }, [theme])

    const choose = useCallback((next: Theme) => {
        setTheme(next)
        try {
            window.localStorage.setItem(STORAGE_KEY, next)
        } catch {
            /* a theme that cannot be remembered is still a theme that works */
        }
    }, [])

    return [theme, choose]
}
