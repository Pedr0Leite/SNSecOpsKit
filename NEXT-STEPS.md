# Next steps

Deferred work, with enough context to pick it up cold. Ordered roughly by value.

---

## Deferred by decision

### Trend point drill-in
**Status:** deferred 2026-09-12 — agreed to ship the other drill-ins first.

Every other chart datum on the security overview carries a `table` + encoded query, so clicking it
opens an ACL-filtered drill-in. Trend charts do not: the line is a single SVG path with no per-day
hit targets.

To finish it:
- Render an invisible `<rect>` per data point across the full chart height, each one a hit target.
- Give each point the query it represents — for incidents,
  `opened_at>=javascript:gs.dateGenerate('YYYY-MM-DD','00:00:00')^opened_at<...` for that day; for
  transactions, the same on `sys_created_on`.
- Keyboard: the chart needs to become focusable with arrow-key movement between points, or the
  points need to be exposed as a parallel visually-hidden list. A mouse-only drill-in would be the
  one inaccessible interaction on the page.

`src/client/components/charts/Charts.tsx` → `Trend`.

### Free-form panel drag and resize
**Status:** deliberately not built.

The overview supports reordering and preset widths (third / half / two-thirds / full) rather than
free pixel resizing. Discrete widths remove collision and compaction maths entirely and keep the
grid tidy.

If free-form is ever wanted, use `react-grid-layout` rather than hand-rolling it — but budget for
~40 KB, theming its CSS across all three themes, and building a keyboard alternative, because its
own keyboard story is weak.

---

## Known gaps

### Vulnerability Response promotion is untested against real VR
`SecOpsVulnIngestionHandler.promote()` is unit-tested both ways (VR present and absent) but has
never run against real `sn_vul_*` tables, because VR is not installed on dev296062. Before relying
on it, verify on a VR-enabled instance:
- `sn_vul_third_party_entry` accepts `id`, `source`, `summary`
- `sn_vul_vulnerable_item` accepts `vulnerability`, `cmdb_ci`, `source`
- Add the `sn_vul` cross-scope privileges (deliberately not shipped — the scope does not exist
  without the subscription). See `docs/07-vulnerability-response.md`.

### Enrichment, detonation and containment have never called a real API
All three are unit-tested against a mocked `RESTMessageV2` and have never touched a live third
party. The first real connector will surface auth and payload-shape issues no mock can predict.

### No ATF tests
Verification is Node unit tests plus live smoke tests. Certification does not require ATF, but
reviewers view it favourably.

### Domain separation untested
`sys_domain` exists on the SecOps tables this app writes to, but nothing here has been tested in a
domain-separated instance. An MSSP deployment needs that before it can be trusted.

### Bundle size
`main.jsdbx` ~846 KB, `overview.jsdbx` ~625 KB, unminified, each carrying its own React copy. Two
easy wins if it matters: enable minification for production builds, and configure a shared vendor
chunk so the second page hits browser cache instead of re-downloading React.

---

## Before a Store submission

These are blocking and cannot be resolved from this repo — full detail in
`docs/06-store-certification.md`.

1. **Vendor prefix.** The scope is `x_335329_secops`, which is this *development instance's* prefix.
   Rename to your ServiceNow-assigned publisher prefix. This changes every table, role and property
   name — do it before accumulating customer data.
2. **Contact Support module** — replace the placeholder `mailto:` in `src/fluent/ui/navigation.now.ts`.
3. **Declare dependencies** on the SIR dependency plugin (`com.snc.si_dep`), and VR if required.
4. **Run the Certification Self-Test Tool** on the vendor instance.
5. **Write the formal Test Plan** tracing each acceptance criterion to a result.
6. **Exercise uninstall and upgrade** on a clean instance.
7. **Decide licensing** — `now.config.json` has no `licensing` block, so platform defaults apply.

---

## Housekeeping

### Demo data on dev296062
Seeded for development: 5 security incidents (`SIR0010003`-`SIR0010008`) and 4 vulnerability
findings from source `DemoScanner`. Remove when no longer useful.

### `styles.generated.ts` is committed on purpose
The SDK type-checks before running the prebuild script, so the generated stylesheet module must
already exist on a clean checkout. `now.prebuild.mjs` rewrites it from `styles.css` on every build —
edit the CSS, never the generated file.
