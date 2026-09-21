# Feasibility and finding register

Date: 2026-09-20. Source inspected: local Jellyfin Web `v12.1`, `fae41f33eb7cd636a9ef68984adb82bb247a6e1b`.

## Revised accepted scope

The user accepted a different local experiment from the original pagination scan:

- Alpha Jump defaults `autoDisablePagination` to `true`, setting the signed-in user's browser/origin-local Library page size to `0` once and reloading once.
- Jellyfin natively loads/renders the complete current Movies result.
- The enhancement intercepts a supported alphabet click and scrolls among those cards.
- Full-library browser cost is accepted for investigation, but has not passed performance testing.

This does not establish a continuously scrollable Plex-style experience, a general Injector rollout, or compatibility beyond the specified Web version.

## Source-verified feasibility

`LibraryPreferences.tsx:25-43` exposes `libraryPageSize`; `en-us.json:819-820` documents zero as disabling pagination and warns of bugs/reduced performance. `userSettings.js:105-134,517-527` passes its current user ID to `appSettings`, and `appSettings.js:6-11,263-273` stores the client-local value under `<userId>-libraryPageSize`; missing values default to 100. `ServerConnections.js:92-99` exposes the active client as `window.ApiClient`, whose public `getCurrentUserId()` is used by Dashboard. `utils/items.ts:122-126` turns zero into an omitted request limit. `useFetchItems.ts:330-347` still passes `StartIndex`, so preference configuration alone cannot prove the first query slice.

For Movies, `useLibrary.tsx:48-59` and `utils/settings.ts:30-32` yield public local-storage key `movies - <parentId>`. `LibraryPage.tsx:13-38` assigns `#moviesPage`; `ItemsView.tsx:186-210` renders Loading while pending, then Cards or `NoItemsMessage`; `AlphabetPicker.tsx:37-88` supplies the native MUI picker. These facts justify the fail-closed support/readiness model in [architecture.md](architecture.md), not a claim that the browser’s served DOM has passed it.

## R1–R6

| ID | Current status | Evidence and remaining closure |
| --- | --- | --- |
| R1 | Accepted for revised limited scope | On 2026-09-20 the user accepted page size zero / native full-result rendering. The old visible page-scanning scope is historical only. Performance and actual continuous-library behavior are not validated. |
| R2 | Resolved in local design; browser evidence open | No paging remains. With `limit` omitted and explicit `StartIndex: 0`, the algorithm inspects the first matching card in one rendered constrained result. Browser network and multi-thousand-card verification remain required. |
| R3 | Resolved in local design; browser evidence open | Empty DOM is rejected. Readiness requires no pending signal and cards or Jellyfin's actual no-items message. A disabled pager is no longer relevant. Delayed loading and cache/placeholder behavior need browser proof. |
| R4 | Resolved in local design; browser evidence open | Query identity comes from the route plus public Movies settings; a native alphabet clear is the sole expected excluded setting change. Latest-request tokens prevent stale completion. Event ordering and filter/search mutations need browser proof. |
| R5 | Superseded | Page navigation/restoration budgets are removed because the implementation never pages. Bounded cancellable readiness and whole-request timeouts remain. |
| R6 | Resolved in local design; semantic validation open | Matching is literal `data-prefix.startsWith(letter)` with no passed-letter exit. Custom sort names, punctuation, accent, and non-Latin semantics must be observed in the target browser/library. |

## Fail-closed prerequisites

The enhancement retains native behavior when the signed-in identity is unavailable/ambiguous; user-local storage or its matching backup fails; explicit StartIndex is missing/nonzero; the Movies settings key cannot be read; grid/ascending SortName is absent; the picker/page is ambiguous; the toolbar/card counts do not prove a complete rendered result; or a result has not become ready. It never adjusts server settings. It changes only the active user's client-local page-size preference, once per session unless the user explicitly restores it.

Small libraries and constrained results of 100 or fewer are supported only when the numeric toolbar total exactly equals the rendered Movie-card count and no query is pending. A count above 100 is not substitute evidence. An initial native alphabet subset remains native until an alphabet-clear result for that same query has been proven in the current page session.

### 2026-09-21 served-browser prerequisite result

The authorized Jellyfin 12.1 browser session later confirmed a saved-zero visual state with one `#moviesPage`, one 27-button picker, grid/ascending SortName, explicit `StartIndex: 0`, toolbar total `1,538`, and exactly `1,538` rendered Movie cards. The injected probe still saw no unprefixed `libraryPageSize` key. That was a real defect in the old implementation, not absence of the client-local preference: source shows the active-user-prefixed key. The corrected local code uses the verified key solely for guarded configuration and uses toolbar/card equality for arming. It still needs a fresh served-browser test after the Injector entry is manually updated. Details are in [testing.md](testing.md).

## Decision

The local code is suitable for review and a controlled temporary-browser trial. That trial will change the signed-in user's browser/origin-local library page-size setting and reload once; a console copy must be pasted again afterward. It is not ready for general JavaScript Injector installation: automatic preference application/restoration, served-DOM gating, native-clear timing, network parameters, performance, and Enhanced coexistence still need evidence.
