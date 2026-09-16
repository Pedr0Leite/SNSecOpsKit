import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    'acl-connector-create': {
                        table: 'sys_security_acl'
                        id: '3cbc2ebc38aa4b0a8b5b3ae8c1c99976'
                    }
                    'acl-connector-delete': {
                        table: 'sys_security_acl'
                        id: 'ae0d1d4c585d4329859090a1930def8b'
                    }
                    'acl-connector-read': {
                        table: 'sys_security_acl'
                        id: 'e9d51974b3ca4c2b8f12066772d6a3ad'
                    }
                    'acl-connector-write': {
                        table: 'sys_security_acl'
                        id: '2e64e511d66a45038dffcb82d629c8ca'
                    }
                    'acl-console-ajax-execute': {
                        table: 'sys_security_acl'
                        id: 'ddb16f6181334ffd8cd8fd42f496d958'
                    }
                    'acl-console-api-execute': {
                        table: 'sys_security_acl'
                        id: 'd640110917074c50b5e7c54981dc3d66'
                    }
                    'acl-cve-watch-create': {
                        table: 'sys_security_acl'
                        id: '1903ce56e1b04bc2bae1e9f8401bd5be'
                    }
                    'acl-cve-watch-delete': {
                        table: 'sys_security_acl'
                        id: 'a867375b4b4c4e7c913acd1c53afca8b'
                    }
                    'acl-cve-watch-read': {
                        table: 'sys_security_acl'
                        id: '3652e8bec33d4d2aa9e544b7deefe164'
                    }
                    'acl-cve-watch-write': {
                        table: 'sys_security_acl'
                        id: '76b9305a959f41b6a8f9c6aee7c571fe'
                    }
                    'acl-dashboard-ui-page': {
                        table: 'sys_security_acl'
                        id: 'ad5880ca9ae14b71bd1e68e75e8e6f53'
                    }
                    'acl-endpoints-create': {
                        table: 'sys_security_acl'
                        id: '5d47eafcb63149e893653d286588dff9'
                    }
                    'acl-endpoints-delete': {
                        table: 'sys_security_acl'
                        id: 'af8db6ac9528495dbfe9cdc313ffd158'
                    }
                    'acl-endpoints-read': {
                        table: 'sys_security_acl'
                        id: '1f4395ad07694a649ead3b951081ff9b'
                    }
                    'acl-endpoints-write': {
                        table: 'sys_security_acl'
                        id: '51c6c31b597446ef9ae1936771143d6b'
                    }
                    'acl-field-map-create': {
                        table: 'sys_security_acl'
                        id: '81d01e2a163949409e3cc2f1e522d1f8'
                    }
                    'acl-field-map-delete': {
                        table: 'sys_security_acl'
                        id: '6b11f47a554d4bbdb62403cff4ca7036'
                    }
                    'acl-field-map-read': {
                        table: 'sys_security_acl'
                        id: '3ab509d1c5d745538e793c5f53371402'
                    }
                    'acl-field-map-write': {
                        table: 'sys_security_acl'
                        id: '47e71f7bb64349a8ac70bda8050924e5'
                    }
                    'acl-ingest-api-execute': {
                        table: 'sys_security_acl'
                        id: 'a0ce602d24824173bc82343521141e22'
                    }
                    'acl-overview-ui-page': {
                        table: 'sys_security_acl'
                        id: '24ae4b78c038429ba305eafd9688123d'
                    }
                    'acl-transaction-create': {
                        table: 'sys_security_acl'
                        id: '970f3db466474b1197f09f6fbc9b86aa'
                    }
                    'acl-transaction-delete': {
                        table: 'sys_security_acl'
                        id: 'e6533fbc965f4f89b564942b857880f5'
                    }
                    'acl-transaction-read': {
                        table: 'sys_security_acl'
                        id: '61a1ffcef8f641a3a160a65a978adfa7'
                    }
                    'acl-transaction-write': {
                        table: 'sys_security_acl'
                        id: 'c97a6e6573064731af9ce87bcbad69b7'
                    }
                    'acl-vuln-stage-create': {
                        table: 'sys_security_acl'
                        id: '69beebf1d5d64ed9b09d57be8817318f'
                    }
                    'acl-vuln-stage-delete': {
                        table: 'sys_security_acl'
                        id: '09b7ca102ca14cc3a2992cbbb110f863'
                    }
                    'acl-vuln-stage-read': {
                        table: 'sys_security_acl'
                        id: 'a1ddf41e3279402aa2bf398f8e3e4731'
                    }
                    'acl-vuln-stage-write': {
                        table: 'sys_security_acl'
                        id: 'adbe5ff0d1f54471a2e90d1be7eea374'
                    }
                    'api-param-console-limit': {
                        table: 'sys_ws_query_parameter'
                        id: '1c69623b6ce04eb88067f84f3d8ec2dc'
                    }
                    'api-param-console-q': {
                        table: 'sys_ws_query_parameter'
                        id: '7a04999c6b5a4e3092cd697926f3b395'
                    }
                    'api-param-console-scope': {
                        table: 'sys_ws_query_parameter'
                        id: 'f4a0e87a29a24e5f9fac7fedb832a382'
                    }
                    'api-param-console-severities': {
                        table: 'sys_ws_query_parameter'
                        id: 'b3865174ae9b494c93ca2c59dbcd936a'
                    }
                    'api-param-console-sources': {
                        table: 'sys_ws_query_parameter'
                        id: '5416d9ce261e44dbb431fb31ee7a12cd'
                    }
                    'api-param-promote': {
                        table: 'sys_ws_query_parameter'
                        id: 'd02ab8e0fe2e4cd8a30a2db9db60a9a4'
                    }
                    'api-param-records-path': {
                        table: 'sys_ws_query_parameter'
                        id: 'c2bd814e03e14a409338c301f440e2ba'
                    }
                    'api-param-source': {
                        table: 'sys_ws_query_parameter'
                        id: '69d048028e114a2aa2127fa4d1d83481'
                    }
                    'api-route-connector-health': {
                        table: 'sys_ws_operation'
                        id: 'a65e886c95fa493595c41374b7974c43'
                    }
                    'api-route-console-connectors': {
                        table: 'sys_ws_operation'
                        id: '8683f6c7e525479f8cdf26bffe58b1dc'
                    }
                    'api-route-console-overview': {
                        table: 'sys_ws_operation'
                        id: '0b83f26bce8444a085ab458394ca5e7b'
                    }
                    'api-route-console-work': {
                        table: 'sys_ws_operation'
                        id: '1ad4a8a243d94fcd951f14d38498224f'
                    }
                    'api-route-ingest-vulnerability': {
                        table: 'sys_ws_operation'
                        id: '2c99a1399e794168b61c17140f550dd1'
                    }
                    'api-secops-connector': {
                        table: 'sys_ws_definition'
                        id: '94142de656c34090be7a9ac3d30798cf'
                    }
                    'api-secops-console': {
                        table: 'sys_ws_definition'
                        id: '543f4c4692e544e3ab8def009919da45'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: '2878f609fb7e4bd49194da1d1ea19822'
                    }
                    'br-enrich-on-observable-finding-change': {
                        table: 'sys_script'
                        id: '798d9fd0d4594ba8ae02554d7afa8fbe'
                    }
                    'br-enrich-on-observable-link': {
                        table: 'sys_script'
                        id: '8dc8699eebb94818842ea50c04abc541'
                    }
                    'cve-connector': {
                        table: 'x_335329_secops_connector'
                        id: 'f084f1f8ffb248c9ba133d0e1965a8da'
                    }
                    'cve-endpoint-detail': {
                        table: 'x_335329_secops_endpoints'
                        id: '070cbd5ebe8744eeb78a1540cf374d06'
                    }
                    'cve-endpoint-health': {
                        table: 'x_335329_secops_endpoints'
                        id: 'd6bae48058ef4339bc6ce2302c9f3990'
                    }
                    'cve-endpoint-search': {
                        table: 'x_335329_secops_endpoints'
                        id: 'd7c91c496dd04bbcb0a01a282bc2efcf'
                    }
                    'demo-connector-threat-intel': {
                        table: 'x_335329_secops_connector'
                        id: '2e891a2b04fd4d5eb0e3f82418c181ef'
                    }
                    'demo-endpoint-enrich': {
                        table: 'x_335329_secops_endpoints'
                        id: 'cb2d8cf558804b308033e0d4a8cf0d8b'
                    }
                    'demo-endpoint-health': {
                        table: 'x_335329_secops_endpoints'
                        id: 'f9eda6c56b5c4af7b9ed21ea660e6b4a'
                    }
                    'demo-map-details': {
                        table: 'x_335329_secops_field_map'
                        id: 'c5b781b66f944792bc49d8d6f7436885'
                    }
                    'demo-map-finding': {
                        table: 'x_335329_secops_field_map'
                        id: '18e44bca5c2d4fb0896117c5808a9bc8'
                    }
                    'demo-map-score': {
                        table: 'x_335329_secops_field_map'
                        id: 'ac8586421e6a4da9a1d23251f18d5e36'
                        deleted: true
                    }
                    'job-connector-health-sweep': {
                        table: 'sysauto_script'
                        id: 'e5fe217a9c784a2c9c072f26667262f6'
                    }
                    'job-cve-watch-daily': {
                        table: 'sysauto_script'
                        id: '4947484239884512a47c0cfe8d9c3a09'
                    }
                    'job-expire-deferred-retries': {
                        table: 'sysauto_script'
                        id: '947116dacce04f5dbcc5b17c6d4e514a'
                    }
                    'job-transaction-cleanup': {
                        table: 'sysauto_script'
                        id: 'cddccb4fa26c4c8db840c9606fb4fba7'
                    }
                    'menu-secops-universal': {
                        table: 'sys_app_application'
                        id: 'a1ac8e4cb75f49749248974f183c4523'
                    }
                    'module-connectors': {
                        table: 'sys_app_module'
                        id: '6cc7934e52814e3cb88324e003674426'
                    }
                    'module-contact-support': {
                        table: 'sys_app_module'
                        id: '485d7eae5ce84c0685478f846aaf50f8'
                    }
                    'module-cve-watch': {
                        table: 'sys_app_module'
                        id: '2ed3f066245d4499bff734f25de64a35'
                    }
                    'module-dashboard': {
                        table: 'sys_app_module'
                        id: 'f286f83bb6bc4173a2c4428fe7732ca0'
                    }
                    'module-endpoints': {
                        table: 'sys_app_module'
                        id: 'f40e2c2ed6ae45f8800c8a448f8fac25'
                    }
                    'module-field-maps': {
                        table: 'sys_app_module'
                        id: 'd4bd774c0d6a4d6bb5ebec93dc273cb9'
                    }
                    'module-overview': {
                        table: 'sys_app_module'
                        id: 'a569b7811b79471f9f1217f422c98f0e'
                    }
                    'module-separator-monitoring': {
                        table: 'sys_app_module'
                        id: '5e973477b8614e3ab07fbca790033dab'
                    }
                    'module-separator-support': {
                        table: 'sys_app_module'
                        id: '515b65566724495b8008f2ff676c8a75'
                    }
                    'module-transactions': {
                        table: 'sys_app_module'
                        id: '5cde2b03d81b4c53b9d28d9c01465ebf'
                    }
                    'module-vuln-stage': {
                        table: 'sys_app_module'
                        id: '41c1c8d7d648462fa519b25973a86641'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: 'fc167040c2364e4a804bdfe8005f69c8'
                    }
                    'prop-auto-enrichment': {
                        table: 'sys_properties'
                        id: '113dede11bd545febf0ce444a8931967'
                    }
                    'prop-cve-backfill-months': {
                        table: 'sys_properties'
                        id: 'f8ec6759e2634940ab643cee8e62d747'
                    }
                    'prop-cve-connector': {
                        table: 'sys_properties'
                        id: 'edc29f38773b421ba19f6be0c2173945'
                    }
                    'prop-cve-create-incidents': {
                        table: 'sys_properties'
                        id: '23233141a27540058df0e702c5cc4f58'
                    }
                    'prop-cve-enabled': {
                        table: 'sys_properties'
                        id: 'e2535c86ed2e455b9e4609e65fc47b51'
                    }
                    'prop-cve-incident-table': {
                        table: 'sys_properties'
                        id: 'd0d1687047764726b0e0d6ccd84b4b95'
                    }
                    'prop-cve-keyword': {
                        table: 'sys_properties'
                        id: '50ea32628cca46c3803b193bd9947968'
                    }
                    'prop-cve-watermark': {
                        table: 'sys_properties'
                        id: '02a90fb85d5d44f980039a9e8b94744e'
                    }
                    'prop-detonate-max-indicators': {
                        table: 'sys_properties'
                        id: '7ddab7bb6e3744408805a3512cbeb61f'
                    }
                    'prop-http-max-retries': {
                        table: 'sys_properties'
                        id: '62362399aa824735bcb86f6f4b46878a'
                    }
                    'prop-http-timeout': {
                        table: 'sys_properties'
                        id: '41225d40fb2f421d93163c8f11bf9186'
                    }
                    'prop-ingest-max-records': {
                        table: 'sys_properties'
                        id: '3a0c6ed2787244d18579c56243eb38fd'
                    }
                    'prop-log-level': {
                        table: 'sys_properties'
                        id: 'e66b125667a346bb81193fe9c86381cc'
                    }
                    'prop-log-retention-days': {
                        table: 'sys_properties'
                        id: '0f74b8abe73b4529956327392ef2820b'
                    }
                    'prop-redact-extra-keys': {
                        table: 'sys_properties'
                        id: 'c24ce161c7ea4672ad1371adbe4463d0'
                    }
                    'prop-vr-entry-table': {
                        table: 'sys_properties'
                        id: '27960d2f13324a6aa7a2956fd1044baf'
                    }
                    'prop-vr-item-table': {
                        table: 'sys_properties'
                        id: '9250d0840ab54921914e7b0106632033'
                    }
                    'prop-vr-promotion': {
                        table: 'sys_properties'
                        id: '81cd846dd8fe4c05bd575c61d2fca0df'
                    }
                    'si-secops-console-ajax': {
                        table: 'sys_script_include'
                        id: '55d0702fc6504f69968547c5f057ba4d'
                    }
                    'si-secops-containment-handler': {
                        table: 'sys_script_include'
                        id: 'e5a8ab9d8c26422d8c37278f153e3d8d'
                    }
                    'si-secops-cve-watch': {
                        table: 'sys_script_include'
                        id: 'f02030c8aaf94452977b1745c4c106c6'
                    }
                    'si-secops-field-mapper': {
                        table: 'sys_script_include'
                        id: 'c0191f9639cf41ada5df6cdfa55aecb3'
                    }
                    'si-secops-health-checker': {
                        table: 'sys_script_include'
                        id: 'd2bbf5e2ec11413abf0fba49401b53ca'
                    }
                    'si-secops-indicator-extractor': {
                        table: 'sys_script_include'
                        id: 'edafc84207dd4a47a814dfed377f025b'
                    }
                    'si-secops-json': {
                        table: 'sys_script_include'
                        id: '6c364ff1e3e74772b4aae2f0bc2e446a'
                    }
                    'si-secops-log': {
                        table: 'sys_script_include'
                        id: '385cda7bad5c472a84c6552a1f46dc22'
                    }
                    'si-secops-metrics': {
                        table: 'sys_script_include'
                        id: '8c02ad4f4a8c4fc18ff284fb77a814b7'
                    }
                    'si-secops-phishing-handler': {
                        table: 'sys_script_include'
                        id: 'c4b0c1d6c4c147fe9d9d5cf02ca692c6'
                    }
                    'si-secops-registry': {
                        table: 'sys_script_include'
                        id: 'a87b6fad29064561a166bfb625d972e2'
                    }
                    'si-secops-rest-client': {
                        table: 'sys_script_include'
                        id: 'cdab326502454e4b9045aea3269fb2d1'
                    }
                    'si-secops-target-writer': {
                        table: 'sys_script_include'
                        id: 'e247063e1c094522a63b869dba6d106e'
                    }
                    'si-secops-template': {
                        table: 'sys_script_include'
                        id: 'a510c96f80124954992a7615256a2425'
                    }
                    'si-secops-threat-intel-handler': {
                        table: 'sys_script_include'
                        id: 'a07b092bc9ec4aae81dd9c23b1ac6ae0'
                    }
                    'si-secops-transaction-logger': {
                        table: 'sys_script_include'
                        id: 'a8c3edca0778406598762491db8e0f8a'
                    }
                    'si-secops-universal-payload-handler': {
                        table: 'sys_script_include'
                        id: '72f78dc180374706825c250f5fb0e55e'
                    }
                    'si-secops-version-matcher': {
                        table: 'sys_script_include'
                        id: '7d0d7e8019ab462aa4c6c90313f1bcc3'
                    }
                    'si-secops-vuln-ingestion-handler': {
                        table: 'sys_script_include'
                        id: 'aaf0789b48da4a3aa672788cc9fd4c30'
                    }
                    'si-secops-work-queue': {
                        table: 'sys_script_include'
                        id: '667b27f1f53c414d9582b9c5a1626ab6'
                    }
                    'styles.css': {
                        table: 'sys_ux_theme_asset'
                        id: '8fca47fb7cce4953a1a26da951487bb8'
                        deleted: true
                    }
                    'widget-secops-console': {
                        table: 'sp_widget'
                        id: '4e62b5b82b0444df93f0628c06b282d3'
                    }
                    'xsp-global-abstract-ajax-execute': {
                        table: 'sys_scope_privilege'
                        id: '19bd31847a3d4f15b9d78fc04acb106e'
                    }
                    'xsp-global-cmdb-ci-read': {
                        table: 'sys_scope_privilege'
                        id: 'aa8e18396fa44ee28e986daa20e0cca7'
                    }
                    'xsp-global-grmember-read': {
                        table: 'sys_scope_privilege'
                        id: 'bf54d0efb899499b9b31a9ded2ceabc2'
                    }
                    'xsp-global-gslog-execute': {
                        table: 'sys_scope_privilege'
                        id: 'f73d734a53224b50ba294447739e1cef'
                    }
                    'xsp-global-user-group-read': {
                        table: 'sys_scope_privilege'
                        id: '088b70dfcccf41d7aa3568edfafaea0a'
                    }
                    'xsp-global-user-read': {
                        table: 'sys_scope_privilege'
                        id: '1da9825d5fbd4f168c5d82f0b5b23921'
                    }
                    'xsp-sn-si-incident-create': {
                        table: 'sys_scope_privilege'
                        id: '9b16f54f12f24cd3889bf1afcdfcc898'
                    }
                    'xsp-sn-si-incident-read': {
                        table: 'sys_scope_privilege'
                        id: 'd8762336f71341cd94f10c6cca8cd6e6'
                    }
                    'xsp-sn-si-task-read': {
                        table: 'sys_scope_privilege'
                        id: 'b1abe41e45794e4ba3cfa2eaad217ec7'
                    }
                    'xsp-sn-ti-lookup-result-create': {
                        table: 'sys_scope_privilege'
                        id: '7f16a27afe794df6a5fea6b2982b2440'
                    }
                    'xsp-sn-ti-lookup-result-read': {
                        table: 'sys_scope_privilege'
                        id: '7b8ad4d71c0c48d0befca5f052704d50'
                    }
                    'xsp-sn-ti-lookup-result-write': {
                        table: 'sys_scope_privilege'
                        id: 'ccc6f4c6fc544fe5bb20e839bd8ce593'
                    }
                    'xsp-sn-ti-m2m-task-observable-create': {
                        table: 'sys_scope_privilege'
                        id: '38d1d7da84f64d7db1c556530658938a'
                    }
                    'xsp-sn-ti-m2m-task-observable-read': {
                        table: 'sys_scope_privilege'
                        id: '865a28e877e14080b36babeb47bede19'
                    }
                    'xsp-sn-ti-observable-create': {
                        table: 'sys_scope_privilege'
                        id: 'ad0d574a209941cf94e34b9d246bcecf'
                    }
                    'xsp-sn-ti-observable-read': {
                        table: 'sys_scope_privilege'
                        id: '44f0af4ea0a844f7895761f6bb5c42b6'
                    }
                    'xsp-sn-ti-observable-type-read': {
                        table: 'sys_scope_privilege'
                        id: '8b61388e48154d878179eb05eae19d1d'
                    }
                    'xsp-sn-ti-observable-write': {
                        table: 'sys_scope_privilege'
                        id: 'd92352ebb2c04320ac73bff2ec4dcdf1'
                    }
                }
                composite: [
                    {
                        table: 'sys_choice_set'
                        id: '0153fcb1d7e9438a897728e995b7aea6'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '01653a57c5294c728b1477bc06accbcb'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'http_method'
                            value: 'delete'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_ui_page'
                        id: '01ab3bf872e74dadaac58f0569c9b52d'
                        deleted: true
                        key: {
                            endpoint: 'x_335329_secops_dashboard.do'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '0425ed3e7a7548c2b3ce2f718b5425a2'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            value: 'json'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '04a139b5fb68473695bf9bde90f81dd0'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'relevance_reason'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0538d38b764d4688821e39a0e3ab4118'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_type'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '06e3536664064cb0887344af0fc2af00'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'last_health_message'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '07440f7b252e4f7cb2d62aa375ff60cd'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'state'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '0789806e935d4f078a0dcca92ae6229a'
                        key: {
                            sys_security_acl: 'ddb16f6181334ffd8cd8fd42f496d958'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '081f23cb1c1142bab0ed01d99f538dad'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'retry_count'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '082b53fabe374bc19cbccd9f646bbd2c'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'advisory_url'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: '08660c984f474ddca64517a2bb5a1aae'
                        key: {
                            logical_table_name: 'x_335329_secops_vuln_stage'
                            col_name_string: 'state'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '08a709dd6b8f4b969109160851b67e85'
                        key: {
                            sys_security_acl: 'd640110917074c50b5e7c54981dc3d66'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '0a5f477d8c5644c3ada1edb59b134eef'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_profile_id'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0b3382f9359c4feb8e66aa3f2bc5d827'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'connector'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0b9f16c1ec6746aa97007223f45cad6a'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '0ca0d56a08854c41936c2b779fdaae24'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'state'
                            value: 'pending'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '0cb5dbe65cdd4af098c124ad0f731b2b'
                        key: {
                            application_file: '1940a30fa9aa431c9514d1b91be925a4'
                            source_artifact: '5916417163ad403b86bf5aac8bae8fbf'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '0dbdca629ee040eb9f016055c4a72ae6'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'error_message'
                        }
                    },
                    {
                        table: 'sys_ux_lib_asset'
                        id: '0dc97ce258b741999ac9ddc083ce1c63'
                        key: {
                            name: 'x_335329_secops/overview'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '0e5aa4a586634033bbe80f046e1a2ad0'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'http_method'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '0e997a78815b42529d6f8aba0107866e'
                        deleted: true
                        key: {
                            application_file: '1940a30fa9aa431c9514d1b91be925a4'
                            source_artifact: 'f70b9a4988144beb806234ef1d7699ba'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0f4cfa0543114f66a904448b04b3c6d8'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'external_id'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '10ab31d4840345758bf0b1ed1fe790a3'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                            value: 'health'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '113d37fe75c94cf292c27f56bdd40cec'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '14c8b2b41ba54db2a7566eedcf2391e0'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'target_field'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1713ee9f9f1844abac707ef2dad45de9'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '17add78bbc47497692ca7a607341c0b5'
                        key: {
                            sys_security_acl: 'ddb16f6181334ffd8cd8fd42f496d958'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '1824939f72774cada9e01e0986ac3db9'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'last_checked'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '190c3f0f6e0141b6853dce526b2f55fb'
                        deleted: true
                        key: {
                            application_file: '0dc97ce258b741999ac9ddc083ce1c63'
                            source_artifact: '7465717d757e4455a449ccb30c79b694'
                        }
                    },
                    {
                        table: 'sys_ux_lib_asset'
                        id: '1940a30fa9aa431c9514d1b91be925a4'
                        key: {
                            name: 'x_335329_secops/main'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '194e13106fb241d9b2665f56f1a026fb'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'transaction'
                        }
                    },
                    {
                        table: 'sys_user_role'
                        id: '199c888755f24e6f8acf1f6f193cd8b3'
                        key: {
                            name: 'x_335329_secops.viewer'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '1be21620f9534acaa85836f474ebe978'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1c3601ba626c427cb1ca63c55faa6565'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'first_seen'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1e24f2c355564a34b96f88a04c3898e9'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'default_value'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '1f33d223beea4ec9a9a01a0f8dba07e4'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'http_timeout_ms'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '1fb2e7632f524ce4a7e199d83e083534'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'state'
                            value: 'failed'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1fdaaf16d06547e2929fd95ac012c537'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cvss_score'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '204861197afb44ef95616b5d430b9dfd'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: '20941bdd48f14ce7abb614fcf347a2f0'
                        key: {
                            web_service_operation: '1ad4a8a243d94fcd951f14d38498224f'
                            web_service_query_parameter: '1c69623b6ce04eb88067f84f3d8ec2dc'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2098a036582e4bbba8cb95e7f39d1cf0'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'order'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '211517662c034bb0b25b2b88229518f1'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'relevance'
                            value: 'unknown'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '2127a8a6d16743c99cc2d2fe14f8de1b'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'state'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '21c4d313ac9b43599354b5e76a41c46e'
                        key: {
                            name: 'x_335329_secops_connector'
                        }
                    },
                    {
                        table: 'sys_user_role'
                        id: '2205bcedeed94c5ab19c1b16c716a095'
                        key: {
                            name: 'x_335329_secops.operator'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2432144d37ed4b5998e78d111d4f8d14'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'path'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '2492cdbf00cd4dfd9884685ab5b39dc0'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                            value: 'medium'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '25eab8d01055472886fb35bde32051f5'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cvss_vector'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '266fc3f53000485fa0950d4a9e87094e'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_status'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '28213ec50bf643c1955c20389c4d891c'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'relevance'
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: '28ba666ad1b74121a666f1c18b2db314'
                        key: {
                            web_service_operation: '1ad4a8a243d94fcd951f14d38498224f'
                            web_service_query_parameter: '7a04999c6b5a4e3092cd697926f3b395'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '28fa26a19dbe4ce1ab50254f22a18bd0'
                        key: {
                            application_file: '3ccae1e7ecb148edb648731107776fdd'
                            source_artifact: '5916417163ad403b86bf5aac8bae8fbf'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '29fe226156564edea638bddc029c72f7'
                        key: {
                            sys_security_acl: '81d01e2a163949409e3cc2f1e522d1f8'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '2a8fe2d8ac704e67aad14d589b4dcb21'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'http_method'
                            value: 'patch'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '2b8836f51ca34039a6d64ba5aa92e9aa'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                            value: 'high'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '2b8cc06a8a5f46779f33f82d63631ada'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'state'
                            value: 'dismissed'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2e28d56981da40acac32014a6c84b010'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2e9ec7b1906d4422be3ffe0b0df1a9ab'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'endpoint'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2f7a67b4ddbc4a9ba54d187739ad2950'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '304c9fbbbb154743a8a3a867c396907a'
                        key: {
                            sys_security_acl: 'd640110917074c50b5e7c54981dc3d66'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '304eee28a4b44907a3505a431f5405a4'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            value: 'scanner'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '306c4666273143a9b6d877c4f81478e2'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'state'
                            value: 'success'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '328437ee8e3a4cc59e62ae2cc09b54e2'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'cvss_score'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '32cc72e019a943d9abd3cf34a30e6a46'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'title'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '34057494ca5549f78def2f4413c5be57'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'relevance'
                            value: 'not_affected'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_ui_page'
                        id: '346edad7ba5e46b3b1fcdeeb68e9e417'
                        key: {
                            endpoint: 'x_335329_secops_security_overview.do'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3578aa3b2fa64679bc969234701a871a'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'source_record'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: '35c3bbb3514e4793b18390a2fa451fff'
                        key: {
                            name: 'x_335329_secops_connector'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '36270c0289944461933a06c2c0b74deb'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'request_template'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '39aa189cb4c74ad684723e01273d5f09'
                        key: {
                            sys_security_acl: '5d47eafcb63149e893653d286588dff9'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '39e9241860f34dae936512b4cad00d03'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                            value: 'ingest'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: '3a43a6b5bac5466f87e6d27e91935a08'
                        key: {
                            logical_table_name: 'x_335329_secops_connector'
                            col_name_string: 'active'
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: '3aad7f30dd7d4d4b8002b627e535eda6'
                        key: {
                            web_service_operation: '2c99a1399e794168b61c17140f550dd1'
                            web_service_query_parameter: 'c2bd814e03e14a409338c301f440e2ba'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3b8b092029564e3db6d9c2cb275ecf7f'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'connection_alias'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3b9ed06fdfe44f13b84a1aea8648198e'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '3c2b522ae6eb4470aae6b8716241b2ac'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'success_codes'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ux_lib_asset'
                        id: '3ccae1e7ecb148edb648731107776fdd'
                        key: {
                            name: 'x_335329_secops/main.js.map'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3eca44a8ea1f4b60b30aff16178b689b'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'last_seen'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '4088bc9f65ba40ef96191883d3f404fe'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'last_health_check'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '4127e8c1a0244b6dafaf476f549c8069'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '4177e774915b4e6faeb69d2d0e03a25e'
                        key: {
                            application_file: '346edad7ba5e46b3b1fcdeeb68e9e417'
                            source_artifact: '7ecb21ca62cd48c6815f00482fe00756'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '42badd944896421da80c75e38fac90ad'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '42d39f659f364c67a9e7cf9618058e51'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                            value: 'none'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '44bbcd2f6b1143979062f8e5203445a6'
                        key: {
                            sys_security_acl: '69beebf1d5d64ed9b09d57be8817318f'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '468b0ece6b6d4a6a9b7498da64fec0d8'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'active'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '4709a5f2f02147c28e7c60b9bc659753'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '471647a7f9264b9f98af487742b9fec4'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'title'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '471fb12e7d214717bd1d27560d53af5f'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'mid_server'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '48721fd3de234389ae199512369a334d'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'last_checked'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '48a2ae421ca844fd9537d821c5234d4b'
                        key: {
                            sys_security_acl: 'a1ddf41e3279402aa2bf398f8e3e4731'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '48c8c1ad13a34502adefa8d9fe158da5'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'connector'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '4a9a6339da404c1b95cfbdedbc0d5072'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'order'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '4c8a510d00ac49209aeffc7b9e6f327a'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '4d2eb350b04546ebac92e1f8a3bc0087'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'raw_payload'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '4eb4a2d5a19d4786b3ec3f4a447724cc'
                        key: {
                            sys_security_acl: 'ad5880ca9ae14b71bd1e68e75e8e6f53'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '4ff1e4e6cb484be79089f85a7124402a'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cna'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '5027e12286894a65be919190e2b09590'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            value: 'soar'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '502d5b67d7a042318cf48ecd60d8b47d'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                            value: 'high'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '5037c1c5f32842adae7c7a4d50be9bcb'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'request_headers'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: '50c100fb224b49cb9df988cb1cde34cc'
                        key: {
                            logical_table_name: 'x_335329_secops_cve_watch'
                            col_name_string: 'relevance,state'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '50f255588230400a9d3c242a56ab460a'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'correlation_id'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '51b5d906ede445ce801cf24641a69df8'
                        key: {
                            sys_security_acl: '6b11f47a554d4bbdb62403cff4ca7036'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_index'
                        id: '51e550d6e6c54fa58daee8e97788f86e'
                        key: {
                            logical_table_name: 'x_335329_secops_cve_watch'
                            col_name_string: 'cve_id'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '530177feef1b4b148990bfeb8a4bbacc'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'state'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '5321d91f34cc4935a9f3e8474e0159b2'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'relevance'
                            value: 'affected'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '54b051cac1d24f1fa8574128aca64dc2'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_user_role'
                        id: '558c55998de6414d8c13c904c8b69fe6'
                        key: {
                            name: 'x_335329_secops.admin'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '562aaf786b6e4fda9b8c3eebe1ba2819'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_type'
                            value: 'none'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '565759d1b1cd4425b62b77993706883e'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            value: 'boolean'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '56f07641f4e04181b0da71b1de11d5bc'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                            value: 'unknown'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '570859aead1e4ae58ef0d6ea8f0391a1'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                            value: 'medium'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: '576e15eb5ec74fb79dd2ae9a46d98bc5'
                        key: {
                            name: 'x_335329_secops_transaction'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '5834a70149284bddaa9fa1e1a0a0058e'
                        key: {
                            application_file: 'cbb2db7214e94cd2a96d98f3221ec57b'
                            source_artifact: '5916417163ad403b86bf5aac8bae8fbf'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '58589c9e3e28473581d50850629570e9'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            value: 'sandbox'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '5907df764a184134be830ce687ee0e35'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'http_method'
                            value: 'post'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact'
                        id: '5916417163ad403b86bf5aac8bae8fbf'
                        key: {
                            name: 'x_335329_secops_analyst_console.do - BYOUI Files'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '591a86a0e1d843a3a103e81b061d7b2e'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                            value: 'enrich'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5a26bfcbba034d289dc0977e38e69a11'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'base_url'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5ad3adfefd84441db3ec41fc82dd1fec'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '5b79edd790df49a28bb618065e8d2ad3'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'state'
                            value: 'mapped'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: '5b94a78cce404e819cff0d97439386e6'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '5b987b577f4440fcb89fbb249f2d6a2d'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            value: 'lower'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5bfdc54ecaa947dcbd8cc467d4f0a7af'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'promotion_message'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '5c472a61d98044cab2d3f01a48df2eff'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'title'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '5c650a31c7a24d759686f8623f477506'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'relevance_reason'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5dae6ea6d55f44ffb2049911043eb0ec'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'endpoint'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5e5e64b52b084e0cafb728a7b6d8202f'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'vendor'
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: '5ecac927f93e4535ae191fef4171cef2'
                        key: {
                            web_service_operation: '1ad4a8a243d94fcd951f14d38498224f'
                            web_service_query_parameter: 'f4a0e87a29a24e5f9fac7fedb832a382'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '5f1950d4e882474f9e1ddf87e3c0bb6d'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'response_summary'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5f5347eb5b2440d9993924fd1d3c3914'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'published'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5f90c1ea45de42f2bbc80b59dbc517d8'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                        }
                    },
                    {
                        table: 'sys_ui_page'
                        id: '5fa6fd6f5e2d4a1cad36ab1f2e89b923'
                        deleted: true
                        key: {
                            endpoint: 'x_335329_secops_overview.do'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '608bdb92f0eb4959ac0b8b395655f6a5'
                        key: {
                            sys_security_acl: 'a867375b4b4c4e7c913acd1c53afca8b'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: '60e22a8ec4ca44ef9e6b253222ef9f3d'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '6151f02b2b4c47a4ab6ca10b256a51e1'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'state'
                            value: 'retry_pending'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '615ab1f0019642f19bb0b2b6ac42a200'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'name'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '640d9bc3b3054bcc8daef8629a0f7883'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'default_value'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6422fd79f502407290ca6a557413a2a0'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'description'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6540eb1872a5493394628b9ce72ca1af'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'raw_payload'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '65842c3e40954ed586f5918b57433243'
                        key: {
                            sys_security_acl: 'ad5880ca9ae14b71bd1e68e75e8e6f53'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '65d3ed6f1a4e409694b734e61030cd82'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_type'
                            value: 'alias'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '66991adaaf37423c8c253b1a25f9af33'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            value: 'firewall'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '66d68b376f1c4f6fbde4d17b8e8dea4a'
                        deleted: true
                        key: {
                            application_file: '01ab3bf872e74dadaac58f0569c9b52d'
                            source_artifact: 'f70b9a4988144beb806234ef1d7699ba'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '6723766aa9a148ba936c8a28dacefcf1'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'duration_ms'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '679b59880a604ab5a7c388017df3c7ac'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'raw_record'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '67b5a047534c402b9c2d9515431b7fe1'
                        deleted: true
                        key: {
                            application_file: '5fa6fd6f5e2d4a1cad36ab1f2e89b923'
                            source_artifact: '7465717d757e4455a449ccb30c79b694'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6809ba6aa23746439beeb0a8cb662332'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'external_id'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '696a316f4cb14018943ef22a319ceb2d'
                        key: {
                            application_file: '8c1a0a1ce9ff47e9b3e736bd7c0d2f2d'
                            source_artifact: '7ecb21ca62cd48c6815f00482fe00756'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6b3b7eb521be4fad9f64ea3f4931543e'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_type'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '6d2399a5a92b401fa69bf825aa249c90'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'request_template'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '6d2a38c521db4173b8c9d22347ec137d'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            value: 'edr'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6d39deb86dfd4e26b84f0eaabdc35f75'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '6da969b855b54c93adca8029470bf865'
                        key: {
                            sys_security_acl: 'e6533fbc965f4f89b564942b857880f5'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6de160c13af941bab7348d16d013a53d'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'fix_versions'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6eb1d18f8e5c4ae0a5b7d6edf34bb733'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '6f587252ff894755a2ce4ed3d6e4d915'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'source_table'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '6faeee17ca30434c98857ad9a15173c8'
                        key: {
                            sys_security_acl: '24ae4b78c038429ba305eafd9688123d'
                            sys_user_role: {
                                id: '2205bcedeed94c5ab19c1b16c716a095'
                                key: {
                                    name: 'x_335329_secops.operator'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '6fff3739c135428ba22d1c1f61c14043'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'http_status'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '701507878f9448039a54315c5a373e54'
                        key: {
                            sys_security_acl: 'af8db6ac9528495dbfe9cdc313ffd158'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '724524a2c340484ca5c8fac57a87210a'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cvss_vector'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '73676b822ff745a1af60d3502e40c269'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'first_seen'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '746344aa4e654c3c893ddca3acbb2bf1'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            value: 'iso_date'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact'
                        id: '7465717d757e4455a449ccb30c79b694'
                        deleted: true
                        key: {
                            name: 'x_335329_secops_overview.do - BYOUI Files'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '750d8f2c274f4f6ab8296871d3faa36b'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'cve'
                        }
                    },
                    {
                        table: 'sys_user_role_contains'
                        id: '75318775e5f243a1b127dd9ba2e246e3'
                        key: {
                            role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                            contains: {
                                id: '2205bcedeed94c5ab19c1b16c716a095'
                                key: {
                                    name: 'x_335329_secops.operator'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '770ed5cfb06b4e6c883edefd81d6d773'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                            value: 'custom'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '771f3103669a4a5c9ed4a484f2c5e008'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'state'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: '77cd7025b58c4fcda805ca5c3ffcda09'
                        key: {
                            web_service_operation: '2c99a1399e794168b61c17140f550dd1'
                            web_service_query_parameter: '69d048028e114a2aa2127fa4d1d83481'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7885d63746914e7aa9feb3b3b150c05c'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'connector'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '79d4afda0936481ba2c75739b2fd925e'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'mandatory'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7b6898bc6d3f4eae9805fe9729b139be'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'promotion_message'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '7bc08f0958144a7a9b65e8ed019e917d'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_status'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7c3915729e174c199f1eb5a7d227042d'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'connector'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7c4a0251bc53434a826ee8759d22323f'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'description'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '7c9023a9449a4ec7bf353a0a7114b7d8'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'state'
                            value: 'error'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '7db1468c3fad416b90bb529251879fe0'
                        key: {
                            sys_security_acl: 'ae0d1d4c585d4329859090a1930def8b'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '7e4cfbd7bf8a416f97bf6aecec182b5f'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact'
                        id: '7ecb21ca62cd48c6815f00482fe00756'
                        key: {
                            name: 'x_335329_secops_security_overview.do - BYOUI Files'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7f2a7e1757f546cf9295eabd53b7c25a'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'duration_ms'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8051d8edd94540c8bf92735662c6d97a'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'active'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '805f8026a2ee45ca922b0d3e2b6fb0e6'
                        deleted: true
                        key: {
                            application_file: '3ccae1e7ecb148edb648731107776fdd'
                            source_artifact: 'f70b9a4988144beb806234ef1d7699ba'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '816d3ffc688240f3882ced081f53ba10'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_status'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '81764dc6b2334e988b7c35af88e2eb96'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'response_summary'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8665e2ddf25e47c086587518b7636dc6'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'description'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '873ec3dc2aa947bd848a5823f7ef3a7f'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'response_root'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '8872fed1db5e41e083efa0dfbe1f4cc1'
                        key: {
                            sys_security_acl: '970f3db466474b1197f09f6fbc9b86aa'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '88930553a2c14c99b4858c03b37ec18c'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cve_url'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: '8958e367e1074990a8077b8f77c98ad4'
                        key: {
                            name: 'x_335329_secops_field_map'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '8ac566a1eac44f54a2680a9c1b965014'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'response_root'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ux_lib_asset'
                        id: '8c1a0a1ce9ff47e9b3e736bd7c0d2f2d'
                        key: {
                            name: 'x_335329_secops/overview.js.map'
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: '8ccafea8ffc849268c9508c64de74d8d'
                        key: {
                            web_service_operation: '1ad4a8a243d94fcd951f14d38498224f'
                            web_service_query_parameter: '5416d9ce261e44dbb431fb31ee7a12cd'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '8ec08dd3de66418bb59bced0e213a421'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_type'
                            value: 'basic'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8f1976364eda4acbad337c96c00cd69a'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'correlation_id'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8f697e5ddeda42acb108b89cc4849a42'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cve_url'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '9028b2017c4044f5b1165247db4c22e5'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'state'
                            value: 'promoted'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '905eea654b3d4d34a18326c6716fbbaa'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'request_headers'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '909d533194414fccb556413502562260'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'next_retry'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '9113e4d82478443da821e1d867cbf009'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'state'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '91176c4cca0c423698a79ad6b9e4101c'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_profile_id'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '916a24f6c5224a42ac22c2536aa83c3a'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'last_health_check'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '91a2df786c754254bf167a390c567b55'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'state'
                            value: 'new'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '92363a8d892541e0bb1c61d1367b7f00'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'state'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '923d25a6b4f74159937b6a01e0c40f0e'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'source_table'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '95dbd46d54cf4fb2b4aa720eb5b39c57'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            value: 'threat_intel'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '96c7f63070df4d8f9a30a20abb9d12eb'
                        key: {
                            sys_security_acl: '1903ce56e1b04bc2bae1e9f8401bd5be'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '970b1bdcc0364217b55926e60482584a'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_status'
                            value: 'degraded'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '97b10fc9bd1d44ed9af9570ef2c56e1e'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_status'
                            value: 'healthy'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '97e1e60c0233486c8023562ceb944258'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '986e41f479864bdaab35d2aea4aa8bba'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'http_method'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: '98c56cd1c790474091d26d03bb96a3f2'
                        key: {
                            logical_table_name: 'x_335329_secops_endpoints'
                            col_name_string: 'connector,capability'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: '98fd9f93ea3544fb85e4fb90ddf69a7c'
                        key: {
                            logical_table_name: 'x_335329_secops_vuln_stage'
                            col_name_string: 'source,external_id'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '99c53a592b474fcdbdf3dfafd5e99a93'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '9a1790039feb4996a5d2767c29996f80'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'http_method'
                            value: 'put'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '9a76346e534e4eafb616831a6e171976'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'source'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9ac431f3c33843339e6185596184021a'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'request_summary'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9b6a2b70215d4c08bb490ca78048dd59'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'source'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9bab9e0c3f8a44e6af8fe84226f64fc3'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'security_incident'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '9ca653e5d27945bc839240b055f72cdd'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            value: 'other'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '9d1b9046a3964bd58e4669cb7b633525'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'max_retries'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9db93b0abd36443cbc2c5498c8110fa4'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'cvss_score'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9defc05625884d25afa2efc1fc943a80'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'capability'
                        }
                    },
                    {
                        table: 'sys_user_role_contains'
                        id: '9f30215066984898b199a0c42669ab69'
                        key: {
                            role: {
                                id: '2205bcedeed94c5ab19c1b16c716a095'
                                key: {
                                    name: 'x_335329_secops.operator'
                                }
                            }
                            contains: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '9f914d469b344a46a2f0f5d10fda1dda'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'security_incident_number'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'a0ca7b8a77564ac183a0b0ba6f1eabf4'
                        key: {
                            sys_security_acl: '3cbc2ebc38aa4b0a8b5b3ae8c1c99976'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'a1020937f3e740c881a1d5855a27e693'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'state'
                            value: 'tracked'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'a1b89fdd682f4a51afba7896ccb3332a'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            value: 'number'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'a245b00da2e741aea6f192b547df13f5'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_status'
                            value: 'unknown'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'a2d5d64a1a494334906a86917693944d'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'mandatory'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'a2ff58e99b1d4016a5119eb2a0aee89d'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'state'
                            value: 'new'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'a53591d638854b48a53f045f09d961ef'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                            value: 'contain'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: 'a978293f090a493aabaca1c0e46bf07b'
                        key: {
                            application_file: '0dc97ce258b741999ac9ddc083ce1c63'
                            source_artifact: '7ecb21ca62cd48c6815f00482fe00756'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'a9d8ec3859c346d1865a1ccc698c1883'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'aaa9ec39f567488fbcbec80de9174d11'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'source_record'
                            language: 'en'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: 'ab2e3c92a6c44310b6b26710e695aa9f'
                        key: {
                            name: 'x_335329_secops_endpoints'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'ad76a3543df84c068e25f8ee09d049b3'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'capability'
                            value: 'detonate'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'ad7962fa70394b4184a93c9e76e1bf06'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'adfb31e42c374cdc910bd1335be97c94'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'last_health_message'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'af4e8b3788d14db2b825d4749a46709f'
                        key: {
                            sys_security_acl: '51c6c31b597446ef9ae1936771143d6b'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'af89e75cad504d7a8590e8ee14590bd1'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'ci'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'aff8db58d46549d98c0414b4723ffb63'
                        key: {
                            sys_security_acl: 'ddb16f6181334ffd8cd8fd42f496d958'
                            sys_user_role: {
                                id: '2205bcedeed94c5ab19c1b16c716a095'
                                key: {
                                    name: 'x_335329_secops.operator'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b05e45fd080d478aa683abaf4ce8da31'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'target_table'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b0c95ff1e684414195beca70fabfa1a6'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'endpoint'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b201d363010e4e8bb00b893f6d3f0f3d'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'ci_identifier'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b244c495e5754f9193a8828b0511cf25'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'name'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b2758453871e4786a0754404b7885fe2'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'relevance'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'b311d839d679426abc7def6a01432fea'
                        key: {
                            sys_security_acl: '61a1ffcef8f641a3a160a65a978adfa7'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b38790da6c95425e83f92b9e96997f37'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cve_last_modified'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b3c1d31bc71e4914988c1247cbd5565a'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'target_field'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'b4323dbeff144dafa83a0f6f379b1d04'
                        key: {
                            sys_security_acl: '09b7ca102ca14cc3a2992cbbb110f863'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'b72e1913942549b39940a9fd9499157c'
                        key: {
                            sys_security_acl: 'e9d51974b3ca4c2b8f12066772d6a3ad'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b9abfe7e77fa4005981e551918a6680d'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'order'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b9bd510b2f9c4e1583a9402096392906'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'target_table'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: 'babd0c4954624938bdba9013f46ed255'
                        key: {
                            web_service_operation: '2c99a1399e794168b61c17140f550dd1'
                            web_service_query_parameter: 'd02ab8e0fe2e4cd8a30a2db9db60a9a4'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'bb529bbd4af24f7a98046ad9af2edfcd'
                        key: {
                            sys_security_acl: 'adbe5ff0d1f54471a2e90d1be7eea374'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'bb601004e35e4037a2d2b95cf756af7f'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'relevance'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'bc8e482143f34e18ad56f51816992052'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            value: 'none'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: 'bce2d4f78ed444aca5f9cfcf3b499915'
                        key: {
                            name: 'x_335329_secops_transaction'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'bda761caabc641ddab6375b6eee306a9'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'be25718424c140d5a5ea3db39dbbb309'
                        key: {
                            sys_security_acl: '1f4395ad07694a649ead3b951081ff9b'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'bf8e1f7c2f7f40889ec6147050e1d446'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'cve'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'bfc2c09f4bb546caa6f4c2c804c5b4c9'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'next_retry'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c04305bdbeac4d9094440a9427c8cebf'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'last_seen'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c05f725ee9074240bae8ed95dc4719ff'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'retry_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'c161be00849944d0a61361102695a76b'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'endpoint'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c2b1589683d8490299ef9708a4b0de7f'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'raw_record'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: 'c2f50dd8d75b4d1c90fa56b93f2bd7cc'
                        deleted: true
                        key: {
                            application_file: '8c1a0a1ce9ff47e9b3e736bd7c0d2f2d'
                            source_artifact: '7465717d757e4455a449ccb30c79b694'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'c332182b566c4b69b2580b807b2048cd'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'path'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c44f57b864ff4ff1b4a93501b79ec582'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'c4c8bd5a9bf34ddcb25ba49dbf50a56b'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'max_retries'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'c4f4b0ab650c4da29aa6b0d37502ffd7'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'security_incident_number'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'c5679cbd1cf04baeafc6649be84c075d'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_status'
                            value: 'down'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c61115733f9a49bb9e850c85b58d8650'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'state'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'c6381032ff38427eb2d9a2487213eab3'
                        key: {
                            sys_security_acl: '2e64e511d66a45038dffcb82d629c8ca'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c6bd5714523e44cda9012b73853e5a72'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'active'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'c70a0442ba514284b2140ec28ec26d8f'
                        key: {
                            sys_security_acl: '76b9305a959f41b6a8f9c6aee7c571fe'
                            sys_user_role: {
                                id: '2205bcedeed94c5ab19c1b16c716a095'
                                key: {
                                    name: 'x_335329_secops.operator'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'c808504438b548dca8e30dfc57de0eb2'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'success_codes'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c830884b933740a5ab4b5b9eafdf6397'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'description'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'c887d9b69e934d9b91d4c503dc9db342'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'c9f6daa4af9b4766b53c59f696eacad4'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'active'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'ca16c601e0c148aa808f2ca39e3b589b'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'state'
                            value: 'skipped'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'ca660173e0794e129d8c6a3259b62730'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_type'
                            value: 'oauth2'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_ui_page'
                        id: 'cbb2db7214e94cd2a96d98f3221ec57b'
                        key: {
                            endpoint: 'x_335329_secops_analyst_console.do'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'cbcaec78c10642cb82acccec6e65c820'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                            value: 'critical'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: 'cbf7403fd89a4add8a7435314b74579d'
                        key: {
                            logical_table_name: 'x_335329_secops_transaction'
                            col_name_string: 'state'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'cbfd9514f6694a7c973fe5d87f35bcf5'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cve_id'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'cc3610de2e494fa09dd78ff6a370842c'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'advisory_url'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'cc43843b9b984f35b37f4787504a45eb'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cna'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'cc4a23dd89ef4e6dad30b323c4bc1bba'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'description'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'ccc74329b56d4944b6824b28f139acb9'
                        key: {
                            sys_security_acl: 'ad5880ca9ae14b71bd1e68e75e8e6f53'
                            sys_user_role: {
                                id: '2205bcedeed94c5ab19c1b16c716a095'
                                key: {
                                    name: 'x_335329_secops.operator'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'cd634a51fc224d038e63a429dc677016'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'state'
                            value: 'sir_raised'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'cd79cb57b1df427983c3ec6790617342'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'security_incident'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: 'ce4cf147537148fbb4f77aa96367c3d7'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'auth_type'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'cf6d54715827451ea28fb5da3d13ae17'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'base_url'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'd02795c271974f1b89ee3518a97af137'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'name'
                            language: 'en'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: 'd1506c1048e645eeaa31eec3ffbbe5f9'
                        key: {
                            name: 'x_335329_secops_field_map'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'd20278c20b244ca3a00f5388d46973b7'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'order'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'd3c7b014f6fc4663becac03f53b4b84c'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: 'd4d5031024864148bf5f8f227fe6fc43'
                        key: {
                            logical_table_name: 'x_335329_secops_transaction'
                            col_name_string: 'correlation_id'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'd5f5fccff85b4f8b8d1b7f2a653ba07a'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                            value: 'informational'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: 'd62cae9e51264e9bb5eea0f1d8703097'
                        key: {
                            logical_table_name: 'x_335329_secops_field_map'
                            col_name_string: 'endpoint'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'dabdb78d4d3449f2bc0cfce857971d09'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cve_last_modified'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'daf85d8746684e7ba49cc0a7d780f8e7'
                        key: {
                            sys_security_acl: '3652e8bec33d4d2aa9e544b7deefe164'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'db3a5428651f4c8bb21823914e423a42'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'category'
                            value: 'siem'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'dbad9ca140b3426d835916f4a47ab495'
                        key: {
                            sys_security_acl: 'd640110917074c50b5e7c54981dc3d66'
                            sys_user_role: {
                                id: '2205bcedeed94c5ab19c1b16c716a095'
                                key: {
                                    name: 'x_335329_secops.operator'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'dbcd946a89224b23b8870700dd2375c5'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'description'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'dc4fd2265b8840c09a7ce142f2414ebf'
                        key: {
                            sys_security_acl: '24ae4b78c038429ba305eafd9688123d'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'dd3d35ccba1c482aa382c5355b0a4f74'
                        key: {
                            sys_security_acl: '24ae4b78c038429ba305eafd9688123d'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'dd8a3c81dc114042818e6bc952634241'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            value: 'upper'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'dd95da30e9cb49dab51997e3bd55672e'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'name'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e01d012f14df4327bce922db87142f96'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'fix_versions'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e1578a7fd81444558aacb85e484b2612'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'assessed_version'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'e15ff8bea6074c5996da31ca4138cfeb'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                            value: 'low'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e1fa3ab251bd465a9f6ef69921f77e87'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'transaction'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e257e8f0c3dd4fb6a7cd36b72550b325'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'published'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e35e0f274e8c4319bcb0a167556b3098'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'capability'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e36be7eda0514524afe4141076c0738f'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'title'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'e4548a603e4a4aee936e168f53d8c878'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                            value: 'low'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e464c6dc7a2d46a5910caf60dc3ea75c'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'assessed_version'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e4b7a44d36564f069237ed005a120010'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'source_path'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e5f13d5d3c9042dd9f927c403ca3ff80'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'http_method'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'e683df38d97d4d539b5e5e102e7ba6a6'
                        key: {
                            sys_security_acl: '3ab509d1c5d745538e793c5f53371402'
                            sys_user_role: {
                                id: '199c888755f24e6f8acf1f6f193cd8b3'
                                key: {
                                    name: 'x_335329_secops.viewer'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e69673693983485fbbee0479d520ca27'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'state'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e6b962d8170d4b2a991c1dd78562faf3'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'mid_server'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: 'e77cb61801434ab1bf46558773b785d5'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'state'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: 'e7b1e14c1cd145e2b8e66049200080d6'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'severity'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'e858def0315f4f74af5911271ecb986d'
                        key: {
                            sys_security_acl: 'c97a6e6573064731af9ce87bcbad69b7'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'e9e4ae0b303f45af9d3bb61d446d958d'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                            value: 'critical'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'eade7b8d831a4ab495dbf776d3543dd1'
                        key: {
                            name: 'x_335329_secops_endpoints'
                            element: 'http_method'
                            value: 'get'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'eb5836121b4a481c9b5065e2dd671b1d'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_endpoint_path'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'ebe939f03ddd4a229d96793841133a1c'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'severity'
                            value: 'unknown'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'ed1965ce29354c99b44952526fe07925'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                            value: 'trim'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'ee9decc53dc24a58aa1f04b26acb7064'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'state'
                            value: 'skipped'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'efd270eb42dc4125ad836a47cc6550c1'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'ci'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f2d55e1724fe44a486c3ee98faa5faf7'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'source_path'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'f4ab30983eeb4a05bae46eb53922a97e'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'state'
                            value: 'error'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f4c5d84c964c449ba46025d525bf0084'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'request_summary'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact'
                        id: 'f70b9a4988144beb806234ef1d7699ba'
                        deleted: true
                        key: {
                            name: 'x_335329_secops_dashboard.do - BYOUI Files'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f79f6fef903643928724be6ff87d2272'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'connection_alias'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: 'f842c120fce84e3eb07018a7c1cef113'
                        key: {
                            name: 'x_335329_secops_endpoints'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f8ab0e23d5e247fc958c802f827ec818'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cvss_score'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fab26166aa3b425f96e366c7be1a37dc'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'health_endpoint_path'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'fb91c77d9c664ad8ac2fbe09e227229b'
                        key: {
                            name: 'x_335329_secops_field_map'
                            element: 'transform'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fbe7d8a07ee04c02bb91ba18be1b4664'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'error_message'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'fcd09ab68f194d8a8c2678253487a841'
                        key: {
                            name: 'x_335329_secops_vuln_stage'
                            element: 'ci_identifier'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'fcf3104ea5e541e29af039f1244f6296'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'http_timeout_ms'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'fd4ce1bfac6748cd9cc7a366a5c3ae8a'
                        key: {
                            sys_security_acl: 'a0ce602d24824173bc82343521141e22'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fdc7fc410c7f4876a9a61d61cacb0973'
                        key: {
                            name: 'x_335329_secops_connector'
                            element: 'vendor'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fedbcc60b34d45ac9789eeb6202dd913'
                        key: {
                            name: 'x_335329_secops_cve_watch'
                            element: 'cve_id'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'ff796de8f1ab412d9bb9186ccf75d88b'
                        key: {
                            sys_security_acl: '47e71f7bb64349a8ac70bda8050924e5'
                            sys_user_role: {
                                id: '558c55998de6414d8c13c904c8b69fe6'
                                key: {
                                    name: 'x_335329_secops.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: 'ffe459637c90438495ebcc5fcaeffefc'
                        key: {
                            web_service_operation: '1ad4a8a243d94fcd951f14d38498224f'
                            web_service_query_parameter: 'b3865174ae9b494c93ca2c59dbcd936a'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'fff60a06444140b4b9beedae362ca5bc'
                        key: {
                            name: 'x_335329_secops_transaction'
                            element: 'http_status'
                        }
                    },
                ]
            }
        }
    }
}
