# Alpha Jump prototype testing record

Date: 2026-09-20

## What was actually run

| Check | Result | Evidence |
| --- | --- | --- |
| Required project documents and R1–R6 were read | Passed | `PROJECT-MILESTONES.md`, `docs/feasibility.md` reviewed before implementation. |
| Pinned source inspection | Passed | Local `jellyfin-web-v12.1` package reports 12.1.0; feasibility records clean tag `v12.1` / `fae41f33eb7cd636a9ef68984adb82bb247a6e1b`. Relevant source paths are cited in `docs/architecture.md`. |
| Browser test environment discovery | Blocked | The authorized in-app browser had no open test tab. No live server was opened, injected, restarted, or changed. |
| Syntax/static check | Passed | `node --check src\\alpha-jump.js` and focused static regression assertions for all pre-browser review rounds completed successfully on 2026-09-20. `git diff --check` also completed successfully (line-ending warnings only). This does not replace browser behavior tests. |

No browser behavior below has been marked passed. In particular, source review is not a substitute for an actual control/event/load test.

## Required browser checklist

Use an authorized disposable test session with Jellyfin Server/Web version, browser version, injector version, and Jellyfin Enhanced state recorded first. Observe DevTools Network and console; do not test by installing into production.

| Scenario | Expected evidence | Status |
| --- | --- | --- |
| Initial support guard | Only modern Movies, exact ascending SortName, one picker, cards, and icon-identified pager arm. Unsupported sort/layout stays entirely native. | Not run |
| List-view regression | With persisted `ViewMode: "list"`, no picker click is intercepted. Grid with cards and grid with Jellyfin's actual empty-result message remain eligible. | Not run |
| Pointer and keyboard alphabet activation | A supported click/Enter/Space does not issue `nameStartsWith`/`nameLessThan`; no unrelated picker or app control is suppressed. | Not run |
| Existing native alphabet | The selected native button clears once through Jellyfin; stored `Alphabet` becomes null, then the full constrained list is scanned. | Not run |
| Z → A | Start at a late page, request A, confirm native Previous returns page one before scan and the first full-query A is selected. | Not run |
| Group spanning pages | Arrange a letter (for example M) across two pages; confirm first M on the first matching page wins. | Not run |
| Pending/placeholder/final page | Simulate slow fetch/cache placeholder/error. Confirm the initial page settles before scanning; pending bullet, missing cards without `NoItemsMessage`, and disabled buttons do not end the scan; final disabled Next only ends after a settled page. | Not run |
| Rapid request / route exit | A→Z→M and navigate away while loading. Only M may complete; stale completions do not scroll or restore. | Not run |
| Latest request while loading | Click a second letter while cards are temporarily absent during an enhancement-owned replacement. The second request supersedes; no native alphabet filter is applied. | Not run |
| Sort/filter/search change | Change each during a scan. It cancels and never restores into the changed query; non-alphabet constraints remain in the network request. | Not run |
| User paging | Click native Previous/Next during a run. Script cancels and ordinary Jellyfin paging continues. | Not run |
| # and selected re-click | `#` reaches page one without native alphabet state. Re-clicking selected enhancement letter returns page one and clears local selection. | Not run |
| Same-card native clear | In a library/query where every result starts with the current native letter, clear succeeds after `Alphabet: null`/page-zero evidence even though card IDs are unchanged. | Not run |
| Idle query change | Complete an M jump, then change a filter/search/sort and click M. The second click starts a new M search rather than toggling the old selection. | Not run |
| Missing, empty, non-alpha titles | Missing letter announces absence only after settled end; empty list settles without a card; numerals/punctuation and non-ASCII/custom SortName behavior is documented rather than guessed. | Not run |
| Budgets and restoration | Exhaust time/action budget in scanning and restoration. Message says incomplete, not missing; restoration is bounded and best effort. | Not run |
| Stalled progress | Cause unrelated page DOM churn while start index, cards, pending state, native alphabet, empty marker, and Previous state remain unchanged. `maxNoProgressMs` must still stop the transition. | Not run |
| Duplicate injection and SPA round-trip | Reinject, Movies→detail→Movies, Movies→Home→Movies. Exactly one active picker listener/observer surface and no stale local selection. | Not run |
| Visual/accessibility | Narrow and desktop view, sticky header, reduced motion, status/cancel, Escape, playback, card selection, menus, and Jellyfin Enhanced enabled/disabled. | Not run |
| Enhancement selection | After a successful jump, selected letter is visibly marked and exposes `aria-current="true"`; native `aria-pressed`/stored Alphabet remain unchanged. | Not run |
| Marker cleanup | Change to an unsupported sort, navigate away, and call destroy. The old picker has no `alpha-jump-selected`, `data-alpha-jump-selected`, or `aria-current` marker. | Not run |
| Cancel feedback | Start a long jump and click the status Cancel button. Pending “Finding…” text and its Cancel button are replaced by a non-busy cancellation status. | Not run |

## Exact next test setup

1. Provide or open an authorized non-production Jellyfin 12.1 browser tab containing a Movies library with more than one page and a known cross-page letter group.
2. Record its Server/Web/browser/Injector/Enhanced versions and preserve a network HAR or screenshots of the ordinary query parameters and page transitions.
3. Paste `src/alpha-jump.js` only into that session’s DevTools console, perform the checklist in order, and record each outcome here with timestamps and defects.
4. If source-shaped icon, local-storage, event, or settle assumptions fail, stop the prototype rather than adding React/internal-API workarounds.

## First Firefox runtime finding — 2026-09-20

User-supplied console evidence found the picker and both pager icons, but activation failed because the prototype used an uppercase settings key and a class selector for the page. The actual key is `movies - <parentId>` and the container is `div#moviesPage`. The diagnostic found 80 Movie cards, all with data-prefix. Corrected the key and page/card/empty-result selectors; the lowercase key is also confirmed by upstream LibraryTab.Movies. Re-injection and functional jump behavior remain untested after this correction.
