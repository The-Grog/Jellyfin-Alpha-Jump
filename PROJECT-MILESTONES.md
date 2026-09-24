# Jellyfin Alpha Jump — milestone tracker and prompts

Status: revised local Milestone 2 prototype created for review. Browser validation remains gated on the runtime evidence in `docs/feasibility.md` and `docs/testing.md`.

Goal: change the Movies alphabet picker from filtering by letter to jumping within the items matching the current non-alphabet filters, while preserving Jellyfin's existing appearance and renderer.

Initial target: Jellyfin Web v12.1. Broader 12.x compatibility must be verified separately. Initial delivery is browser-side JavaScript suitable for JavaScript Injector; a standalone server plugin is out of scope.

## Tracking

Run one milestone at a time. Completion of a prompt does not authorize the next milestone or installation on a live server.

| Milestone | Status | Evidence / decisions |
| --- | --- | --- |
| 1. Source inspection and feasibility | Revised source evidence recorded; runtime gates remain | The user accepted the page-size-zero native unpaginated experiment on 2026-09-20. R1 is scope-accepted; R2-R6 are updated in `docs/feasibility.md`. No performance or served-browser claim. |
| 2. Minimal working proof of concept | Corrected locally; fresh served automatic-setup test pending | The old unprefixed storage-key gate could not arm in the served saved-zero state. The revised prototype uses the verified active-user key only for configuration, and requires explicit `StartIndex: 0`, grid/ascending SortName, and toolbar/card equality before jumping. Native pager scanning remains removed. |
| 3. Browser validation and hardening | Started; automatic preference behavior untested | Authorized Jellyfin 12.1 testing observed 1,538 toolbar results and 1,538 Movie cards with no pager, while the old Injector copy saw no unprefixed key and let A use native filtering. The local correction and automatic setup/restore paths pass deterministic tests; served automatic reload, request inspection, performance, and coexistence remain open. |
| 4. Reviewable first distribution | Release infrastructure prepared; first tag not published | Root manifest, CI, tag-release workflow, minimal-DLL packaging, checksum, and manifest-update flow are locally reviewed. No real tag, release, installation, or restart was performed. |

## Expanded compatible-library scope — 2026-09-23

The initial Movies/Shows-only browser registry is superseded by a narrower
source-backed multi-library registry. It supports the tested 12.1 grids for
Movies, Shows, Books/Audiobooks, built-in Collections, Home Videos (including
its photo tabs), Mixed, Music albums, Music Videos, and top-level Playlists.
It remains grid-only, ascending `SortName` only, with explicit `StartIndex: 0`
and a complete renderer-owned allowed-card count. The registry excludes Live
TV, standalone Photos (the pinned source labels its page unused), detail pages,
song lists, suggestions, genres, people, artists/authors, episodes/upcoming,
and embedded playlists. These exclusions retain native Jellyfin behavior.

Plugin discovery now displays every valid virtual folder, creates persisted
selections only for types with a source-backed registry route, and shows the
rest disabled with an explanation. The built-in Collections view uses an
explicit separate setting rather than a fabricated virtual-folder ID. Folder
types—not names—decide whether a downloaded YouTube library can be selected.
Empty/`unknown` collection types map to Mixed only as established by pinned
Web source. This is local source/test evidence only; no server installation,
restart, or live browser test is implied. The support matrix and browser
validation checklist are in `README.md`, `docs/architecture.md`, and
`docs/testing.md`.

Final local validation on 2026-09-23: JavaScript syntax passed; Node
production-path suite **88/88**; Release C# suite **24/24**; release ABI
metadata validation passed for 12.1.0.0; and `git diff --check` passed. The
Release production build succeeded with one `NU1900` vulnerability-data warning
because this environment could not reach NuGet. No live-server/browser result
is claimed.

## 2026-09-20 revised prototype decision

The prior Previous/Next page scan is preserved as historical evidence only. The accepted local experiment instead requires the user to set **Library page size = 0** manually, allows Jellyfin Web to load/render the full currently constrained Movies result, then scrolls to the first matching rendered `data-prefix`. This neither changes server/user preferences nor adds fetching, virtualization, React hooks, API interception, packaging, or deployment.

The resulting local implementation must fail closed when page size is not zero, persisted Movies `StartIndex` is not explicitly zero, results are not demonstrably ready, or the supported Movies grid/sort/picker shape is unavailable. Readiness, native-clear timing, request parameters, browser performance, and Enhanced coexistence remain Milestone 3 browser tests.

Suggested model use: Terra High for milestones 1–3; Terra Medium for routine documentation and packaging. Request a Sol or Astra review if the design remains ambiguous or repeated attempts do not explain a failure. These are starting recommendations, not guarantees of model performance or usage savings. Do not delegate automatically.

## Shared requirements

- Support the browser-based modern Movies view first, in ascending title/name order only. Detect the actual sort field and ordering from evidence.
- Preserve non-alphabet filters and applicable search constraints. “Full library” means all items matching those constraints, without an alphabet filter.
- Unsupported layouts, sorts, clients, and uncertain states retain native Jellyfin behavior. Do not enable Shows, Collections, Music, or Audiobooks yet.
- Inspect actual source and runtime behavior. Do not assume `AlphabetPicker`, `ItemsView`, `data-prefix`, `Alphabet = null`, or any suggested selector is an available or stable hook.
- Prefer existing loading paths and small DOM/event hooks. Do not replace the renderer, manipulate private React internals, patch large parts of React, or edit Jellyfin source files to deliver the enhancement.
- Avoid recurring polling, brittle positional selectors, global event suppression, and unnecessary UI changes.
- Reuse Jellyfin's styling where practical; scope added styles, listeners, and observers to this enhancement.
- Preserve playback, card selection, context menus, filters, search, normal scrolling, and Jellyfin Enhanced behavior.
- Source inspection and local work do not authorize installation, deployment, server restart, repository publication, or changes to a live Jellyfin instance.
- Record exact versions, source references, verified facts, assumptions, blockers, and test results. Never claim compatibility from code inspection alone.

## Milestone 1 — source inspection and feasibility

Copy this prompt when ready to begin investigation:

```text
Investigate the feasibility of Jellyfin Alpha Jump. Follow the shared requirements in PROJECT-MILESTONES.md. This milestone is investigation only: do not scaffold the implementation, create src/dist files, install anything, or change my Jellyfin server.

Inspect jellyfin/jellyfin-web at the exact v12.1 tag and record its commit. Browse upstream or use a separate temporary inspection checkout. Verify that the source was retrieved successfully; do not substitute another version silently. Inspect JavaScript Injector and Jellyfin Enhanced documentation/source as needed, recording versions or commits.

Trace and document:
1. The modern Movies route, library view, AlphabetPicker, ItemsView or equivalent, and card builder.
2. The alphabet activation event path and how it changes query state, including saved/restored alphabet filters.
3. The meaning of clearing the alphabet value: null, undefined, an empty value, or another representation. Determine whether injection can clear existing alphabet state through an ordinary supported UI/event path.
4. Actual card attributes, especially whether data-prefix exists in this view and how it is derived. Investigate custom sort titles, ignored articles, numbers, punctuation, and accented/non-Latin names.
5. The scroll container and loading mechanism: appended pages, explicit pagination, virtualization, or another design. Distinguish loaded items from rendered cards.
6. Exactly how another page is requested, how completion/end-of-list/error is observed, and whether injection can trigger the existing path reliably without private React access. Assess whether doing so causes visible viewport jumps.
7. How to detect the supported Movies view, ascending title order, filter/query changes, and SPA lifecycle transitions.
8. Potential collisions with Jellyfin Enhanced and how compatibility would be tested.

Provide exact source paths, line references or permalinks, event names, selectors, and attributes where verified. Separate source-verified facts from behavior that still requires browser testing. If source retrieval is blocked, report the missing evidence rather than invent hooks.

Evaluate these feasibility gates:
- Can native alphabet filtering be prevented for both pointer and keyboard activation without suppressing unrelated behavior?
- Can an already-active/restored alphabet filter be handled safely?
- Can additional items be loaded and the destination found with bounded work?
- Can unsupported states retain native behavior and failed operations leave the picker usable?

Recommend the smallest viable architecture. If a gate cannot be met, describe the blocker and the smallest alternatives; do not force a brittle DOM workaround merely to satisfy the proposed architecture.

Explicitly discuss the performance limit: a sequential jump to Z may load nearly the entire matching library. No constant-time jump or broad large-library performance claim is required.

Create docs/feasibility.md and update the milestone tracker with findings, unresolved questions, and a recommended go/no-go decision. Propose concrete initial defaults for missing letters, active-letter toggling, cancellation, loading bounds, and error feedback. Stop after the report for review; do not begin implementation.
```

Acceptance:

- [ ] Exact target source and commit recorded.
- [ ] Proposed interception, state handling, loading, and lifecycle hooks supported by evidence.
- [ ] Ordering and loaded-versus-rendered assumptions resolved or explicitly blocked.
- [ ] Browser-only verification needs and Enhanced compatibility risks recorded.
- [ ] Go/no-go recommendation reviewed before milestone 2.

## Milestone 2 — minimal working proof of concept

Use only after accepting the feasibility approach:

```text
Build the smallest functional Jellyfin Alpha Jump proof of concept using the reviewed docs/feasibility.md and shared requirements in PROJECT-MILESTONES.md. First confirm R1 scope acceptance and reviewed resolutions for R2–R6, including supporting evidence for critical loading/state/interception hooks. The previous go recommendation is superseded. If a critical hook remains unverified, resolve it or report the blocker before implementing dependent behavior.

Implement plain modern JavaScript for injection into Jellyfin Web v12.1. Support only the verified modern Movies view in ascending title order. Preserve the existing renderer and alphabet picker's appearance.

Behavior:
- Intercept alphabet activation only when support is confidently established. Prevent native alphabet filtering using the verified event path.
- Handle an existing alphabet filter using the reviewed mechanism. Do not pretend blocking future clicks clears saved React/query state.
- Keep all other filters and applicable search constraints intact.
- Jump to the first item in the requested group if available. Prefer verified data-prefix metadata; use a documented fallback only if needed.
- Otherwise request additional pages through the verified existing loading path. Use observed progress/completion, not fixed-delay guesses.
- Stop on a verified destination, end of results, cancellation, timeout, or loading budget. Use a 'passed the letter' early exit only if its ordering semantics have been demonstrated to agree with the server.
- Default missing-letter behavior: leave the current position unchanged where possible, clear pending selection, and show a small accessible 'No matching titles' message. If loading requires moving the viewport, restore the initial anchor when possible. Document any unavoidable limitation.
- '#' goes to the beginning of the matching list, with no alphabet filter.
- Clicking the selected letter again goes to the beginning and clears the enhancement's selection.
- Keep visual selection local to the enhancement; never persist it as Jellyfin's native Alphabet filter. Clear it on query/view changes.
- Latest request wins. Cancel pending jump work when a new letter is selected, the route changes, filters/sort/search change, or the script is disabled. Ignore stale completions; do not cancel unrelated Jellyfin requests.
- Provide minimal accessible pending/error feedback and a way to cancel a long jump. Keep feedback consistent with the existing UI.
- Respect reduced-motion preferences, sticky-header offsets, and keyboard activation. Avoid moving keyboard focus unexpectedly.

Use a top-level configuration object with enabled, moviesOnly, smoothScroll, debug, respectSortOrder, and explicit page-load/time/no-progress limits. Define the units and semantics of each limit. Count real page-load requests rather than observation ticks. Do not use setInterval polling. Debug logs use [AlphaJump]; debug=false emits only actual errors. Never log credentials or tokens.

Make initialization idempotent and cleanup explicit. Survive SPA navigation and repeated injection without duplicate handlers or observers. A load failure must stop work and leave normal navigation usable. Unsupported states must not be intercepted.

Create only the files needed for this milestone: src/alpha-jump.js, a short development README, and docs/architecture.md. Add focused automated checks only where they meaningfully verify logic such as cancellation or supported ordering; do not write tests that merely repeat the implementation.

Update PROJECT-MILESTONES.md with implemented behavior, validation performed, and remaining uncertainty. Do not claim a browser-tested working milestone unless it was actually exercised. Do not install on my live server or publish anything. Stop at the proof-of-concept checkpoint.
```

Acceptance:

- [ ] Supported clicks do not apply native alphabet filtering.
- [ ] Already-loaded and unloaded destinations work in the supported view.
- [ ] Loading bounds, stale-result handling, and cancellation implemented.
- [ ] Unsupported views retain native behavior.
- [ ] Proof-of-concept evidence and remaining limitations recorded.

## Milestone 3 — browser validation and hardening

```text
Validate and harden the existing Jellyfin Alpha Jump proof of concept. Follow PROJECT-MILESTONES.md and the reviewed architecture. Keep the scope at Movies with ascending title order.

Use an authorized test environment. If none is available, identify the exact access/setup needed and complete independent local checks; do not change a live server to manufacture a test environment. Do not mark unexecuted tests as passing.

Record Jellyfin Server, Jellyfin Web, browser, injector, and Jellyfin Enhanced versions where relevant. Inspect network requests or equivalent evidence to confirm that enhancement-controlled jumps do not add native alphabet filtering, that non-alphabet constraints remain, and that additional loads stop appropriately.

Create docs/testing.md with results, evidence, and a manual checklist covering:
1. Enter Movies; jump to an already-rendered A. Start on a late page and jump Z -> A; verify the first item of a letter group spanning multiple pages.
2. Jump to an unloaded M and to Z in a large library; record pages/items loaded and elapsed time.
3. Click # and click the selected letter again.
4. Request a missing letter; test an empty library and results without alphabetic titles.
5. Home -> Movies -> item detail -> Movies -> Home -> Movies.
6. Ascending title sort versus descending title and unrelated sorts.
7. Apply, change, and clear filters; change applicable search constraints during loading.
8. Start with a saved/native alphabet filter already active.
9. Rapid A -> Z -> M requests; navigate away while loading; cancel a jump.
10. Slow loading, load failure, no progress, end-of-list, and loading budget exhaustion.
11. Playback, card selection, context menus, and ordinary infinite scrolling.
12. Jellyfin Enhanced enabled and disabled; record the features exercised.
13. Repeated injection/navigation: no duplicate listeners, observers, or stale selection.
14. Keyboard activation, reduced motion, narrow mobile and desktop layouts, sticky-header positioning.
15. Custom sort titles, ignored articles, accented/non-Latin names, numbers, and punctuation.
16. Unsupported library types and layouts retain native behavior.

Fix defects found within scope and rerun affected checks. If testing disproves the architecture, document that finding instead of layering private React patches or unrelated renderer changes onto it.

Update the tracker and architecture notes. Report verified behavior separately from outstanding tests and blockers. Stop before packaging or deployment.
```

Acceptance:

- [ ] Core browser flows and request behavior verified.
- [ ] Race, lifecycle, failure, and large-library cases exercised.
- [ ] Enhanced compatibility reported for exact tested versions/features.
- [ ] Remaining failures and untested combinations clearly listed.

## Milestone 4 — reviewable first distribution

```text
Prepare a reviewable first distribution of Jellyfin Alpha Jump from the validated implementation. Follow PROJECT-MILESTONES.md. Do not publish a repository/release or install/restart anything on my server.

Complete this file layout:
README.md
LICENSE
PROJECT-MILESTONES.md
src/alpha-jump.js
dist/alpha-jump.js
docs/feasibility.md
docs/architecture.md
docs/testing.md

Use MIT for original project code. Preserve any required third-party notices and flag licensing conflicts rather than copying incompatible upstream code into an MIT file. Do not invent a copyright holder.

Keep src/alpha-jump.js as the source of truth. No build framework is needed: document a deterministic copy step for dist/alpha-jump.js and verify byte-for-byte equality before delivery.

README must explain the purpose, supported view/order, exact tested versions, JavaScript Injector installation steps verified against its current documentation, configuration, disabling/uninstalling, debug logging, known limitations, Enhanced compatibility evidence, and troubleshooting. Distinguish removing this script from uninstalling the Injector plugin. Explain the potential cost of sequentially loading to late letters and clarify that native clients are outside this browser-only scope.

Check that the distribution contains no credentials, private server addresses, personal media data, or temporary source-inspection checkouts. Report the architecture, files, checks completed, remaining uncertainty, and the exact manual installation/test steps for user review.

Update the milestone tracker honestly. Unexecuted validation stays outstanding, even if packaging is complete. Stop with the local distribution ready for review.
```

Acceptance:

- [ ] README, license, architecture, and test records complete.
- [ ] Distribution matches source exactly.
- [ ] Tested versions and known limitations are explicit.
- [ ] Local artifact ready for review; no publication or live installation performed.

## Decision and evidence log

Current decision: a local, reviewable Milestone 2 prototype is authorized under the accepted pagination scope. Earlier decisions below are retained as history. Browser validation and distribution remain separate gates; the current finding register and outside-review checklist are in `docs/feasibility.md`.

- 2026-09-18 — Review: the pagination-based proposal differs from the original continuous-library goal. Scope acceptance is pending. R1–R6 track the scope mismatch, backward/cross-page first-match navigation, loading versus end detection, script-owned versus user state changes, complete navigation/restoration budgets, and prefix matching. Local source was checked; prior browser observations were not independently repeated. No implementation or deployment started.

Add dated entries as work proceeds. For each decision, record the evidence, chosen behavior, and any unresolved limitation.

- 2026-09-22 — Public plugin-distribution infrastructure: added the root Jellyfin repository manifest with an intentionally empty release list (no fake URL/checksum), GitHub Actions CI, and a four-part version-tag release workflow. The workflow validates JS/C#, builds with the tag version, packages only `Jellyfin.Plugin.AlphaJump.dll`, calculates MD5/SHA-256, creates/uploads a GitHub Release, and commits a newest-first real manifest entry on `main`. A maintained Jellyfin 12 plugin repository (`TheIntroDB/jellyfin-plugin`) was inspected for the array manifest, `targetAbi: 12.0.0.0`, real MD5, and release-update convention. `manifest.json` parsed successfully and `actionlint` passed for both workflows. No actual tag, release, repository publication, plugin installation, or server restart occurred. Branch protection that disallows `GITHUB_TOKEN` pushes to `main` remains a repository-setting blocker for automatic manifest commits.

- 2026-09-20 — Milestone 2 local prototype: user accepted the narrower visible-pagination experiment (R1) but not a continuously scrollable experience. Implemented bounded page-one scan, starts-with prefix matching, native-clear bypass, cancellation, local selection, and best-effort same-query restoration in `src/alpha-jump.js`. Pre-browser review corrections added the required grid-view guard, explicit Previous-state and genuine-empty-result settle guards, initial settling, same-card native-clear evidence, top scrolling, idle query-identity selection reset, compatible-loading latest-request interception, snapshot-based no-progress detection, visible/accessibly exposed enhancement-only selection, marker cleanup on detach/destroy, and Cancel feedback cleanup. Source inspection supports public local-storage settings (`Movies - <parentId>`), MUI picker/pager structure, pending bullet, and card prefixes. An authorized test browser was unavailable, so no pointer/keyboard, settle, query-change, or actual page-transition behavior is claimed as passed; see `docs/testing.md`. No live system changed.

- 2026-09-20 — Milestone 2 revised local prototype: after inspecting v12.1 `libraryPageSize`, its documented zero-pagination mode, `getLimitQuery()`, and retained `StartIndex`, the user accepted a page-size-zero native unpaginated experiment. Replaced the page scanner with a fail-closed, rendered-card scroll approach. The script requires public `libraryPageSize = 0`, `movies - <parentId>` settings with explicit `StartIndex: 0`, modern grid/ascending SortName, a source-shaped picker, and source-shaped ready results. It contains no pager discovery/activation, restoration, action budget, independent request, or React access. Node syntax, six focused deterministic tests, and `git diff --check` passed; browser execution/performance remains untested. No server preference was changed and no injector install, commit, push, or publication occurred.

- 2026-09-21 — Milestone 3 controlled-browser follow-up: the user saved the UI page size to zero. Served Movies then showed toolbar total 1,538, no pager, and exactly 1,538 Movie-card wrappers, while the existing injected probe still saw no `libraryPageSize` storage key. The old Injector copy consequently failed to arm and A applied native filtering (73 results). Corrected local support logic to require the observed complete large rendered result rather than that missing key; Node syntax and all six focused production-path tests passed. JavaScript Injector Import rejected a standalone JS file because it expects exported JSON, so no automatic overwrite was made. A fresh corrected served click remains required; no request, performance, commit, push, or publication claim is made.

- Planning: investigation precedes implementation; no live deployment is authorized by these prompts.
- 2026-09-18 — Milestone 1: Read-only local runtime inspection confirmed Jellyfin Server 12.1.0 and the modern Movies route. Native alphabet filtering changes the result set; clicking the active toggle clears it. Movies replaces explicit 100-item pages (`1-100` to `101-200`) through native Previous/Next controls, so late-letter scanning would visibly move pages. Inner Movie title links contain `data-id`, `data-serverid`, and `data-type="Movie"`; displayed text alone cannot safely reproduce native grouping. Jellyfin Enhanced 12.7.0.0 and JavaScript Injector are active. External upstream checkout was stopped, so source-level event/query/prefix semantics were initially unverified. Decision: conditional no-go pending source inspection; see `docs/feasibility.md`.
- 2026-09-18 — Milestone 1 follow-up: supplied local source checkout verified clean `jellyfin-web` `v12.1` at `fae41f33eb7cd636a9ef68984adb82bb247a6e1b`. `AlphabetPicker` emits `null` on deselection; `ItemsView` persists `Alphabet` and resets `StartIndex`; the query omits alphabet fields for `null` and uses `nameLessThan=A` for `#`. Modern `.card` wrappers carry `data-prefix` from uppercased `SortName` or `Name`; the earlier runtime observation inspected inner title links, so it was corrected. Native pagination updates `StartIndex`, fetches the current full settings, disables at end, and always scrolls to top. Decision revised to go recommended, constrained by fail-closed browser proof of interception, query/lifecycle detection, localized pager discovery, and server/card prefix equivalence; see `docs/feasibility.md`.

- 2026-09-21 — Automatic page-size configuration local implementation: v12.1 source corrected the historical unprefixed `libraryPageSize` assumption. `userSettings.libraryPageSize()` passes the current user to `appSettings`, whose key is `<userId>-libraryPageSize`; `ServerConnections` exposes that active client as public `window.ApiClient`. The local prototype now defaults `autoDisablePagination` to true, backs up only the exact signed-in user/origin value (including absence), writes/verifies zero, and permits one session-scoped reload. It has explicit matching-user restoration and does not reapply after a same-session user change or restore. Preference configuration remains separate from card completeness: toolbar/card equality, explicit StartIndex zero, grid, and ascending SortName still gate jumps; small results are supported only by equality, never by a >100 heuristic. Local syntax, `git diff --check`, and 16 deterministic production-path tests passed. No live preference, Injector configuration, server, commit, push, or publication was changed. Served automatic setup/reload/restoration, user switching, and performance remain validation gates.

## Shows extension — 2026-09-21

Added modern Shows main-tab support using the pinned v12.1 LibraryRoutes (/tv, CollectionType.Tvshows, LibraryTab.Series), LibraryPage (#tvshowsPage), and useCurrentTab/getDefaultViewIndex semantics. View settings are series - <parentId>; cards are data-type="Series". Explicit nonzero tabs and non-Series saved landing views stay native. Local tests cover Series jumping and tab/config opt-outs alongside the Movies suite. Live Shows testing remains pending; no Injector entry was changed by this implementation.

## Server-plugin prototype — 2026-09-21

Added a reviewable `plugin/Jellyfin.Plugin.AlphaJump` project and a separate xUnit project without installing, restarting, packaging, committing, pushing, publishing, or changing JavaScript Injector. The project pins the Jellyfin 12.1 plugin ABI packages (`Jellyfin.Controller`/`Jellyfin.Model` `12.1.0`) and `net10.0`, embeds `src/alpha-jump.js` at build time, exposes an admin dashboard configuration page, and uses stable collection-folder GUID selections with an auto-enable-new fallback. It injects one base-path-aware bootstrap/script tag only into normal `/web` index HTML using `IPluginServiceRegistrator` plus a stock ASP.NET Core `IStartupFilter`; API/media paths are passed through. The browser script now has a plugin mode that validates an authenticated per-library config contract before it configures pagination or intercepts a picker; failed config leaves native behavior rather than falling back to standalone defaults. Node syntax and 28 focused JS tests pass; diff whitespace check passes. C# build/xUnit and served injection are untested because this host has no .NET SDK (its newest installed runtime is .NET 8), and server-side target behavior must be tested with a .NET 10 SDK on an approved disposable server. Plugin support is limited to Movies and Shows; JellyTweaks/Jellyfin Enhanced/File Transformation/cache/compression compatibility remains open.

### SDK validation update — 2026-09-21

The user installed .NET SDK `10.0.401`. The production plugin restored and built against Jellyfin 12.1.0 packages with zero warnings/errors. The initial xUnit execution correctly identified missing server-provided runtime assemblies in the standalone test host; adding test-only direct references fixed the host without changing the production project's runtime exclusions. The C# suite then passed 5/5. The Node suite still passes 28/28. `NuGet.config` makes restore independent of an inaccessible developer-profile configuration. This resolves the local compilation/test gate only; no plugin has been installed, no server restarted, and all served-server/browser/cache/compression/other-plugin compatibility findings remain open.

### Focused plugin review corrections — 2026-09-21

Corrected the plugin review findings without installation, restart, commit, push, or publication. XML persistence now uses `LibrarySelectionRecord` values, with a real XML round-trip test. Library IDs are normalized to Jellyfin Web's unhyphenated GUID spelling in the server, dashboard, and browser script; matching and mismatched spellings have automated coverage. The actual injection middleware now handles root and configured-base raw Web-index paths (including `/jellyfin/web/index.html`) and has request/response-pipeline tests for injection, duplicate prevention, and API/media pass-through. Selection discovery uses Jellyfin's `ILibraryManager`, persists initial/new supported-library decisions once, serializes discovery with dashboard saves, shows unsupported libraries disabled with an explanation, and preserves rename/deleted/explicit-selection behavior. Local validation now reports Node **29/29**, C# **9/9**, and C# build **0 warnings/0 errors**. This resolves the reviewed code/test-host defects only. Served server startup ordering, actual base-URL delivery, dashboard authorization/rendering, cache/compression, browser behavior, and third-party-plugin compatibility remain open and require a controlled installation test.

### Focused plugin follow-up corrections — 2026-09-21

Corrected two additional review findings without any server action. Global disable now affects only runtime client configuration: dashboard rows retain their persisted per-library enabled/disabled choice, preventing a save while globally disabled from erasing selections. Plugin browser startup now treats a missing or not-yet-authenticated public `ApiClient` as temporary readiness, with at most eight short timeout retries that cancel on navigation or destroy; malformed/failed configuration responses remain fail-closed. The Node suite passed **30/30**, the Release C# build passed with **0 warnings/0 errors**, C# tests passed **9/9**, and `git diff --check` passed. Served dashboard and early-startup behavior remain controlled-installation test requirements.

## Optional keyboard alphabet jump — 2026-09-24

Implemented a global, XML-persisted keyboard mode with fail-closed exact values:
`prefix` (the default; Shift+J then A-Z/# within two seconds), `off`, and
`plain` (direct A-Z/#). The admin dashboard exposes the supported select and
the browser/server configuration contract is now version 3; stale v2 browser
scripts retain native behavior until refreshed. The existing document capture
listener now routes an owned keyboard request through the same picker
activation/execution path, including native alphabet clearing, readiness,
latest-request cancellation, # behavior, and scrolling. It rejects editable
targets, focused controls, modal/action-sheet UI, repeat/composition/modifier
events, unsupported states, and all uncertain context. Prefix state has an
accessible non-focusable notice and cleans up on expiry, Escape, unrelated
input, focus/blur/visibility, query/navigation changes, detach, destroy, and
reinjection. Local `node --check`, **94/94** JavaScript tests, Release C# build,
and **31/31** C# tests passed; build warnings were only unavailable NuGet
vulnerability metadata. No server install, dashboard use, browser test,
restart, commit, tag, push, or publication occurred. Controlled browser and
Enhanced coexistence verification remain Milestone 3 work.
