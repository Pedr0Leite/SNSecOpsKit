import '@servicenow/sdk/global'
import { UiPage } from '@servicenow/sdk/core'
import dashboardHtml from '../../client/index.html'
import overviewHtml from '../../client/overview.html'

/**
 * The analyst console.
 *
 * The page itself is inert: a <div id="root"> and a script tag. There are no Jelly expressions and
 * no server-side interpolation, which is what keeps the classic Jelly XSS failure mode off the
 * table entirely - all data arrives over the REST API after mount, already ACL-filtered.
 *
 * `direct: true` renders without the standard ServiceNow chrome, so the React app owns the full
 * viewport and nothing of the platform's CSS leaks into the themes.
 *
 * Reachable at /x_335329_secops_analyst_console.do, gated by the ui_page ACL in
 * security/acls.now.ts.
 *
 * The endpoint matters more than it looks: the SDK derives sys_ui_page.name by stripping the scope
 * prefix and '.do', and a ui_page ACL matches on that NAME, not on the endpoint or the scope. An
 * endpoint of '..._dashboard.do' would yield the name 'dashboard', which is generic enough to
 * collide with another application's page and have the two ACLs cross-apply. 'analyst_console' is
 * distinctive enough to stay ours.
 */
export const dashboardPage = UiPage({
    $id: Now.ID['ui-page-secops-dashboard'],
    endpoint: 'x_335329_secops_analyst_console.do',
    description: 'SecOps analyst console - work queue, findings and connector health.',
    category: 'general',
    html: dashboardHtml,
    direct: true,
})

/**
 * The security overview - organisation-wide posture and integration health.
 *
 * A separate page rather than a third tab, because the audience is different: this is for someone
 * who wants the programme's shape, not their own queue. Separate page means a separate ACL, so it
 * can later be opened to managers without also handing them the analyst console.
 *
 * Same bundle, different entry point: both pages share every chart component.
 *
 * Derived sys_ui_page.name: 'security_overview'. Not simply 'overview' - see the note on the
 * console page. A page named 'overview' is very likely to collide with another application's on a
 * customer instance, and a ui_page ACL matches on that name alone.
 */
export const overviewPage = UiPage({
    $id: Now.ID['ui-page-secops-overview'],
    endpoint: 'x_335329_secops_security_overview.do',
    description: 'SecOps security overview - organisation-wide posture, findings and integration health.',
    category: 'general',
    html: overviewHtml,
    direct: true,
})
