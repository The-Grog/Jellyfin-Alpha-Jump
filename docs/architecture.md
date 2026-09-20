# Alpha Jump prototype architecture

## Boundary

This is a plain injected JavaScript experiment for Jellyfin Web v12.1 modern Movies. It relies on ordinary DOM and browser APIs only. It does not alter Jellyfin source, call a Jellyfin endpoint, manipulate React internals, replace cards, or change playback/normal controls.

The supplied checkout is `jellyfin-web` tag `v12.1`, commit `fae41f33eb7cd636a9ef68984adb82bb247a6e1b`. Source evidence:

- `src/apps/modern/features/libraries/hooks/useLibrary.tsx:36-60` persists a `LibraryViewSettings` object through browser local storage; `utils/settings.ts:30-32` makes the Movies key `Movies - <parentId>`.
- `components/SortButton.tsx:189-203` stores `SortBy`, `SortOrder`, and resets `StartIndex`; `utils/settings.ts:17-27` gives Movies the ascending `SortName` default. `types/library.ts:52-55` defines the required grid value as `ViewMode.GridView = 'grid'`.
- `components/AlphabetPicker.tsx:15-29,59-70` specifies the picker values and its exclusive native change path. `ItemsView.tsx:186-192` clears to `Alphabet: null` and page zero. `utils/items.ts:128-136` omits alphabet query fields for null.
- `components/Pagination.tsx:28-42,50-64` defines native Previous/Next start-index movement and the unavoidable top-of-page scroll. `LibraryToolbar.tsx:75-92,234-241` explains page range, pending bullet, and why disabled buttons alone are insufficient.
- `components/cardbuilder/Card/useCard.ts:52-83,108-111` creates the upper-cased one-to-three-character `data-prefix` from `SortName ?? Name` on card wrappers.

## Public state contract

The script accepts only a route containing `#/movies` and `collectionType=movies`, a `.moviesPage`, exactly one source-shaped picker, exact ascending `SortName`, persisted `ViewMode: 'grid'`, actual Movie cards (or Jellyfin's `.noItemsMessage.centerMessage`), and a source-shaped native pager. List view is not armed. The narrower compatible state deliberately remains available to a one-shot settle observer while Jellyfin temporarily renders its loading component.

The non-alphabet query identity is a canonicalized combination of route hash, `topParentId`, and the full persisted Movies setting excluding only `StartIndex` and `Alphabet`. That preserves all filter fields without having to infer them from localized toolbar text. Mutation observation, `hashchange`, `popstate`, and a document bubble-phase click observer re-read that identity; the click observer schedules after React's ordinary click handling and never suppresses native events. A mismatch cancels the run. Script-owned page movements are recognized only while the next settled state has the same identity and moves the stored `StartIndex` in the expected direction; a trusted user pager click cancels immediately.

This is source-backed but not yet runtime-proven for every filter/search implementation. The script fails closed when a setting cannot be read or a required element is ambiguous.

## Localized pager and settled-page contract

The pager is not found by `Previous`/`Next` labels. The script requires exactly one `button` containing `svg[data-testid="NavigateBeforeIcon"]` and one containing `svg[data-testid="NavigateNextIcon"]`, sharing a parent in a MUI toolbar. Jellyfin pins MUI 6.5.0, whose [`createSvgIcon`](https://raw.githubusercontent.com/mui/material-ui/v6.5.0/packages/mui-material/src/utils/createSvgIcon.js) supplies `data-testid="${displayName}Icon"`; served-page confirmation remains a runtime compatibility gate.

After every ordinary pager click, a one-shot `MutationObserver` waits up to `maxPageSettleMs`; it does not poll. Its `maxNoProgressMs` one-shot timer is reset only when a compact relevant-state snapshot changes: start index, card signature, pending marker, native alphabet value, genuine-empty marker, or Previous disabled state. Unrelated DOM mutations cannot perpetually reset the timer. A page is accepted only when:

1. persisted `StartIndex` has the requested value/direction;
2. the non-alphabet query identity still matches;
3. the v12.1 pending bullet (`∙`) is absent from the toolbar chip;
4. Previous is enabled after a nonzero page and disabled at page zero; and
5. a page change has a new `data-id:data-prefix` signature, or no cards are accompanied by Jellyfin's actual `NoItemsMessage`. The sole same-card exception is native alphabet clear, which additionally requires observed `Alphabet: null` and page zero.

It then confirms once on `requestAnimationFrame`. Only at that point can a disabled Next be treated as the final page; it is never used alone. This contract is intentionally conservative and still requires delayed-response, placeholder, error, and final-page browser evidence.

## Algorithm and cancellation

```text
alphabet click (picker-scoped capture)
  -> if native alphabet is active, allow exactly its one native deselect click
  -> return to page 1 with native Previous, under the total budget
  -> for the requested letter: inspect current card data-prefix values
       -> first startsWith(letter): sticky-header-aware scroll to that card
       -> otherwise: settled native Next, repeat
  -> settled final page without a match: best-effort native restore of start page
```

Every run first uses this settle contract on its current page; `#` and re-clicking the enhancement-selected letter return to page one and scroll to viewport top even if already there. The latter clears enhancement selection. No ordering-based early exit exists because server collation and prefix semantics have not been browser-verified. A run is cancelled on a newer request, route/state identity change, trusted user pager click, Escape, disable, or page-settle failure. It never restores after a query change. All Previous/Next actions share one action/time budget; after exhaustion the result is reported as incomplete.

The picker listener is capture-phase but is attached only to the verified picker group. It prevents the native event only for supported user alphabet clicks. During an enhancement-owned compatible loading state, it also intercepts a newer letter so that request supersedes the run rather than falling through to Jellyfin's native alphabet filter. `nativeClear` permits precisely the script's one selected-button click to reach Jellyfin's ordinary MUI handler; because that clear resets the page, it consumes the same navigation budget. No global event suppression is used.

## Lifecycle and accessibility

One global instance key destroys a previous injection before binding a new one. Surface listeners are detached when the Movies surface changes; detachment removes all enhancement-only class/data/`aria-current` markers before releasing the old picker. The persistent observer/hash/click observers merely re-arm a newly rendered supported Movies view. Enhancement selection stores its query identity and is cleared on an idle filter/sort/search identity change, not only during a run. Its scoped outline/weight style and `aria-current="true"` identify the enhancement selection without writing Jellyfin's native `aria-pressed`/Alphabet state. One-shot settle observers disconnect on resolution, cancellation, or timeout. The Cancel button calls the same cancellation path as Escape and replaces pending feedback with a non-busy cancellation status. There is no `setInterval`.

The small feedback element is `role=status` with `aria-live=polite`; pending work exposes an ordinary Cancel button and Escape cancellation. Scrolling honors `prefers-reduced-motion` and accounts for a header/AppBar height. It does not move keyboard focus.

## Known uncertainty

The source proves the contracts above, not a particular injector/browser runtime. It does not prove source MUI icon `data-testid` values, same-document local-storage timing, React capture behavior for pointer and keyboard activation, the full pending/error surface, or collation across custom SortName/non-ASCII titles. Those remain explicit browser test gates rather than reasons to add private hooks.
