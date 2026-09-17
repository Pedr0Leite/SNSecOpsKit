# The analyst console and security overview

Two React + TypeScript pages, one shared component library, both hosted in ServiceNow UI Pages.

| Page | URL | Answers | Audience |
|---|---|---|---|
| **Analyst console** | `/x_335329_secops_analyst_console.do` | What needs *my* attention right now? | Tier 1/2 analysts |
| **Security overview** | `/x_335329_secops_security_overview.do` | How is the *programme* doing? | Managers, CISO, team leads |

They are separate pages rather than two tabs of one, because the audience differs — and separate
pages mean separate ACLs, so the overview can later be opened to managers without also handing them
the analyst console.

The console itself has two tabs: **Queue** (the work list) and **My metrics** (charts scoped to
whatever the analyst is currently filtered to). Both pages support drilling into a charted value and
rearranging their panels — see below.

## Why a UI Page and not a portal widget or UI Builder

| Option | Verdict |
|---|---|
| **UI Page** (chosen) | A blank canvas. Nothing else is on the page — no Angular, no Bootstrap 3, no jQuery, no portal theme CSS — so React Aria's overlays and focus management work as designed and the three themes are not fighting inherited styles. |
| Service Portal widget | Workable, but React would live inside an AngularJS app and inherit Bootstrap's globals. The Matrix theme in particular would be an override war. |
| UI Builder / UX Framework | ServiceNow's strategic surface, but it does **not** run React — it runs the Now Experience UI Framework. React was a requirement here, so UIB was out. |

The usual objection to UI Pages is Jelly XSS. It does not apply: the page is a `<div id="root">` and a
script tag with **zero Jelly expressions and no server-side interpolation**. All data arrives over
REST after mount, already ACL-filtered. `direct: true` renders it without platform chrome.

> **The ACL trap.** The SDK derives `sys_ui_page.name` from the endpoint by stripping the scope
> prefix and `.do`, and a `ui_page` ACL matches on that **name**. An endpoint of
> `x_335329_secops_dashboard.do` yields the name `dashboard` — generic enough to collide with
> another application's page. Worse, an ACL whose name does not match protects *nothing*, silently.
> The endpoint is therefore `x_335329_secops_analyst_console.do`, giving the name `analyst_console`,
> and the ACL matches it exactly.

## How it gets its data

Two different paths, chosen deliberately:

```
                     ┌──────────────────────────────────────────┐
  aggregated reads   │  GET /api/x_335329_secops/secops_console │
  ─────────────────▶ │      /work        /connectors            │
                     │  scoped app · GlideRecordSecure          │
                     └──────────────────────────────────────────┘

                     ┌──────────────────────────────────────────┐
  record read+write  │  GET/PATCH /api/now/table/{table}/{id}   │
  ─────────────────▶ │  platform Table API · the USER's session │
                     └──────────────────────────────────────────┘
```

**Aggregation goes through the app** because merging three sources, normalising severity and
resolving group membership is server work, and `GlideRecordSecure` keeps it ACL-correct.

**Editing goes straight to the Table API under the signed-in user's session.** This means the
console never acts with elevated rights and can never become a privilege-escalation path into SIR;
ACLs and data policies apply exactly as they would on the real form; and the application needs no
cross-scope **write** privilege at all. A user who cannot write a field gets a 403 — which is the
correct answer, and the pane shows it rather than pretending the save worked.

## What it shows

**The severity spine.** Rows sit flush with no gap, each with a left border in its severity colour,
so the stripe is contiguous and the shape of the queue is readable before any text is. Density is
the feature — a triage surface should show twenty rows, not six cards.

**Scopes**

| Scope | Query |
|---|---|
| Assigned to me | `assigned_to = me` |
| My team | `assigned_to = me OR assignment_group IN (my groups)` |
| Everything | no ownership filter |

Group membership is read from `sys_user_grmember` because `GlideUser.getMyGroups()` is not callable
from a scoped application. The API returns a `groups` count so "my team" can say it found no groups
rather than silently behaving like "assigned to me" — the two are otherwise indistinguishable.

**Sources**: Security Incidents, SIR Tasks, and this application's vulnerability findings.
A source that is not installed is skipped, not fatal — the console works on an instance without SIR.

**Severity normalisation.** SIR's `severity` is 1=High / 2=Medium / 3=Low with no critical tier, so a
`priority` of 1 is elevated to critical. An unset severity becomes `info`, never a guess.

**Sort order**: most severe first, then longest dwelling — the order an analyst actually triages in.

## The record pane

Selecting a row splits the surface: queue left, record right. The list drops its middle columns
rather than shrinking them, so rows stay readable instead of turning into ellipses.

- **Open record** (top right) opens the real platform form in a new tab.
- Editable inline: short description, state, priority, severity, description, work notes.
- **Assign to me** sets the assignee without a reference picker.
- Saving refreshes the queue behind the pane, because an edit can change severity, state or
  assignment — the row should not keep showing what it used to say.

Reference fields are deliberately **not** editable here. A correct reference picker needs typeahead,
and SIR additionally validates that the assignee belongs to the assignment group (its "Group change
validation" business rule aborts the write otherwise). "Assign to me" covers the action analysts
actually take; **Open record** covers everything else. This pane is a triage surface, not a
replacement for the form.

## Charts

Hand-rolled SVG, no charting library. Three reasons:

1. **Theming.** Colours are CSS custom properties applied through `fill`/`stroke`, so switching to
   Matrix is a pure CSS change with no re-render. A charting library wants explicit colour values
   and would need a JS-computed palette rebuilt on every theme switch.
2. **Weight.** Recharts would add ~100 KB to a bundle already carrying React and React Aria.
3. **Simplicity.** The chart types needed here — horizontal bars, a stacked bar, a donut, a trend
   area — are a few dozen lines of geometry each.

The maths lives in `charts/geometry.ts` as pure functions and is unit-tested
(`test/charts-geometry.test.ts`, run through Node's native TypeScript stripping). Chart bugs fail
silently — a `NaN` in an SVG `d` attribute renders nothing at all — so the tests assert explicitly
that no path ever contains `NaN`, that a full-circle donut slice is emitted as two arcs rather than
one degenerate one, and that the aging buckets split on their documented boundaries.

Every chart is `role="img"` with a text alternative stating the actual numbers. A chart a screen
reader cannot read is decoration, not information.

### Console — "My metrics" tab

Computed **entirely from the rows already on screen**. No extra request, and it can never disagree
with the list beneath it — a chart that contradicts the list above it destroys trust in both. It
follows the current scope and filters, so it answers "how am I doing?" for whatever the analyst is
looking at: severity mix, dwell distribution, oldest item, median dwell, work type split.

## Drilling into a value

Clicking a charted value shows the records behind it. Both pages do it; they do it differently,
because they count differently.

| | Console — My metrics | Overview |
|---|---|---|
| Where the number comes from | rows already loaded | `GlideAggregate`, server-side |
| What a click opens | the **Queue** tab, filtered to exactly those records | a read-only pane beside the charts |
| What the drill knows | the exact `sys_id`s | a table + encoded query |
| Can the list disagree with the number? | **No** — same rows | Yes, for a restricted viewer, and it says so |

The console sends the reader to the queue rather than opening a second list beside the charts. The
queue already opens and edits records; a read-only pane next to it would be a worse copy of a list
that exists three feet away. A banner names what was clicked and offers the way back to the full
queue, and changing any filter clears the pinned set — those ids answered a different question.

Because the console drills by `sys_id`, its numbers and its lists are the same data, so there is no
access gap to explain. The overview has one, and states it out loud:

> Showing 3 of 12. You do not have access to the other 9.

Both facts are true: the chart is a real organisation-wide total, and the list is ACL-filtered.
Honesty here is the whole point — a dashboard that quietly shrank its totals to whatever the viewer
can see would be a different, and wrong, number.

**Legends are the click target** for donuts and stacked bars. Segments are often a few pixels wide —
unreliable with a mouse, unreachable by keyboard. A legend entry is always a comfortable size and
lands in the tab order for free.

A grouping value containing `^` or `,` renders as a plain, non-clickable bar. Those characters are
structural in an encoded query, and a drill-in that silently matched the wrong records would be
worse than one that is not offered.

**`query` is three-valued**, and the difference is load-bearing:

| Value | Means |
|---|---|
| a filter string | drill into those records |
| `` (empty) | drill into the **whole table** — a headline total with no filter is still a real list |
| `null` | **not** drillable: the grouping value could not be expressed as a safe query |

That distinction is what lets the headline totals drill. `Boolean(query)` would have collapsed the
first two cases together and left every unfiltered total dead.

## Editable layout

Both pages let a user rearrange their own panels: **Edit layout** → drag to reorder (or use the
arrow buttons), set a width of 1/3, 1/2, 2/3 or Full, hide a panel, **Reset**.

Widths are discrete fractions over a six-column grid rather than free pixels. That removes collision
and compaction maths entirely, and the grid stays tidy whatever a user does to it.

Layouts persist in `sys_user_preference` — platform-native, upgrade-safe, and with known-good ACLs,
since users write their own preferences constantly. Two things to know:

> **A preference written without an explicit `user` is global.** One analyst's layout would silently
> become the default for everyone. Both pages therefore pass the signed-in user's `sys_id`, which the
> `/overview` and `/work` APIs return for exactly this purpose. `user=javascript:gs.getUserID()` in
> the query does **not** work here either — it matches nothing, so the layout would never load back.

Each page stores its own row (`x_335329_secops.console.layout`, `x_335329_secops.overview.layout`),
so the two never overwrite each other. A stored layout is reconciled against the panels the app
currently defines: a panel added in a later release appears for users who already have a saved
layout, and a panel that no longer exists is dropped rather than rendering blank.

### Overview — organisation-wide

Server-side aggregates from `SecOpsMetrics`, refreshed every two minutes:

- **Incidents** — open count, severity mix (priority 1 counts as critical, matching the queue),
  aging buckets, load by assignment group, state distribution, 14-day opened trend
- **Findings** — severity mix, by source feed, most affected assets, unmatched-CI count
- **Integration** — connector health, call success rate, average duration, calls by capability, and
  a 14-day throughput trend split into successful and failed

That last group is the part no other dashboard on the instance can produce. Performance Analytics
can tell a CISO how many incidents are open; only this application knows whether the tooling feeding
those incidents is actually working.

> **Aggregates are role-gated, not ACL-filtered per record.** `GlideAggregate` does not apply
> record-level ACLs. This is normal for a reporting surface — Performance Analytics behaves the same
> way — and the control is the role gate on both the page and the API. Only counts, group names and
> severities are returned; no record content. If per-record confidentiality is ever required here,
> it must move to `GlideRecordSecure` and accept the cost.

Trend scans are capped at 5,000 rows over the window and report `truncated` when the cap is hit, so
the chart says so rather than quietly understating volume.

## Themes

Three, switched by `data-theme` on `<html>`, persisted in `localStorage`, defaulting to the OS
preference. Every colour is a token — no component hardcodes a hex value, which is what makes a new
theme a data change rather than a rewrite.

| Theme | Base | Notes |
|---|---|---|
| Daylight | `#f7f8fa` / ink `#1b2030` | Cool slate, deliberately not a warm cream |
| Night | `#12161f` / ink `#e4e8f1` | Blue-tinted, deliberately not a tinted near-black |
| Matrix | `#000000` / ink `#33ff66` | Phosphor glow and a scanline overlay — one flourish, not many. Severity collapses to green intensities with one alarm red, because a critical must still break the palette. |

Typography is a system stack, with monospace reserved for machine data — hashes, CVEs, IPs,
correlation IDs — where it genuinely aids comparison. No web font is loaded: an offline or
Store-deployed instance should not reach a font CDN.

## Accessibility

React Aria Components supply the semantics: `RadioGroup` for scope and theme, `CheckboxGroup` for
sources and severities, `SearchField`, `GridList` for the queue, `Button`. Keyboard navigation,
focus management and screen-reader announcements come from the library rather than from hand-rolled
`div` handlers. Choice fields in the record pane use a native `<select>` — correct everywhere, and a
custom listbox would add weight without adding anything a user notices.

`prefers-reduced-motion` is respected; focus is always visible.

## Build

`src/client/**/*.html` are rollup entry points, bundled by `now.prebuild.mjs` into `dist/static/`
and published under the app's public path. The UI Page Fluent record imports the same
`index.html`, so the page and the bundle cannot drift apart.

```bash
npm run build     # bundles the client, then the Fluent metadata
npm run deploy
```

Current bundle: ~807 KB unminified. If a charts tab is added, load its library with a dynamic
import so the queue does not pay for it.
