# Jellyfin Alpha Jump — local prototype

This is a **local, uninstalled prototype** for Jellyfin Web 12.1's modern Movies grid. It changes a supported alphabet-picker click into a bounded, visible native-page scan: it returns to page one with Jellyfin's own Previous control, uses Next one page at a time, then scrolls to the first card whose `data-prefix` starts with the requested letter.

It is not a Plex-style continuous library and it does not make late-letter navigation fast. It does not contain a server plugin, build system, independent item query, copied Jellyfin source, or deployment artifact.

## Supported surface

- Jellyfin Web 12.1 modern `#/movies?...&collectionType=movies` route only.
- Persisted `ViewMode: "grid"` plus either Movie card wrappers (`.card[data-prefix][data-type="Movie"]`) or Jellyfin's own empty-grid message. List view is not intercepted.
- Exact `SortBy: ["SortName"]` and `SortOrder: "Ascending"`, read from Jellyfin's public browser local-storage view setting (`Movies - <topParentId>`).
- One source-shaped alphabet picker and one source-shaped pager. Pager discovery uses MUI's `NavigateBeforeIcon` and `NavigateNextIcon`, not English button text.

Anything else is left native. The script deliberately does not access React fibers, query caches, or internal component instances, and never calls Jellyfin APIs itself.

## Local testing only

Do not add this to JavaScript Injector or a live Jellyfin instance yet. An authorized disposable browser/test server is needed for the checks in [docs/testing.md](docs/testing.md). When that exists:

1. Open the supported modern Movies route with ascending Name/SortName order and browser DevTools available.
2. Paste the contents of [src/alpha-jump.js](src/alpha-jump.js) into the DevTools console. This is a temporary local test, not an installation.
3. Confirm the normal picker keeps its appearance. During a scan, the small status message includes Cancel; `Escape` also cancels.
4. To remove it from that page, run `window.__alphaJumpPrototypeV1.destroy('manual test complete')` in the same console, then refresh if desired.

`CONFIG` is at the top of the script. `maxNavigationActions` counts every native page-changing action: Previous/Next, an existing native-alphabet clear that resets to page one, and best-effort restoration. `maxElapsedMs` covers the whole operation. `maxPageSettleMs` caps one native transition; `maxNoProgressMs` caps how long that transition can have no relevant settings/pending/card progress. Neither is a polling interval. With `debug: false`, `[AlphaJump]` writes only actual errors.

## Limits and safety behavior

- An existing native alphabet filter is cleared via one narrowly permitted click of its selected native button; enhancement selection is separate and is never persisted to Jellyfin's `Alphabet` setting.
- The script does not use a "passed the letter" shortcut. `MAR` is an `M` candidate because matching is `data-prefix.startsWith('M')`.
- A disabled Next is considered end-of-list only after a separate settle check confirms the requested public settings start index/direction, real card or Jellyfin `NoItemsMessage` DOM, absence of Jellyfin's pending bullet, and the expected Previous state. Runtime proof of this contract remains outstanding.
- Every run first settles the current page before clearing/scanning. `#` and a selected-letter re-click explicitly scroll to viewport top even if they are already on page one.
- Route, sort, filter, search, and user-page changes cancel a run. A changed query is never restored. Cancellation leaves the current native page alone.
- A newer alphabet click during an enhancement-owned loading replacement is intercepted as the latest request; it cannot fall through to Jellyfin's native alphabet filter.
- Budget exhaustion says **search incomplete**, never "no matching titles." Missing-letter restoration is best effort and uses the same budget.
- The enhancement-selected letter has a scoped outline/weight treatment and `aria-current="true"`; native `aria-pressed` remains Jellyfin-owned.
- Intermediary native page changes are visible because Jellyfin itself scrolls to the top on every pager click.

See [docs/architecture.md](docs/architecture.md) for the evidence-backed design and [docs/testing.md](docs/testing.md) for what has and has not been run.
