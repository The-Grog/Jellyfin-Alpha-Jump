# Jellyfin Alpha Jump feasibility — Milestone 1

Date: 2026-09-18; implementation update: 2026-09-20  
Decision after review: **Accepted only for a local, pagination-based prototype; not a continuous-library solution.** The user explicitly accepted visible native page transitions for this experiment. Runtime proof of the critical loading/state/interception contracts remains incomplete; this update creates no live installation or deployment.

## Scope and evidence boundary

This investigation was read-only. No JavaScript was installed, no server configuration was changed, and no server/container was restarted. The browser interaction only opened Movies, exercised the native `C` toggle and its native clear action, advanced one native page, and returned to the initial page.

The local instance reports Jellyfin Server **12.1.0**. Its bundled web assets are present under `/usr/share/jellyfin/web`; the visible Movies route is `#/movies?topParentId=…&collectionType=movies`. The subsequently supplied local upstream checkout is clean, resolves exactly to tag **`v12.1`**, and records commit **`fae41f33eb7cd636a9ef68984adb82bb247a6e1b`**. Source references below use that checkout.

The local page also loads JavaScript Injector (`/JavaScriptInjector/public.js`, version not exposed in the page) and Jellyfin Enhanced **12.7.0.0-639247594740000000**. Enhanced added `je-*` DOM/style markers and header controls during observation.

## Runtime findings recorded by the initial investigation

The subsequent document/source review did not repeat these browser observations. They are the initial investigator's recorded evidence, not independent runtime verification by the reviewer.

### Modern Movies surface

- The supported modern route is a React-rendered Movies page with a `moviesPage` container. The initial view reported `1-100 of 1,538`.
- The picker is not an `AlphabetPicker` custom element and is not an input. It is a MUI vertical `div[role="group"].MuiToggleButtonGroup-vertical` inside `.alphaPicker-fixed-right`, containing `button[type="button"][value="#"|"A"…"Z"]` elements. The selected letter has `aria-pressed="true"`. Source: `src/apps/modern/features/libraries/components/AlphabetPicker.tsx:15-29, 59-88`.
- Native selection of `C` changed the count to `82`, marked `C` pressed, and replaced the page contents with matching results. Clicking `C` again made it unpressed and restored the unfiltered `1-100 of 1,538` page. The route hash did not expose the alphabet state.
- Source confirms that the native picker calls `onChange(newValue)`, and `ItemsView` stores `{ StartIndex: 0, Alphabet: newValue }`. An exclusive MUI ToggleButtonGroup supplies `null` for a deselected active letter. `getAlphaPickerQuery` converts a `null` alphabet to omitted `nameStartsWith`/`nameLessThan`; `#` becomes `nameLessThan: 'A'`. Sources: `AlphabetPicker.tsx:21-29`; `ItemsView.tsx:186-192`; `src/utils/items.ts:128-136`.
- Modern card **wrappers** are `.card[data-prefix][data-id][data-type="Movie"]`. The previous runtime inspection looked at inner title links, not wrappers. Source proves `data-prefix` is the uppercased first one-to-three characters of `item.SortName ?? item.Name`; it is passed to the wrapper through `getDataAttributes`. Sources: `src/components/cardbuilder/Card/useCard.ts:52-83, 108-111`; `src/utils/items.ts:159-183`; `CardWrapper.tsx:15-26`.
- The default Movie sort is `[ItemSortBy.SortName]` ascending, and the toolbar’s sort action resets `StartIndex` when it changes. Source: `src/apps/modern/features/libraries/utils/settings.ts:9-27`; `components/SortButton.tsx:189-203`. The server’s exact equivalence between `nameStartsWith` and the card `SortName` prefix, including accents/non-Latin normalization, still needs browser/API validation.

### Paging and loading

- This view uses explicit, replacing pagination rather than appended pages or observed virtualization. Its toolbar exposes `Previous` and `Next` buttons.
- Native `Next` changed the range from `1-100 of 1,538` to `101-200 of 1,538`; `Previous` restored the original range. The page replacement means a sequential late-letter scan would visibly move the viewport/page. Only one page transition was tested.
- Source confirms the ordinary UI paging contract: Next updates persisted `StartIndex` by the configured page size and calls `window.scrollTo(0, 0)`; Previous subtracts the page size; Next is disabled when `index + pageSize >= total`. Sources: `src/apps/modern/features/libraries/components/Pagination.tsx:28-42, 50-64`; `LibraryToolbar.tsx:75-92, 234-241`. The item query uses the current complete `LibraryViewSettings` as part of its React Query key and calls the SDK `getItems` request with filters, limit, alphabet, sort, and `startIndex`. Sources: `src/hooks/useFetchItems.ts:330-355, 361-416`; `src/utils/items.ts:122-155`.

## Source-verified state and remaining browser questions

- `LibraryProvider` persists `LibraryViewSettings` in local storage under a view/library-specific key. This explains saved/restored native alphabet state and confirms that clearing it through its ordinary UI path affects browser-local state, not a server-side setting. Source: `src/apps/modern/features/libraries/hooks/useLibrary.tsx:36-60`; `utils/settings.ts:30-32`.
- Movies obtains alphabet-picker capability from the default view content, and only renders it when the viewport is at least the component’s defined size and the current sort is not random. Sources: `constants/views/defaults.ts:3-14`; `ItemsView.tsx:41-49, 194-210`.
- Source verifies that filters, sort, alphabet, start index, and page size participate in the item request. The modern Movies route does not expose that local state in its hash. A browser test is still needed to establish an injection-safe signal for every filter/search/sort change and to inspect the live request URL/response/error behavior.
- Source verifies JSX-level native `onChange`, but does not itself prove that a script’s picker-scoped native capture listener prevents React’s synthetic handler for both pointer and keyboard-generated clicks. That must be proved before enabling interception on a live page.
- Pagination always calls `window.scrollTo(0, 0)`; a script that presses native Next cannot make late-letter scans visually invisible. It can restore an anchor after a missing-letter scan, but every intermediate page transition can still be visible.

## Feasibility gates

| Gate | Result | Evidence / limitation |
| --- | --- | --- |
| Prevent native alphabet filtering | Source-supported; browser proof required | `AlphabetPicker` has one React `onChange` path and the picker has a narrow wrapper class. Use only a scoped capture listener, then keep native behavior if the browser proof fails. |
| Handle active/restored alphabet state | Source-supported | An active second click yields `null`, resets `StartIndex`, and omits the server alphabet fields. It is persisted in browser-local view settings, so clear it only through the native control before an enhancement jump. |
| Find an unloaded destination with bounded work | Source-supported | Native Next advances configured page size, disables at end, and card wrappers expose `data-prefix` from `SortName`/`Name`. It remains replacing pagination with visible top-of-page jumps. |
| Preserve unsupported states / recover on failure | Source-supported; browser proof required | Movies, supported picker wrapper/values, non-random ascending SortName, current page metadata, and native disabled state are viable gates. Query/lifecycle signals and localized control discovery remain browser validation work. |

## Provisional architecture — requires correction before implementation

The forward-only sequence below is retained as the reviewed proposal, not an approved algorithm. R2 requires backward/first-page navigation and cross-page first-match handling; R3 requires distinguishing settled results from temporary disabled pagination; R4 requires distinguishing script-owned transitions from user changes.

Use a single idempotent browser script that observes the SPA and only arms when all of these are true: Movies route, `moviesPage`, exactly one `.alphaPicker-fixed-right` vertical MUI letter group with the expected values, `.card[data-prefix][data-type="Movie"]` wrappers, and verified ascending `[SortName]` order. Locale-dependent page controls must be treated as unsupported until an accessible/stable control identity is verified.

Attach picker-scoped capture listeners only after a browser proves them safe. Maintain enhancement-owned selection state; do not write an alphabet query. On a request, first clear an already-active native alphabet state through its ordinary verified UI path, wait for the unfiltered matching query to settle, inspect current-page `.card[data-prefix]` values, then invoke the ordinary native Next control one page at a time. Each transition must wait for a changed range/card set, detect disabled Next/error/no-progress, and stop on cancellation, route/query change, time/page limits, target, or end of list. Scroll only to a found card; restore the saved initial page/anchor if a missing-letter scan had to replace pages.

This design must use `data-prefix`, not card display text, for candidate selection, but it must not assume server `nameStartsWith` normalization and SortName-prefix normalization are identical beyond the tested English ASCII cases. It must not call private React state or issue independent API requests in the first proof of concept.

## Proposed defaults for later review

- Missing letter: keep the current position when already present; if a scan replaced pages, restore the initial page and initial scroll anchor where possible; clear enhancement selection and announce `No matching titles` via a short `aria-live` message.
- Selected letter: selecting the enhancement-selected letter clears its local selection and returns to the beginning through the verified native pager, without setting a native alphabet filter.
- `#`: return to the first page of the full constrained query.
- Cancellation: latest request wins; cancel on a new letter, route/query/filter/search/sort change, or explicit Escape/cancel control. Never cancel unrelated Jellyfin fetches.
- Bounds: begin with 20 native page requests, 30 seconds elapsed time, and two consecutive no-progress observations. These are proposed limits, not tested values; count Next activations, not observer ticks.
- Feedback: a small, scoped `aria-live="polite"` pending/error message plus an accessible Cancel button while a scan is active.

## Browser validation still required

Validate the exact browser, Injector version, and Enhanced 12.7.0.0 feature set. Test pointer/keyboard activation, saved active alphabet state, filter/search/sort changes mid-scan, navigation away, rapid requests, failures, end-of-list, missing letters, reduced motion, narrow layouts, custom sort titles, and all title-character categories. Verify request parameters and that the enhancement does not retain or create a native alphabet filter.

## Recommendation

Keep Milestone 1 open for the scope decision and feasibility gaps below. A pagination-based prototype may be viable, but it does not establish the original continuous-library experience. Begin Milestone 2 only after scope acceptance and supporting evidence for the interception, navigation, loading, and state contracts. Later compatibility testing must not substitute for these feasibility decisions.

## Review findings and closure tracking

Review date: 2026-09-18. Method: review of this document and supplied local source, including `ItemsView.tsx`, `Pagination.tsx`, `LibraryToolbar.tsx`, `useLibrary.tsx`, `useCard.ts`, and `utils/items.ts`. No browser tests were repeated, implementation created, or live service changed during this review.

Local source root: `jellyfin source/upstream/jellyfin-web-v12.1/`. Outside reviewers can consult the [pinned upstream source](https://github.com/jellyfin/jellyfin-web/tree/fae41f33eb7cd636a9ef68984adb82bb247a6e1b). Source paths above are relative to that root.

| ID | Priority / status | Finding | Required closure evidence |
| --- | --- | --- | --- |
| R1 | High — accepted limited prototype scope | Replacing pages does not preserve an accumulated, continuously scrollable library. Automatic page navigation followed by an in-page scroll materially changes the original Plex-style goal. | **2026-09-20 acceptance:** user authorized a local prototype that uses existing Previous/Next controls, accepts visible transitions, and explicitly says it does not establish the Plex-style experience. This resolves scope authorization only; it is not a claim of browser success or broader product acceptance. |
| R2 | High — implementation resolution; browser evidence open | Forward-only scanning misses A when starting at Z. If M spans pages, the first visible M may not be the first M in the query. | `src/alpha-jump.js` clears native alphabet, walks native Previous to `StartIndex: 0`, then scans native Next pages in order. It has no passed-letter exit. Static syntax passed; Z -> A and a cross-page group remain browser tests. |
| R3 | High — corrected implementation contract; browser evidence open | Disabled Next is not end-of-list proof. `LibraryToolbar.tsx:234-241` also disables paging for pending requests, placeholder data, and pagination not being required. A changed range/card set can be transitional. | The corrected prototype first settles the initial page and then requires expected `StartIndex`/direction, unchanged query identity, no v12.1 pending bullet, exact expected Previous state, and changed cards or actual `.noItemsMessage.centerMessage` before considering Next disabled. Native clear is the narrow same-card exception and requires `Alphabet: null`. Source/static evidence only; delayed/placeholder/error/final-page browser tests remain open. |
| R4 | High — corrected implementation contract; browser evidence open | The injection-safe sort/query signal is unspecified. Cancelling on every query change would cancel script-owned page advances; missing user changes can act on the wrong results. | The prototype reads public `Movies - <parentId>` local-storage settings and route hash, excluding only `StartIndex`/`Alphabet` from the non-alphabet identity. Mutation, route, and a non-suppressing bubble-phase click observer re-read it after normal React click handling; trusted user pager clicks and identity mismatches cancel. Selection now also tracks idle query identity. Pointer/keyboard, filter/search, and timing behavior remain browser-test gates. |
| R5 | Medium — implementation policy; browser evidence open | Next-only accounting omits returning to page one and restoring the starting page. Two no-progress observations have no defined timing. | The prototype has one action/time budget covering native clear, Previous, Next, and same-query best-effort restoration; one-shot `maxPageSettleMs` and relevant-change `maxNoProgressMs` timers replace observer-tick counting. Exhaustion reports incomplete. Static syntax passed; budget/recovery behavior remains browser testing. |
| R6 | Medium — implementation resolution; browser evidence open | `data-prefix` contains up to three characters; equality with a single letter is incorrect. Collation is still unproved. | The prototype uses `String(card.dataset.prefix || '').startsWith(letter)` and makes no ordering/collation exit. Static syntax passed; multi-character, custom SortName, punctuation, accented, and non-Latin browser tests remain open. |

The proposed defaults above remain proposals and are subject to these findings. Native alphabet clearing also needs a narrowly scoped bypass of the enhancement's own interception, with native and enhancement selection tracked separately. Source support alone does not close the pointer/keyboard interception or locale-safe pager-discovery gates. Enhanced DOM markers do not establish compatibility.

## Outside-review checklist

- [x] R1: limited prototype scope accepted by the user on 2026-09-20; this does not accept a continuous-library replacement.
- [ ] R2: review the corrected algorithm and first-match boundary cases.
- [ ] R3–R4: review concrete loading/state signals and browser evidence.
- [ ] R5: review complete budgets, cancellation precedence, and recovery behavior.
- [ ] R6: verify matching semantics and any early-exit assumptions.
- [ ] Verify native-clear bypass, pointer/keyboard interception, and locale-safe controls.
- [ ] Record reviewer, date, evidence links, and decisions; do not close findings because implementation is merely planned.

Implementation correction, 2026-09-20: review found pre-browser correctness defects in the first draft: list-view arming, function-based Previous guards, unproven empty views, unstabilized initial pages, same-card native clears, top scrolling, and idle selection identity. `src/alpha-jump.js` now requires grid view, verifies Previous state against actual expected page direction, permits absent cards only with Jellyfin's `NoItemsMessage`, settles before scanning, verifies `Alphabet: null` for same-card clear, explicitly scrolls top, and clears idle selection on query identity change. These are source/static implementation corrections, not completed browser validations. No live deployment has been authorized or performed.
