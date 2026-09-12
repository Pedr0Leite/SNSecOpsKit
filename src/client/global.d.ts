declare module '*.css' {
    const content: string
    export default content
}

declare module '*.scss' {
    const content: string
    export default content
}

declare global {
    interface Window {
        /** ServiceNow session token, injected by <sdk:now-ux-globals>. Required on every API call. */
        g_ck: string
        NOW?: {
            user?: { userID?: string; firstName?: string; lastName?: string; userName?: string }
        }
    }
}

export {}
