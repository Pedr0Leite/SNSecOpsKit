import '@servicenow/sdk/global'
import { Acl } from '@servicenow/sdk/core'
import { secopsAdminRole, secopsOperatorRole, secopsViewerRole } from './roles.now'

/**
 * Access control.
 *
 * Shape: viewers read, admins configure. Operators inherit viewer rights and additionally execute
 * the console's client-callable script include (which is what actually makes outbound calls).
 *
 * Missing or over-broad table ACLs are the single most common Store certification failure, so
 * every custom table declares read/create/write/delete explicitly rather than relying on defaults.
 * The client-callable script include and the inbound REST endpoint carry their own ACLs too.
 */

const CONNECTOR = 'x_335329_secops_connector'
const ENDPOINTS = 'x_335329_secops_endpoints'
const FIELD_MAP = 'x_335329_secops_field_map'
const TRANSACTION = 'x_335329_secops_transaction'
const CVE_WATCH = 'x_335329_secops_cve_watch'
const VULN_STAGE = 'x_335329_secops_vuln_stage'

// --- Connector --------------------------------------------------------------
Acl({
    $id: Now.ID['acl-connector-read'],
    type: 'record',
    table: CONNECTOR,
    operation: 'read',
    roles: [secopsViewerRole],
    adminOverrides: true,
    description: 'Anyone with console access can see connector configuration (credentials are not stored here).',
})

Acl({
    $id: Now.ID['acl-connector-create'],
    type: 'record',
    table: CONNECTOR,
    operation: 'create',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-connector-write'],
    type: 'record',
    table: CONNECTOR,
    operation: 'write',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-connector-delete'],
    type: 'record',
    table: CONNECTOR,
    operation: 'delete',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

// --- Endpoints --------------------------------------------------------------
Acl({
    $id: Now.ID['acl-endpoints-read'],
    type: 'record',
    table: ENDPOINTS,
    operation: 'read',
    roles: [secopsViewerRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-endpoints-create'],
    type: 'record',
    table: ENDPOINTS,
    operation: 'create',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-endpoints-write'],
    type: 'record',
    table: ENDPOINTS,
    operation: 'write',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-endpoints-delete'],
    type: 'record',
    table: ENDPOINTS,
    operation: 'delete',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

// --- Field mappings ---------------------------------------------------------
Acl({
    $id: Now.ID['acl-field-map-read'],
    type: 'record',
    table: FIELD_MAP,
    operation: 'read',
    roles: [secopsViewerRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-field-map-create'],
    type: 'record',
    table: FIELD_MAP,
    operation: 'create',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-field-map-write'],
    type: 'record',
    table: FIELD_MAP,
    operation: 'write',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-field-map-delete'],
    type: 'record',
    table: FIELD_MAP,
    operation: 'delete',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

// --- Transaction log --------------------------------------------------------
Acl({
    $id: Now.ID['acl-transaction-read'],
    type: 'record',
    table: TRANSACTION,
    operation: 'read',
    roles: [secopsViewerRole],
    adminOverrides: true,
    description: 'Bodies stored here are redacted, so viewers can troubleshoot without seeing credentials.',
})

Acl({
    $id: Now.ID['acl-transaction-create'],
    type: 'record',
    table: TRANSACTION,
    operation: 'create',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-transaction-write'],
    type: 'record',
    table: TRANSACTION,
    operation: 'write',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-transaction-delete'],
    type: 'record',
    table: TRANSACTION,
    operation: 'delete',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

// --- Vulnerability staging --------------------------------------------------
Acl({
    $id: Now.ID['acl-vuln-stage-read'],
    type: 'record',
    table: VULN_STAGE,
    operation: 'read',
    roles: [secopsViewerRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-vuln-stage-create'],
    type: 'record',
    table: VULN_STAGE,
    operation: 'create',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-vuln-stage-write'],
    type: 'record',
    table: VULN_STAGE,
    operation: 'write',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID['acl-vuln-stage-delete'],
    type: 'record',
    table: VULN_STAGE,
    operation: 'delete',
    roles: [secopsAdminRole],
    adminOverrides: true,
})

// --- CVE watch --------------------------------------------------------------
Acl({
    $id: Now.ID["acl-cve-watch-read"],
    type: "record",
    table: CVE_WATCH,
    operation: "read",
    roles: [secopsViewerRole],
    adminOverrides: true,
    description: "Anyone with console access can see which CVEs affect this instance. That is the point of the table.",
})

Acl({
    $id: Now.ID["acl-cve-watch-create"],
    type: "record",
    table: CVE_WATCH,
    operation: "create",
    roles: [secopsAdminRole],
    adminOverrides: true,
})

Acl({
    $id: Now.ID["acl-cve-watch-write"],
    type: "record",
    table: CVE_WATCH,
    operation: "write",
    roles: [secopsOperatorRole],
    adminOverrides: true,
    description: "Operators triage: dismissing a CVE or correcting a verdict is analyst work, not configuration.",
})

Acl({
    $id: Now.ID["acl-cve-watch-delete"],
    type: "record",
    table: CVE_WATCH,
    operation: "delete",
    roles: [secopsAdminRole],
    adminOverrides: true,
})

// --- Client-callable script include ----------------------------------------
// A client-callable script include without this ACL is a top-ten certification failure: without
// it the endpoint is reachable by any authenticated user.
Acl({
    $id: Now.ID['acl-console-ajax-execute'],
    type: 'client_callable_script_include',
    name: 'SecOpsConsoleAjax',
    operation: 'execute',
    roles: [secopsViewerRole, secopsOperatorRole, secopsAdminRole],
    adminOverrides: true,
    description: 'The script include re-checks the caller role server-side as well.',
})

// --- Inbound REST endpoint --------------------------------------------------
Acl({
    $id: Now.ID['acl-ingest-api-execute'],
    type: 'rest_endpoint',
    name: 'SecOps Universal Connector Ingestion',
    operation: 'execute',
    roles: [secopsAdminRole],
    securityAttribute: 'user_is_authenticated',
    adminOverrides: true,
    description: 'Inbound telemetry is written by an integration user holding the admin role.',
})

// --- Console REST endpoint --------------------------------------------------
// Read-only, so it is open to viewers. Requiring admin here would mean every analyst needed
// write access to the connector configuration just to see their own queue.
Acl({
    $id: Now.ID['acl-console-api-execute'],
    type: 'rest_endpoint',
    name: 'SecOps Console',
    operation: 'execute',
    roles: [secopsViewerRole, secopsOperatorRole, secopsAdminRole],
    securityAttribute: 'user_is_authenticated',
    adminOverrides: true,
    description: 'Read-only work queue and connector health. Every underlying read is ACL-enforced.',
})

// --- Analyst console UI Page ------------------------------------------------
// A UI Page without an ACL is a documented top-ten certification failure.
//
// `name` MUST be sys_ui_page.name (the endpoint with the scope prefix and '.do' stripped), not the
// endpoint itself. A mismatch here does not error - it silently protects nothing.
Acl({
    $id: Now.ID['acl-dashboard-ui-page'],
    type: 'ui_page',
    name: 'analyst_console',
    operation: 'read',
    roles: [secopsViewerRole, secopsOperatorRole, secopsAdminRole],
    adminOverrides: true,
    description: 'Restricts the analyst console page to users holding a SecOps connector role.',
})

// Separate from the console ACL on purpose: the overview can be opened to managers later without
// also granting them the analyst console.
Acl({
    $id: Now.ID['acl-overview-ui-page'],
    type: 'ui_page',
    name: 'security_overview',
    operation: 'read',
    roles: [secopsViewerRole, secopsOperatorRole, secopsAdminRole],
    adminOverrides: true,
    description: 'Restricts the security overview page to users holding a SecOps connector role.',
})
