# Jellyfin Alpha Jump

Experimental, browser-only enhancement for Jellyfin Web v12.1 Movies and Shows. It changes a supported alphabet-picker click from native letter filtering into a scroll to the first rendered card whose `data-prefix` starts with that letter.

This is not a server plugin, custom renderer, item fetcher, virtualizer, or continuously loading view. Jellyfin still fetches and renders the library; Alpha Jump only observes the rendered library page and scrolls it.

## Required setup

When enabled, Alpha Jump automatically configures the signed-in Jellyfin user's
**Library page size** to `0` for this browser origin. This is an intentional
product default, not a server setting: it affects that user's library views in
this browser, not Movies alone, and can make large libraries slower or less
stable. The script preserves the prior value once per user/origin, then uses one
guarded page reload so Jellyfin can apply the setting. A console-injected copy
is removed by that reload and must be pasted again; an Injector entry loads
again normally.

The enhancement itself is intentionally inert unless all of these are true:

- Modern Movies (`#/movies`, `#moviesPage`) or Shows (`#/tv`, `#tvshowsPage`) main tab with one native alphabet picker. Episodes, suggestions, and other tabs remain native.
- Grid view, `SortBy: ["SortName"]`, and ascending sort.
- Persisted Movies/Series `StartIndex` is explicitly `0`.
- The numeric toolbar total exactly equals the number of rendered Movie cards.

Jellyfin Web v12.1 documents that zero disables pagination and warns that zero
(or values above 100) may cause bugs and reduced performance. Automatic setup
does **not** prove that an already visible query is complete: Alpha Jump still
requires the exact toolbar/card match above. That includes small libraries and
filtered results of 100 or fewer; mismatched or pending results retain native
behavior.

At page size zero, v12.1 omits the request `limit`, but still sends `StartIndex`; that is why this prototype refuses a missing or nonzero persisted index. The active preference key is `<signed-in-user-id>-libraryPageSize`, not the old unprefixed assumption. The code uses that key only to configure the preference; it never treats it as evidence that a current result has rendered.

## Behavior

- Intercepts native alphabet activation only in the supported state.
- Clears an existing native alphabet selection by activating its existing button once through a narrowly scoped bypass, then waits for the unfiltered result to be ready.
- Preserves other persisted filters and search constraints; it has no request or API hooks.
- Matches `data-prefix.startsWith(letter)`, scrolls to the first result, and marks only its own selection with `aria-current` and scoped styling. It does not alter native `aria-pressed`.
- `#` and a second click on the enhancement-selected letter clear enhancement selection and scroll to the top.
- Latest request wins. Escape and the small Cancel button stop a pending request; route, sort, filter, search, page-size, or index changes also cancel it.
- Empty DOM or Jellyfin's query-specific pending toolbar bullet never count as a settled empty library. Waits are observer-driven, cancellable, and bounded.

Unsupported or uncertain states keep Jellyfin's normal alphabet behavior.

## Local checks

```powershell
node --check src/alpha-jump.js
node --test tests/alpha-jump.test.js
git diff --check
```

The tests are focused deterministic regressions, not a browser compatibility or performance result. See [docs/testing.md](docs/testing.md) for actual results and browser work still required.

## Temporary console trial only

Do not enable this in JavaScript Injector yet. In an authorized, non-production test session with page size zero, paste the contents of [src/alpha-jump.js](src/alpha-jump.js) into DevTools and run:

```js
window.__alphaJumpPrototypeV1.config.debug = true;
```

Verify it armed before clicking a letter. To remove it:

```js
window.__alphaJumpPrototypeV1?.destroy('testing complete');
```

A refresh also removes a console-injected script. `destroy()` removes listeners,
markers, feedback, and styles, but deliberately does not change pagination or
reload the page.

### Restore the prior page-size preference

First disable/remove the Injector entry (or do not re-paste a console copy), so
the next load cannot apply zero again. Then, while signed in as the same user
and on the same browser origin, run:

```js
window.__alphaJumpPrototypeV1?.restorePagination();
```

It restores Alpha Jump's one-time backup for that user, including removing the
preference when it was originally absent. It does not reload; refresh manually
after the script is disabled to let Jellyfin use the restored value.

## Findings

These are implementation records, not a compatibility claim.

| Finding | Evidence / implication |
| --- | --- |
| Page size zero is a native v12.1 mode | `LibraryPreferences.tsx` exposes `libraryPageSize`; the English preference help says zero disables pagination and warns about bugs/reduced performance. `getLimitQuery()` turns zero into an omitted request `limit`. |
| Correct preference key is user-local | `userSettings.libraryPageSize()` calls `set('libraryPageSize', value, false)`. That calls `appSettings.set(name, value, currentUserId)`, whose key format is `<userId>-<name>`. The current user comes from public `window.ApiClient.getCurrentUserId()`. |
| Start index still matters | The v12.1 item request continues to send `StartIndex`. The script requires explicit persisted `StartIndex: 0`, so it cannot mistake an unpaginated suffix for the full constrained library. |
| Unprefixed storage was a historical mistake | The served session had no unprefixed `libraryPageSize`, which correctly exposed the old implementation defect. v12.1 source shows that the correct active-user key is prefixed; this prototype now reads/writes only that key and preserves a scoped backup. |
| Small results are resolved by equality, not a threshold | A toolbar total equal to the rendered Movie-card count proves that current result is complete, including <=100 results. A large number by itself proves nothing. An active native alphabet remains fail-closed until the same alphabet-clear query was previously confirmed. |
| Readiness is a render-state question | `ItemsView` shows Loading while its result is pending, then Cards or `NoItemsMessage`. An empty DOM or cleared native alphabet button by itself is insufficient. |
| Native alphabet selection is separately owned | The existing MUI ToggleButton deselects to `null`. Alpha Jump allows just that clear click through, then keeps its own visible `aria-current` selection without changing native `aria-pressed`. |
| Card prefix is the match surface | Movie card wrappers expose `data-prefix`; matching uses literal `startsWith(letter)`, not equality or an unverified ordering shortcut. |
| The former page scan is historical | The earlier Previous/Next experiment proved visible replacing pages cannot yield Plex-style continuous scrolling. This design removes its pager machinery in favour of v12.1's native zero-page-size path. |
| Configuration and readiness are distinct | The prototype may set the signed-in user's client-local setting and reload once, but it still arms only after the current result's toolbar/card equality and other view gates succeed. |
| Jellyfin Enhanced remains a compatibility risk | With Jellyfin Enhanced active, an earlier zero-page-size observation exposed a virtualized region reporting `showing 0-500 of 4609 items` while the toolbar reported 1,538. The prototype only inspects rendered cards, so it cannot yet claim a complete constrained-query scan or acceptable performance under that plugin. |

The target browser still has to validate served-DOM selectors, keyboard/capture event ordering, network parameters, cleared-filter timing, pagination-zero performance, and Jellyfin Enhanced coexistence. See [docs/feasibility.md](docs/feasibility.md) and [docs/testing.md](docs/testing.md).

## Limits

- Page size zero asks Jellyfin to load and render the entire currently constrained result for this browser user, including non-Movies library views. Its performance on the target roughly 1,500-title library is **not yet tested**.
- Source inspection supports the selectors and readiness model, but a served page must still prove event interception, request parameters, loading behavior, sticky-header positioning, and Jellyfin Enhanced coexistence.
- Sort-name/card-prefix collation for custom titles, punctuation, accents, and non-Latin titles is not claimed beyond the literal prefix values the page renders.
- This source has not been installed, packaged, committed, pushed, or published by this rework.

The previous sequential native-page scan is retained as historical evidence in [docs/architecture.md](docs/architecture.md); it is not the current design.

## Shows support

Shows support is enabled by default (`showsEnabled: true`, `moviesOnly: false`). It targets Series cards on the main Shows tab, using `series - <parentId>` view settings. It shares the existing complete-result, grid, ascending SortName, cancellation, and cleanup checks. Set `showsEnabled: false` or `moviesOnly: true` to retain Movies-only behavior. Source and local regression tests verify the hooks; Shows has not yet been tested in the live browser.

For testing, replace the existing Injector entry with the updated source, save, and fully reload. Open Shows, select its main Shows tab, use Name ascending/grid, and clear native alphabet filtering. Try A, M, Z, then #, and verify all shows remain scrollable. Navigate Movies → Shows → Movies and verify both pickers. Episodes and other TV tabs should retain native behavior.

If JellyTweaks is installed, its default library page-size override must also be zero (or disabled). The user confirmed its configured value of 100 was restoring pagination on reload; changing that override resolved the conflict.
