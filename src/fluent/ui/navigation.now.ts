import '@servicenow/sdk/global'
import { ApplicationMenu, Record } from '@servicenow/sdk/core'
import { secopsAdminRole, secopsOperatorRole, secopsViewerRole } from '../security/roles.now'

/**
 * Application navigation.
 *
 * Every module carries roles - a module without roles is a documented Store certification failure,
 * and it would also expose configuration lists to users who should not see them.
 */
export const secopsMenu = ApplicationMenu({
    $id: Now.ID['menu-secops-universal'],
    title: 'SecOps Universal Connector',
    hint: 'Configure and monitor integrations between ServiceNow SecOps and third-party security tools.',
    description:
        'Universal, extensible middleware between ServiceNow Security Operations and any third-party SIEM, EDR, threat intelligence, SOAR or vulnerability scanner.',
    roles: [secopsViewerRole, secopsOperatorRole, secopsAdminRole],
    active: true,
    order: 1000,
})

export const moduleDashboard = Record({
    $id: Now.ID['module-dashboard'],
    table: 'sys_app_module',
    data: {
        title: 'Analyst console',
        application: secopsMenu,
        link_type: 'DIRECT',
        query: 'x_335329_secops_analyst_console.do',
        hint: 'Work queue, vulnerability findings and connector health.',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 50,
    },
})

export const moduleOverview = Record({
    $id: Now.ID['module-overview'],
    table: 'sys_app_module',
    data: {
        title: 'Security overview',
        application: secopsMenu,
        link_type: 'DIRECT',
        query: 'x_335329_secops_security_overview.do',
        hint: 'Organisation-wide posture, findings and integration health.',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 60,
    },
})

export const moduleConnectors = Record({
    $id: Now.ID['module-connectors'],
    table: 'sys_app_module',
    data: {
        title: 'Connectors',
        application: secopsMenu,
        link_type: 'LIST',
        name: 'x_335329_secops_connector',
        hint: 'Third-party security systems this instance can talk to.',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 100,
    },
})

export const moduleEndpoints = Record({
    $id: Now.ID['module-endpoints'],
    table: 'sys_app_module',
    data: {
        title: 'Endpoints',
        application: secopsMenu,
        link_type: 'LIST',
        name: 'x_335329_secops_endpoints',
        hint: 'Callable operations on each connector.',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 200,
    },
})

export const moduleFieldMaps = Record({
    $id: Now.ID['module-field-maps'],
    table: 'sys_app_module',
    data: {
        title: 'Field mappings',
        application: secopsMenu,
        link_type: 'LIST',
        name: 'x_335329_secops_field_map',
        hint: 'Declarative rules that map third-party responses onto ServiceNow fields.',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 300,
    },
})

export const moduleMonitoringSeparator = Record({
    $id: Now.ID['module-separator-monitoring'],
    table: 'sys_app_module',
    data: {
        title: 'Monitoring',
        application: secopsMenu,
        link_type: 'SEPARATOR',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 400,
    },
})

export const moduleTransactions = Record({
    $id: Now.ID['module-transactions'],
    table: 'sys_app_module',
    data: {
        title: 'Transaction log',
        application: secopsMenu,
        link_type: 'LIST',
        name: 'x_335329_secops_transaction',
        hint: 'Redacted audit trail of every inbound and outbound connector call.',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 500,
    },
})

export const moduleVulnStage = Record({
    $id: Now.ID['module-vuln-stage'],
    table: 'sys_app_module',
    data: {
        title: 'Vulnerability staging',
        application: secopsMenu,
        link_type: 'LIST',
        name: 'x_335329_secops_vuln_stage',
        hint: 'Third-party vulnerability telemetry awaiting review or promotion into Vulnerability Response.',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 600,
    },
})

export const moduleCveWatch = Record({
    $id: Now.ID["module-cve-watch"],
    table: "sys_app_module",
    data: {
        title: "ServiceNow CVE watch",
        application: secopsMenu,
        link_type: "LIST",
        name: "x_335329_secops_cve_watch",
        hint: "Published CVEs naming ServiceNow, assessed against this instance build.",
        roles: ["x_335329_secops.viewer"],
        active: true,
        order: 700,
    },
})

export const moduleSupportSeparator = Record({
    $id: Now.ID['module-separator-support'],
    table: 'sys_app_module',
    data: {
        title: 'Support',
        application: secopsMenu,
        link_type: 'SEPARATOR',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 900,
    },
})

/**
 * Contact Support is a hard requirement for ServiceNow Store certification.
 *
 * PUBLISHER ACTION REQUIRED: replace the mailto below with your own published support channel
 * before submitting. The address here is a placeholder, not a working endpoint.
 */
export const moduleContactSupport = Record({
    $id: Now.ID['module-contact-support'],
    table: 'sys_app_module',
    data: {
        title: 'Contact Support',
        application: secopsMenu,
        link_type: 'DIRECT',
        query: 'mailto:support@example.com?subject=SecOps%20Universal%20Connector%20Framework',
        hint: 'Contact the application publisher for support.',
        roles: ['x_335329_secops.viewer'],
        active: true,
        order: 1000,
    },
})
