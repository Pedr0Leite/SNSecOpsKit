# XML blueprint

The application is authored in Fluent (TypeScript), and `now-sdk build` emits the platform XML.
Everything below is taken from real build output in `dist/app/`, not hand-written — so it is exactly
what installs.

## Package inventory

`npm run build` produces 279 XML files. Deduplicated by type:

| Record type | Count | What |
|---|---:|---|
| `sys_db_object` | 5 | Tables |
| `sys_dictionary` | ~70 | Columns |
| `sys_choice` | 9 | Choice lists (category, auth type, capability, method, transform, state, severity, health) |
| `sys_documentation` | ~70 | Column labels (en) |
| `sys_security_acl` | 22 | ACLs |
| `sys_security_acl_role` | 24 | ACL → role links |
| `sys_user_role` | 3 | Roles |
| `sys_user_role_contains` | 2 | Role nesting (admin ⊃ operator ⊃ viewer) |
| `sys_script_include` | 16 | Script includes |
| `sys_scope_privilege` | 13 | Cross-scope privileges |
| `sys_properties` | 10 | Configuration properties |
| `sys_script` | 2 | Async business rules (inactive) |
| `sysauto_script` | 3 | Scheduled jobs |
| `sys_ws_definition` / `sys_ws_operation` / `sys_ws_query_parameter` | 1 / 2 / 3 | Scripted REST API |
| `sp_widget` | 1 | Console widget |
| `sys_app_application` / `sys_app_module` | 1 / 8 | Navigator menu and modules |
| `sys_module` | 2 | Server module bundles |

Demo data lands separately in `dist/app/unload.demo/` so it installs only with `--demoData true`.

## Table XML

Tables are emitted in the dictionary bootstrap form (`dist/app/dictionary/<table>.xml`), one file
per table with columns and choices nested. Excerpt from
`dist/app/dictionary/x_335329_secops_connector.xml`:

```xml
<?xml version="1.0"?>
<database>
  <element name="x_335329_secops_connector" type="collection" label="SecOps Connector"
           is_extendable="false" text_index="false" read_only="false" audit="true"
           display="name" access="public" caller_access="0" ws_access="true"
           read_access="true" create_access="true" update_access="true" delete_access="true"
           scriptable_table="false" attributes="">

    <element name="name" type="string" label="Name" max_length="100" mandatory="true"
             display="true" active="true"/>

    <element name="category" type="choice" label="Category" default_value="threat_intel"
             mandatory="true" choice="3" active="true">
      <choice>
        <element value="siem"          label="SIEM"                  sequence="1" language="en"/>
        <element value="edr"           label="EDR / XDR"             sequence="2" language="en"/>
        <element value="threat_intel"  label="Threat Intelligence"   sequence="3" language="en"/>
        <element value="soar"          label="SOAR"                  sequence="4" language="en"/>
        <element value="scanner"       label="Vulnerability Scanner" sequence="5" language="en"/>
        <element value="sandbox"       label="Malware Sandbox"       sequence="6" language="en"/>
        <element value="firewall"      label="Firewall / NAC"        sequence="7" language="en"/>
        <element value="other"         label="Other"                 sequence="8" language="en"/>
      </choice>
    </element>

    <element name="connection_alias" type="reference" label="Connection &amp; Credential Alias"
             reference="sys_alias" reference_cascade_rule="restrict" active="true"/>

    <element name="health_status" type="choice" label="Health status" default_value="unknown"
             read_only="true" read_only_option="instance_configured" choice="3" active="true">
      <choice>
        <element value="unknown"  label="Unknown"  sequence="1" language="en"/>
        <element value="healthy"  label="Healthy"  sequence="2" language="en"/>
        <element value="degraded" label="Degraded" sequence="3" language="en"/>
        <element value="down"     label="Down"     sequence="4" language="en"/>
      </choice>
    </element>
  </element>
</database>
```

The attributes that matter for cross-scope behaviour and for certification:

| Attribute | Value | Why |
|---|---|---|
| `access` | `public` | Other scopes may reference the table at design time |
| `caller_access` | `0` | No additional caller restriction imposed by us |
| `ws_access` | `true` | Required for Table API / REST access — without it requests return 403 even with correct ACLs |
| `read/create/update/delete_access` | `true` | Cross-scope operations permitted on our own tables |
| `audit` | `true` on configuration tables, `false` on `transaction` and `vuln_stage` | Auditing high-volume log/staging tables would double their storage for no investigative value |

The five tables: `x_335329_secops_connector`, `_endpoints`, `_field_map`, `_transaction`,
`_vuln_stage`. Field-level detail is in [01-architecture.md](01-architecture.md#3-data-model).

## Cross-scope privilege XML

One `sys_scope_privilege` record per operation per target. Real output from
`dist/app/update/sys_scope_privilege_*.xml`:

```xml
<?xml version="1.0"?>
<record_update table="sys_scope_privilege">
  <sys_scope_privilege action="INSERT_OR_UPDATE" apply_defaults="true">
    <sys_id>19bd31847a3d4f15b9d78fc04acb106e</sys_id>
    <sys_scope display_value="x_335329_secops">299d8aa83da2430497b6334a51359205</sys_scope>
    <sys_update_name>sys_scope_privilege_19bd31847a3d4f15b9d78fc04acb106e</sys_update_name>
    <operation>execute</operation>
    <source_scope>299d8aa83da2430497b6334a51359205</source_scope>
    <status>allowed</status>
    <target_name>AbstractAjaxProcessor</target_name>
    <target_scope>global</target_scope>
    <target_type>sys_script_include</target_type>
  </sys_scope_privilege>
</record_update>
```

### The 13 declared privileges

| Target | Scope | Type | Operations |
|---|---|---|---|
| `sn_si_incident` | `sn_si` | `sys_db_object` | read |
| `sn_ti_observable` | `sn_ti` | `sys_db_object` | read, create, write |
| `sn_ti_observable_type` | `sn_ti` | `sys_db_object` | read |
| `sn_ti_lookup_result` | `sn_ti` | `sys_db_object` | read, create, write |
| `sn_ti_m2m_task_observable` | `sn_ti` | `sys_db_object` | read, create |
| `cmdb_ci` | `global` | `sys_db_object` | read |
| `GSLog` | `global` | `sys_script_include` | execute |
| `AbstractAjaxProcessor` | `global` | `sys_script_include` | execute |

**No delete privileges.** SIR and TI disallow cross-scope delete on these tables
(`delete_access=false`), and a privilege can only ever request *up to* what the target table
permits — it cannot exceed it. Requesting delete would be noise that reviewers would rightly
question.

**No `sn_vul` privileges.** The `sn_vul` scope does not exist on an instance without the
Vulnerability Response subscription, so shipping those records would make the application
un-installable there. The exact records to add on a VR-enabled instance are in
[07-vulnerability-response.md](07-vulnerability-response.md).

**Cross-scope privileges are necessary but not sufficient.** Two other gates apply:

1. The **target table's own** access settings (`sys_db_object.read_access` etc.) cap what any
   privilege can grant.
2. **Restricted Caller Access** — active by default in SIR — may still require an administrator to
   approve this application under *System Applications > Application Restricted Caller Access*.

## ACL XML

Real output from `dist/app/update/sys_security_acl_*.xml`:

```xml
<?xml version="1.0"?>
<record_update table="sys_security_acl">
  <sys_security_acl action="INSERT_OR_UPDATE" apply_defaults="true">
    <sys_id>09b7ca102ca14cc3a2992cbbb110f863</sys_id>
    <sys_scope display_value="x_335329_secops">299d8aa83da2430497b6334a51359205</sys_scope>
    <sys_update_name>sys_security_acl_09b7ca102ca14cc3a2992cbbb110f863</sys_update_name>
    <active>true</active>
    <admin_overrides>true</admin_overrides>
    <advanced>false</advanced>
    <decision_type>allow</decision_type>
    <name>x_335329_secops_vuln_stage</name>
    <operation display_value="delete">delete</operation>
    <sys_name>x_335329_secops_vuln_stage</sys_name>
    <type>record</type>
  </sys_security_acl>
</record_update>
```

Roles attach through separate `sys_security_acl_role` records (24 of them).

Coverage: `read` / `create` / `write` / `delete` on all five tables (20 records), plus:

| Type | Name | Operation | Roles |
|---|---|---|---|
| `client_callable_script_include` | `SecOpsConsoleAjax` | execute | viewer, operator, admin |
| `rest_endpoint` | `SecOps Universal Connector Ingestion` | execute | admin (+ `user_is_authenticated`) |

Those last two exist because a client-callable script include without an ACL, and a UI/REST
endpoint without an ACL, are both documented top-ten certification failures.

## Regenerating and packaging

```bash
npm run build                    # emits dist/app/**
npx now-sdk pack                 # zip + update set XML + package_inventory.csv (SHA-256 manifest)
```

To pull instance-side changes back into Fluent source (for example Flow Designer actions built in
the UI):

```bash
npx now-sdk transform                                          # whole app
npx now-sdk transform --table sys_hub_action_type_definition   # just actions
```
