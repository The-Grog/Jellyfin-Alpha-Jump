# Jellyfin Alpha Jump

Experimental, browser-only enhancement for Jellyfin Web v12.1 Movies. It changes a supported alphabet-picker click from native letter filtering into a scroll to the first rendered card whose `data-prefix` starts with that letter.

This is not a server plugin, custom renderer, item fetcher, virtualizer, or continuously loading view. Jellyfin still fetches and renders the library; Alpha Jump only observes the rendered Movies page and scrolls it.

## Required setup

The prototype is intentionally inert unless all of these are true:

- Modern Movies route and exactly one `#moviesPage` / native alphabet picker.
- Grid view, `SortBy: ["SortName"]`, and ascending sort.
- Persisted Movies `StartIndex` is explicitly `0`.
- Jellyfin's page-size-zero mode has rendered a complete large result: the single toolbar total is greater than 100 and equals the number of rendered Movie cards.

Set the last condition yourself in Jellyfin Web: **User Menu → Settings → Display → Libraries → Library page size → 0**, click **Save**, then return to Movies and let it load. Jellyfin Web v12.1 documents that zero disables pagination and warns that zero (or values above 100) may cause bugs and reduced performance. Alpha Jump never changes this preference.

At page size zero, v12.1 omits the request `limit`, but still sends `StartIndex`; that is why this prototype refuses a missing or nonzero persisted index. The served client did not expose the source-described `libraryPageSize` storage key, so the code does not rely on that key to arm. It instead requires a complete large rendered result, avoiding the ambiguous no-pager case of a normal query with 100 or fewer results.

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

A refresh also removes a console-injected script. Neither action changes Jellyfin preferences.

## Findings

These are implementation records, not a compatibility claim.

| Finding | Evidence / implication |
| --- | --- |
| Page size zero is a native v12.1 mode | `LibraryPreferences.tsx` exposes `libraryPageSize`; the English preference help says zero disables pagination and warns about bugs/reduced performance. `getLimitQuery()` turns zero into an omitted request `limit`. |
| Start index still matters | The v12.1 item request continues to send `StartIndex`. The script requires explicit persisted `StartIndex: 0`, so it cannot mistake an unpaginated suffix for the full constrained library. |
| Served page-size storage differs from source expectation | The served 12.1 session displayed the UI's zero-page mode and 1,538 rendered cards while its injected probe saw no `libraryPageSize` key. The support gate therefore proves complete unpaginated rendering from the toolbar/card counts, while still reading only public route/DOM/view settings. |
| Readiness is a render-state question | `ItemsView` shows Loading while its result is pending, then Cards or `NoItemsMessage`. An empty DOM or cleared native alphabet button by itself is insufficient. |
| Native alphabet selection is separately owned | The existing MUI ToggleButton deselects to `null`. Alpha Jump allows just that clear click through, then keeps its own visible `aria-current` selection without changing native `aria-pressed`. |
| Card prefix is the match surface | Movie card wrappers expose `data-prefix`; matching uses literal `startsWith(letter)`, not equality or an unverified ordering shortcut. |
| The former page scan is historical | The earlier Previous/Next experiment proved visible replacing pages cannot yield Plex-style continuous scrolling. This design removes its pager machinery in favour of v12.1's native zero-page-size path. |
| Page-size zero must be saved through Jellyfin's UI | Display settings showed Library page size `100` with a separate Save button. The prototype never writes preferences. In the later saved-zero state, Movies showed a 1,538 total with 1,538 renderer Movie cards and no pager; this is the supported runtime shape. |
| Jellyfin Enhanced remains a compatibility risk | With Jellyfin Enhanced active, an earlier zero-page-size observation exposed a virtualized region reporting `showing 0-500 of 4609 items` while the toolbar reported 1,538. The prototype only inspects rendered cards, so it cannot yet claim a complete constrained-query scan or acceptable performance under that plugin. |

The target browser still has to validate served-DOM selectors, keyboard/capture event ordering, network parameters, cleared-filter timing, pagination-zero performance, and Jellyfin Enhanced coexistence. See [docs/feasibility.md](docs/feasibility.md) and [docs/testing.md](docs/testing.md).

## Limits

- Page size zero asks Jellyfin to load and render the entire currently constrained Movies result. Its performance on the target roughly 1,500-title library is **not yet tested**.
- Source inspection supports the selectors and readiness model, but a served page must still prove event interception, request parameters, loading behavior, sticky-header positioning, and Jellyfin Enhanced coexistence.
- Sort-name/card-prefix collation for custom titles, punctuation, accents, and non-Latin titles is not claimed beyond the literal prefix values the page renders.
- This source has not been installed, packaged, committed, pushed, or published by this rework.

The previous sequential native-page scan is retained as historical evidence in [docs/architecture.md](docs/architecture.md); it is not the current design.
