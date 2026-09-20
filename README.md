# Jellyfin Alpha Jump

**Status: experimental page-jump prototype. Continuous scrolling is not implemented.**

Jellyfin Alpha Jump explores changing Jellyfin Web's Movies alphabet picker from filtering by letter to navigating to that letter within the current library results.

The original goal is a Plex-style experience: click **M**, reach the first matching title, then scroll freely through earlier and later titles without an alphabet filter. **The current prototype does not achieve that full experience.**

## What the prototype currently does

On the targeted Movies grid, the script attempts to:

1. Prevent the native alphabet filter and clear an existing alphabet selection.
2. Preserve the current non-alphabet filters.
3. Return to page one using Jellyfin's native Previous button.
4. Advance through native pages until it finds a card whose sort-name prefix matches the requested letter.
5. Scroll to that card and mark the requested letter in the picker.

This is **letter-to-page navigation**, followed by a scroll within that page. Jellyfin continues to own the cards, rendering, and pagination. The script does not directly fetch library items or replace the renderer.

## Main limitation: pages still replace each other

Jellyfin's tested Movies view uses replacing pagination. Moving to another page removes the previous page's cards; this prototype does not retain or append them.

After jumping to M, you therefore see only the current page's titles, which may include neighboring letters. Reaching the bottom does not continue into the rest of the library. Use Jellyfin's native Previous/Next controls to move beyond that page.

This is an architectural limitation, not a configuration switch or an indication that the alphabet filter must still be active. Achieving continuous scrolling requires a different approach that retains or virtualizes results across page boundaries. That approach has not yet been selected or validated.

Other limitations:

- Page changes and top-of-page movements are visible during a scan.
- Late letters may require visiting most of the matching library. This is not a fast indexed jump.
- Navigation and time budgets can stop a search before it reaches the destination.
- Returning to the starting page after a missing-letter scan is best effort within the same budget.
- Locale, custom sort titles, accented/non-Latin names, and server collation are not comprehensively validated.
- Hooks depend on Jellyfin Web's DOM and browser-local settings; upgrades can invalidate them.

## Current evidence

As of September 20, 2026:

| Area | Current state |
| --- | --- |
| Source target | Jellyfin Web `v12.1`, upstream commit `fae41f33eb7cd636a9ef68984adb82bb247a6e1b` |
| Local checks | Syntax, whitespace, and focused isolated regression checks have passed during development. These do not establish browser compatibility. |
| Firefox activation | Initial testing exposed two incorrect hooks: the settings key is lowercase `movies - <parentId>` and the page container is `#moviesPage`. Both were corrected. |
| First manual trial | After re-injection, the user reported the jump behavior working, but only the destination page and nearby letters were visible. Continuous scrolling was unavailable. |
| Network verification | Absence of native alphabet-filter parameters and preservation of all other filters have not yet been independently verified in the browser. |
| Full browser checklist | Outstanding, including delayed loading, rapid requests, failures, SPA navigation, accessibility, and cleanup. |
| Jellyfin Enhanced | Present in the initial environment; comprehensive coexistence testing has not been completed. |
| Distribution | Browser-session prototype. Not a completed release or a standalone Jellyfin server plugin. |

The manual trial is limited evidence of page navigation, not proof that every implementation guarantee holds. Earlier detailed test records are in [docs/testing.md](docs/testing.md).

## Targeted environment

The current implementation targets:

- Jellyfin Web 12.1's modern Movies route and `#moviesPage` container.
- Movie grid view with ascending Name/SortName order.
- Persisted `ViewMode: "grid"`, `SortBy: ["SortName"]`, and `SortOrder: "Ascending"`.
- The `movies - <topParentId>` browser-local settings key.
- Movie cards carrying `data-prefix` and the expected alphabet/pagination controls.

Other library types, list view, native clients, and other Web versions are not supported targets. The script is designed to leave unsupported states native; broader compatibility remains unverified.

## Temporary browser-session testing

Use a dedicated browser session for a controlled trial. Do not enable this through JavaScript Injector for general use yet. Temporary testing against an existing Jellyfin server is possible: the script drives normal library requests and changes that browser session's persisted view settings.

1. Open Movies in grid view, sorted by Name ascending, and clear the native alphabet filter.
2. Open your browser's page console. In Firefox on Windows, press **Ctrl+Shift+K**.
3. Paste the complete contents of [src/alpha-jump.js](src/alpha-jump.js) and run it. An `undefined` return value is normal.
4. Check `window.__alphaJumpPrototypeV1`; an object with `destroy` and `config` confirms initialization, but does not by itself prove that the picker was intercepted.
5. Close or undock DevTools if it reduces the viewport enough to hide Jellyfin's alphabet picker.
6. Try an already-loaded letter, then an unloaded letter. Expect visible page navigation, not an accumulated scrollable library.

To enable debug logging after injection:

```js
window.__alphaJumpPrototypeV1.config.debug = true;
```

To remove the prototype from the current document:

```js
window.__alphaJumpPrototypeV1?.destroy('testing complete');
```

A full page refresh also removes a console-injected copy. Navigating within Jellyfin's SPA does not necessarily remove it. Neither removal method restores the previous page/filter settings automatically. If the local script changes, copy and run the updated file; an existing pasted copy does not update itself.

## Implemented controls and remaining validation

The script includes Cancel/Escape handling, latest-request replacement, query-change cancellation, reduced-motion-aware scrolling, enhancement-owned selection markers, and cleanup on detachment/destroy. It attempts to wait for settled results before interpreting disabled pagination as end-of-list. These paths still need the browser scenarios in [docs/testing.md](docs/testing.md).

Configuration is at the top of `src/alpha-jump.js`:

| Setting | Default | Purpose |
| --- | --- | --- |
| `enabled` | `true` | Initialize the enhancement on injection. |
| `moviesOnly` | `true` | Retain the Movies restriction; changing it does not add other library support. |
| `respectSortOrder` | `true` | Require the supported ascending SortName order. Keep enabled. |
| `smoothScroll` | `true` | Smooth destination scrolling, subject to reduced-motion preferences. |
| `debug` | `false` | Enable `[AlphaJump]` diagnostic logs. Actual errors may still be logged when false. |
| `maxNavigationActions` | `80` | Bound native navigation actions, including clearing, backward paging, scanning, and restoration. |
| `maxElapsedMs` | `60000` | Bound the complete operation. |
| `maxPageSettleMs` | `8000` | Bound a single transition wait. |
| `maxNoProgressMs` | `4000` | Bound a transition with no observed relevant progress. |

## Next decision

The page-jump prototype provides evidence about Jellyfin's controls, but is not the finished feature originally intended. The next architecture review should determine whether a maintainable browser enhancement can support continuous scrolling while preserving Jellyfin's normal behavior, or whether an upstream Web change or another integration approach is more appropriate.

No continuous-scrolling implementation or general Injector rollout is established by the current prototype.

- [Milestones and review tracking](PROJECT-MILESTONES.md)
- [Feasibility and open findings](docs/feasibility.md)
- [Current architecture](docs/architecture.md)
- [Testing record and checklist](docs/testing.md)
