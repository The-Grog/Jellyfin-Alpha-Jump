# Unpaginated Alpha Jump architecture

Date: 2026-09-20. Target source: Jellyfin Web `v12.1`, commit `fae41f33eb7cd636a9ef68984adb82bb247a6e1b`.

## Source evidence

| Fact | v12.1 evidence | Prototype use |
| --- | --- | --- |
| Page size preference | `src/apps/modern/features/preferences/components/LibraryPreferences.tsx:25-43` exposes `libraryPageSize`; source reads unprefixed `localStorage['libraryPageSize']`. In the served authorized session, the page showed the saved-zero unpaginated result while an injected probe saw no such key. | Do not trust the implementation-detail key at runtime. Require a single numeric toolbar total over 100 that equals the count of rendered Movie cards. |
| Zero disables pagination | `src/strings/en-us.json:819-820` explicitly says zero disables pagination and warns of bugs/reduced performance. `src/apps/modern/features/libraries/components/LibraryToolbar.tsx:75-92,234-241` hides pagination when the value is not positive. | Do not alter the preference; do not look for or use pager controls. |
| Item request semantics | `src/utils/items.ts:122-126` converts zero to an omitted `limit`; `src/hooks/useFetchItems.ts:330-347` still supplies `startIndex: libraryViewSettings.StartIndex`. | Require persisted `StartIndex === 0` before interpreting cards as the complete constrained result. |
| Public Movies view settings | `src/apps/modern/features/libraries/hooks/useLibrary.tsx:48-59` uses `getSettingsKey`; `utils/settings.ts:30-32` yields `movies - <parentId>`. | Read, but never write, that public local-storage JSON. |
| Render and readiness | `ItemsView.tsx:186-210` maps alphabet changes to persisted `Alphabet`/`StartIndex`; it renders `Loading` while pending and otherwise Cards or `NoItemsMessage`. `LoadingComponent.tsx` and `loading.ts` provide the spinner; `LibraryToolbar.tsx:62-92` uses the pending bullet. | Require no native alphabet, no pending marker, and cards or the actual no-items message. |
| Card/picker identity | `AlphabetPicker.tsx:37-88` renders the MUI toggle group; `LibraryPage.tsx:13-38` gives Movies `#moviesPage`; `src/utils/items.ts:159-183` emits `data-prefix`. | Identify the exact picker shape and match rendered `data-prefix` with `startsWith`. |

No private React context, query client, network interception, or independent item request is used.

## Support and readiness gates

The script reads public inputs:

1. Route/hash and `#moviesPage` establish Movies scope.
2. `movies - <topParentId>` establishes `ViewMode`, sort, filters/search-related view state, `Alphabet`, and explicit `StartIndex`.
3. The numeric toolbar count and rendered Movie-card count prove the currently shown result is a complete large unpaginated result. The UI setting remains the operator prerequisite, but its storage key is not trusted at runtime.

It arms only for grid + ascending `SortName`, explicit initial index zero, and a complete large unpaginated rendered result. A <=100 result is intentionally unsupported because no DOM-only test can distinguish it from a normally paginated query that happens to fit on one page.

Complete-query readiness is deliberately separate from support. It requires:

- native and stored alphabet state cleared;
- no Movies toolbar pending bullet; and
- at least one Movie card, or Jellyfin's `.noItemsMessage.centerMessage`.

This follows the `ItemsView` render branch above. It does not treat missing cards, a disabled control, or a cleared button alone as proof that replacement results are ready. A native clear is allowed to retain the same cards: its evidence is cleared persisted/native alphabet state plus the normal ready branch, not a forced card-signature change.

## Request flow

```text
picker click (capture, supported state only)
  -> prevent native alphabet handler
  -> latest-request token and accessible “Finding…” state
  -> existing native alphabet? activate that same button once via bypass
  -> MutationObserver + one coalesced animation frame await ready state
  -> first card whose data-prefix startsWith(letter)
  -> scroll with sticky-header/reduced-motion handling; local selection only
```

`#` and a re-click of the local selected letter skip matching, clear local selection, and scroll to zero. The script never presses Previous/Next, restores a page, counts page actions, or infers end-of-list from a pager.

The native-clear bypass is limited to the one programmatic click on the currently pressed native button. All other supported alphabet clicks are intercepted; unsupported clicks continue to native Jellyfin. This also prevents a rapid superseding click during a temporary no-card replacement from accidentally applying a native filter.

## Lifecycle and cleanup

The active result observer is scoped to `#moviesPage` plus the single source-shaped LibraryToolbar that AppLayout renders outside that page; it only considers card/no-items/pending/picker changes and coalesces each mutation burst to one animation frame. A non-suppressing page-scoped click observer schedules the same check after native toolbar/filter/sort/pager interactions, so a cached same-card query change is still noticed. A small document observer only notices insertion/removal of `#moviesPage` so the result observer can be attached after SPA navigation. It does not discover or rescan cards.

Each request has an overall timeout and a readiness timeout, both cancellable. A route/hash or query-identity change cancels current work. Query identity contains route, parent, page size, and all persisted view settings except native `Alphabet`; the latter is handled separately because a native clear is expected. It also clears idle enhancement selection after a completed-query change.

`destroy()` removes capture/key/route listeners, both observers, timeouts/animation frames, feedback, injected style, and only enhancement-owned `alpha-jump-selected`, `data-alpha-jump-selected`, and `aria-current` markers. It does not change Jellyfin's native selection or preferences.

## Historical paging experiment

The earlier prototype returned to page one with native Previous and scanned native Next pages. It was accepted only as a visible-transition experiment, then superseded after v12.1 source inspection established page size zero. Its pager discovery, pager activation, page settling, page budgets, and restoration logic have been removed. It is evidence that replacing pagination cannot produce the original continuously scrollable Plex-style experience—not an instruction for this implementation.

## Remaining runtime evidence

Source confirms the request and render paths, but it does not prove served-DOM compatibility, event ordering for browser-generated keyboard clicks, nor full-library performance. Those remain explicit browser checks in [testing.md](testing.md).
