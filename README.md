# Alpha Jump for Jellyfin

Alpha Jump is an installable Jellyfin 12 plugin for Jellyfin Web. In supported
library grids, it changes the native alphabet picker from letter
filtering into a direct scroll to the first matching rendered title—while
retaining the complete rendered library.

It preserves Jellyfin's renderer, appearance, playback, cards, and normal
controls. Alpha Jump does not fetch items independently or replace the library
view. When its safety conditions are not met, the native alphabet picker keeps
its normal filtering behavior.

Alpha Jump is the original project under this GUID.
Any third-party fork that reuses the same GUID is not an official rename or successor.

[![Listed on JellyWatch Hub](https://jellywatch.app/hub/jellyfin-alpha-jump/badge.svg)](https://jellywatch.app/hub/jellyfin-alpha-jump)

[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-0070ba?logo=paypal&logoColor=white)](https://paypal.me/machogrog)

## What Alpha Jump does

- Supports only the explicit modern Jellyfin Web grids in the matrix below.
- Scrolls to the first card whose rendered `data-prefix` begins with the chosen
  alphabet letter instead of applying Jellyfin's alphabet filter.
- Keeps non-alphabet filters and search constraints intact.
- Treats `A`–`Z` as stateless jump commands: repeated clicks repeat the jump
  without a persistent highlighted or selected letter. `#` returns to the top.

## Requirements

Alpha Jump targets Jellyfin **12.x**, with behavior developed against Jellyfin
Web 12.1. It needs Grid view, ascending Name/SortName, and a persisted
`StartIndex` of zero in a supported grid/tab.

The plugin configures the signed-in user's browser-local **Library page size**
to `0` when that option is enabled. Jellyfin treats zero as unpaginated mode,
which means the browser loads the complete constrained library. This can have
significant browser and performance implications for large libraries.

If JellyTweaks controls Library Page Size, set its Library Page Size to `0` or
disable JellyTweaks/all tweaks. A conflicting JellyTweaks page size can undo
Alpha Jump's pagination setup after reload.

## Library and tab support

This matrix is backed by the pinned Jellyfin Web 12.1 source and deterministic
tests. It is **not** live-browser compatibility confirmation yet. All entries
still require grid layout, ascending `SortName`, explicit `StartIndex: 0`, one
native picker, and a complete matching rendered-card result.

| Library/view | Supported tabs | Rendered card types |
| --- | --- | --- |
| Movies | Movies, Favorites, Collections | `Movie`, `BoxSet` |
| Shows | Series, Collections | `Series`, `BoxSet` |
| Books / Audiobooks | Folders, Books, Collections, Favorites | `Folder`, `AudioBook`, `Book`, `BoxSet` |
| Built-in Collections | Collections, Favorites | `BoxSet` |
| Home Videos / Photos | Folders, Photos, Photo Albums, Videos | `Folder`, `Photo`, `PhotoAlbum`, `Video` |
| Mixed libraries | Folders, Mixed, Collections | `Folder`, `Movie`, `Series`, `BoxSet` |
| Music | Albums, Collections | `MusicAlbum`, `BoxSet` |
| Music Videos | Folders, Music Videos | `Folder`, `MusicVideo` |
| Playlists | Playlists, Favorites | `Playlist` |

Downloaded YouTube videos are supported only by their configured Jellyfin
collection type (for example Home Videos, Mixed, Movies, or Music Videos),
never by matching a library's display name. Empty or `unknown` folder types
are treated as Mixed only because Jellyfin Web 12.1 maps those types to its
`#/mixed` page.

Live TV and standalone Photos libraries are always native: pinned 12.1 source
marks `photosPage` unused, while the supported photo grids are the tabs of a
Home Videos library. Suggestions, genres, studios/networks, people,
authors/artists, songs, episodes/upcoming, media-library embedded playlists,
and item/collection detail pages are intentionally native too. Unknown types,
layouts, sorts, DOM shapes, and card types fail closed.

## Installation

### Recommended: Jellyfin plugin repository

1. In Jellyfin, open **Dashboard** → **Plugins** → **Repositories** (or
   **Manage Repositories**).
2. Add a repository named `The-Grog Plugins` or `Alpha Jump`.
3. Use this URL:

   `https://raw.githubusercontent.com/The-Grog/Jellyfin-Alpha-Jump/main/manifest.json`

4. Open the **Catalog**, install **Alpha Jump**, and restart Jellyfin if it asks.
5. Open Alpha Jump's plugin settings and configure the supported libraries and
   options.

The manifest intentionally has no placeholder release. The Catalog entry will
appear after the first real tagged release publishes its ZIP and checksum.

### Manual test installation

Download `alpha-jump_<VERSION>.zip` from the GitHub Releases page, extract it
into a new Alpha Jump directory beneath Jellyfin's plugins directory, and
restart Jellyfin. The ZIP intentionally contains only
`Jellyfin.Plugin.AlphaJump.dll`; it does not include Jellyfin runtime DLLs.
Repository installation is preferred because it supports updates.

## Configuration

The Alpha Jump settings page provides:

- **Enable Alpha Jump** — global injection switch.
- **Enable newly discovered compatible libraries** — applied once when a
  supported library is first discovered; it does not rewrite saved selections.
- **Enable built-in Collections** — a separate opt-in because Collections is a
  Jellyfin-provided view, not a media folder with a fabricated ID.
- Per-library enablement for every discovered folder. Incompatible folders,
  including standalone Photos, are shown disabled with an explanation. Live TV
  is shown as a non-selectable built-in status row because it is not a virtual
  folder and has no fabricated ID.
- **Set the active browser user's library page size to zero** — browser-local
  unpaginated setup; enabled by default.
- **Smooth scroll** and **Enable browser debug logging**.
- **Keyboard alphabet jump** — defaults to **Prefix** (recommended).
  Prefix
  uses `Shift+J`, then `A`–`Z` or `#` within two seconds. **Plain** uses
  `A`–`Z` or `#` directly and can conflict with browser extensions or other
  plugins.

If JellyTweaks is installed and controls Library Page Size, set its Library
Page Size to `0` as well (or disable JellyTweaks/all tweaks). Otherwise
JellyTweaks can restore a nonzero page size after Alpha Jump reloads.

Library choices use stable Jellyfin library IDs, so they survive a rename.

Changing a plugin setting takes effect after a browser refresh. The keyboard
setting is global to Alpha Jump, not per library. If Plain conflicts with a
different extension or plugin, rebind or disable that shortcut, or use Prefix
mode instead.

## Update recovery

The first installation still needs a manual browser refresh. The first upgrade
that introduces this mechanism—specifically `0.2.1.0` to `0.3.0.0`—also needs
one because the already-open 0.2.1.0 script cannot check for an update. Once a
tab has loaded 0.3.0.0 or later, later changed-script upgrades use a
fingerprinted script URL and can prompt that tab to refresh after Jellyfin
restarts. An unchanged script after an ordinary restart does not request a
refresh.

Alpha Jump reloads automatically only when it can positively establish a
visible supported library screen and inactive playback. Jellyfin Web 12.1 keeps
its playback manager module-scoped, so installations that do not explicitly
expose that verified API receive the accessible **Alpha Jump updated—refresh to
apply** action instead. This intentionally avoids interrupting playback or
dashboard editing.

Restart notifications begin a single bounded recovery window. A response from
the old server during shutdown is not treated as a completed update check: the
tab continues its finite backoff checks until a new runtime answers or the
window expires. A delayed or replaced authenticated `ApiClient` is subscribed
when it becomes available, while focus and visibility remain fallbacks. Teardown
and reinjection cancel abortable runtime requests, invalidate all late
callbacks, remove the notice/listeners, and never let an old response reload a
new instance. An unabortable timeout remains outstanding until it settles, so
it cannot overlap a second request.

## Safety conditions

The enhancement itself is intentionally inert unless all of these are true:

- One supported route/tab from the support matrix with its matching page ID,
  exact rendered card types, and one native alphabet picker.
- Grid view, `SortBy: ["SortName"]`, and ascending sort.
- Persisted view `StartIndex` is explicitly `0`.
- The numeric toolbar total exactly equals the number of rendered allowed cards.

Jellyfin Web v12.1 documents that zero disables pagination and warns that zero
(or values above 100) may cause bugs and reduced performance. Automatic setup
does **not** prove that an already visible query is complete: Alpha Jump still
requires the exact toolbar/card match above. That includes small libraries and
filtered results of 100 or fewer; mismatched or pending results retain native
behavior.

At page size zero, v12.1 omits the request `limit`, but still sends `StartIndex`; that is why Alpha Jump refuses a missing or nonzero persisted index. The active preference key is `<signed-in-user-id>-libraryPageSize`, not the old unprefixed assumption. The code uses that key only to configure the preference; it never treats it as evidence that a current result has rendered.

## Behavior

- Intercepts native alphabet activation only in the supported state.
- Clears an existing native alphabet selection by activating its existing button once through a narrowly scoped bypass, then waits for the unfiltered result to be ready.
- Preserves other persisted filters and search constraints; it has no request or API hooks.
- Matches `data-prefix.startsWith(letter)` and scrolls to the first result. It creates no persistent letter selection, marker, custom style, or `aria-current` state, and does not alter native `aria-pressed`.
- Every `A`–`Z` click repeats that letter's jump. Only `#` is Alpha Jump's return-to-top command.
- Latest request wins. Escape and the small Cancel button stop a pending request; route, sort, filter, search, page-size, or index changes also cancel it.
- Empty DOM or Jellyfin's query-specific pending toolbar bullet never count as a settled empty library. Waits are observer-driven, cancellable, and bounded.

Unsupported or uncertain states keep Jellyfin's normal alphabet behavior.

## Keyboard shortcuts

Keyboard support defaults to Prefix and uses the same jump path as clicking the native
alphabet picker; it does not synthesize picker clicks. Prefix mode arms a
small, non-focusable `Jump to: A–Z / #` status notice for two seconds.
`Escape` cancels that prefix (or an already-running jump). Uppercase letters
and `#` are accepted from `event.key` on layouts that emit those characters.

Alpha Jump leaves the event untouched unless it can prove a supported enabled
grid and no text/control/modal interaction is underway. It never owns input,
textarea, select, contenteditable, editable ARIA widgets, focused controls,
dialogs/action sheets, repeated or IME keys, or Ctrl/Alt/Meta/AltGraph
combinations. A standalone Shift press preserves an armed Prefix so layouts
that generate `#` using Shift can complete the command. It also cancels an armed prefix on unrelated input, editable
focus, modal focus, blur, hidden tab, navigation/query change, disablement,
detach, destroy, or reinjection. This protects ordinary typing and controls,
but another extension with an earlier capture-phase listener can still prevent
Alpha Jump from seeing a key; universal shortcut compatibility is not claimed.

Background music does not disable browsing shortcuts, but player and detail
routes remain native. Jellyfin Enhanced shortcut defaults (including claimed
`D`/`Q`/`R` and `Shift+H` bindings) have not been verified against a specific
Enhanced source/version. Alpha Jump does not modify Enhanced settings; test
with Enhanced enabled and rebind or disable either feature if a conflict occurs.

## Development and validation

```powershell
node --check src/alpha-jump.js
node --test tests/alpha-jump.test.js
dotnet build plugin/Jellyfin.Plugin.AlphaJump/Jellyfin.Plugin.AlphaJump.csproj --configuration Release
dotnet test plugin/Jellyfin.Plugin.AlphaJump.Tests/Jellyfin.Plugin.AlphaJump.Tests.csproj --configuration Release
git diff --check
```

The tests are focused deterministic regressions, not a browser compatibility or performance result. See [docs/testing.md](docs/testing.md) for actual results and browser work still required.

## Maintainer release flow

Release versions come from four-part Git tags. A tag such as `v0.3.0.0`
automatically runs validation, builds the DLL with version `0.3.0.0`, creates
`alpha-jump_0.3.0.0.zip`, calculates its MD5 and SHA-256, and attaches both
assets to a **draft** GitHub Release. It then opens a `release-manifest/v…`
pull request containing the real URL/checksum. After that PR passes CI and is
merged, the publish workflow verifies the manifest entry and publishes the
draft release. This keeps `main` protected and attaches every asset before an
immutable release is published.

The workflows are [CI](.github/workflows/ci.yml) and
[release](.github/workflows/release.yml). The release ZIP contains only the
plugin DLL because the configuration page and browser source are embedded and
Jellyfin supplies the runtime assemblies. Manifest pull-request merges cannot
start another draft-release workflow because it triggers only from matching
version tags.

## Security

Repository ownership is recorded in [.github/CODEOWNERS](.github/CODEOWNERS).
CI, CodeQL, Dependabot, pinned workflow actions, and GitHub repository controls
are maintained as supply-chain safeguards. See [SECURITY.md](SECURITY.md) for
the private vulnerability-reporting process and [security controls](docs/security.md)
for the maintainer policy.
Release compatibility metadata is derived from the pinned Jellyfin
Controller/Model package version. The current supported minimum is Jellyfin
12.1 (`targetAbi` `12.1.0.0`); CI and the release workflow validate that this
stays aligned with the manifest.

## Plugin implementation notes

The project at [plugin/Jellyfin.Plugin.AlphaJump](plugin/Jellyfin.Plugin.AlphaJump) targets the Jellyfin 12.1 plugin ABI (`net10.0`, `Jellyfin.Controller` and `Jellyfin.Model` `12.1.0`). It embeds [src/alpha-jump.js](src/alpha-jump.js) directly at build time; there is no plugin-maintained copy of the browser source.

It has a native Jellyfin dashboard configuration page with these defaults:

- Global enhancement enabled; newly discovered supported libraries enabled.
- Explicit per-library settings are XML-compatible records keyed only by a normalized stable collection-folder GUID, so renamed libraries retain their setting and deleted ones are harmless.
- Discovery persists one record for each supported collection type before any dashboard visit. Existing supported libraries initially follow the default; later policy changes affect only libraries discovered afterward. Every discovered folder is shown; unsupported folders are disabled with an explanation. The built-in Collections view has a separate persisted opt-in because it has no virtual-folder GUID.
- Auto-disable pagination and smooth scrolling are enabled; debug logging is disabled.

The dashboard uses an elevation-protected Alpha Jump endpoint backed by Jellyfin's `ILibraryManager`, which synchronizes discovery and administrator writes under one lock. Its per-library checkboxes reflect their saved choices even when the global switch is temporarily off, so re-enabling cannot erase them. The injected browser code requests only an authenticated, per-library configuration response; it receives no library inventory. IDs are normalized to Jellyfin Web's unhyphenated GUID form at the server, dashboard, and browser boundaries. An unavailable or malformed response leaves the native picker alone rather than using standalone defaults; an early missing public `ApiClient` is retried for a small bounded startup window.

The plugin's early `IStartupFilter` sees the configured base URL before Jellyfin maps it, so it buffers only the Web index forms at either root or that prefix (for example, `/web/index.html` and `/jellyfin/web/index.html`). It then appends one idempotent bootstrap marker and same-origin script tag to an HTML `<head>`. It does not rewrite API, media, image, CSS, JavaScript, or other Web paths, and does not modify installed Jellyfin Web files. Because the index response is transformed, conditional validators are removed for that response and compression may be bypassed; this must be measured in a controlled server test.

On 2026-09-21 this host built the production project with .NET SDK `10.0.401` (zero warnings) and ran the C# suite successfully (9 passed). Served Jellyfin validation still requires a separately approved disposable-server test.

To disable the installed plugin, use its global **Enable Alpha Jump** setting and refresh Web clients. Before removal, disable injection and use the existing `restorePagination()` procedure if restoring the browser-local page-size preference is wanted. Do not test the plugin while a JavaScript Injector Alpha Jump entry is also active. Native clients remain outside this browser-only scope.

## Development and troubleshooting: temporary console trial

For development-only diagnosis, an authorized non-production browser session can paste [src/alpha-jump.js](src/alpha-jump.js) into DevTools and run:

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
| Small results are resolved by equality, not a threshold | A toolbar total equal to the rendered allowed-card count proves that current result is complete, including <=100 results. A large number by itself proves nothing. An active native alphabet remains fail-closed until the same alphabet-clear query was previously confirmed. |
| Readiness is a render-state question | `ItemsView` shows Loading while its result is pending, then Cards or `NoItemsMessage`. An empty DOM or cleared native alphabet button by itself is insufficient. |
| Native alphabet state remains Jellyfin-owned | The existing MUI ToggleButton deselects to `null`. Alpha Jump allows only that native clear click through when needed, then uses letters as stateless jump commands without changing native `aria-pressed`, adding `aria-current`, or leaving a custom marker. |
| Card prefix and type are the match surface | Supported card wrappers expose `data-prefix` and a source-defined `data-type`; matching uses literal `startsWith(letter)`, not equality or an unverified ordering shortcut. A heterogeneous grid is accepted only when every card has an allowed type and usable prefix. |
| Multi-library support is registry-bound | The script has an explicit v12.1 route/tab/settings/card-type registry. It does not broaden itself to every visible card; unavailable tabs and Live TV retain native behavior. |
| The former page scan is historical | The earlier Previous/Next experiment proved visible replacing pages cannot yield Plex-style continuous scrolling. This design removes its pager machinery in favour of v12.1's native zero-page-size path. |
| Configuration and readiness are distinct | The prototype may set the signed-in user's client-local setting and reload once, but it still arms only after the current result's toolbar/card equality and other view gates succeed. |
| Jellyfin Enhanced remains a compatibility risk | With Jellyfin Enhanced active, an earlier zero-page-size observation exposed a virtualized region reporting `showing 0-500 of 4609 items` while the toolbar reported 1,538. The prototype only inspects rendered cards, so it cannot yet claim a complete constrained-query scan or acceptable performance under that plugin. |

The target browser still has to validate served-DOM selectors, keyboard/capture event ordering, network parameters, cleared-filter timing, pagination-zero performance, and Jellyfin Enhanced coexistence. See [docs/feasibility.md](docs/feasibility.md) and [docs/testing.md](docs/testing.md).

## Limits

- Page size zero asks Jellyfin to load and render the entire currently constrained result for this browser user, including supported non-Movie library views. Its performance on the target roughly 1,500-title library is **not yet tested**.
- Source inspection supports the selectors and readiness model, but a served page must still prove event interception, request parameters, loading behavior, sticky-header positioning, and Jellyfin Enhanced coexistence.
- Sort-name/card-prefix collation for custom titles, punctuation, accents, and non-Latin titles is not claimed beyond the literal prefix values the page renders.
- A controlled served-server installation and full browser compatibility test
  are still required before claiming broad compatibility.

The previous sequential native-page scan is retained as historical evidence in [docs/architecture.md](docs/architecture.md); it is not the current design.

## Shows support

Shows support is enabled by default (`showsEnabled: true`, `moviesOnly: false`). It targets Series cards on the main Shows tab, using `series - <parentId>` view settings. It shares the existing complete-result, grid, ascending SortName, cancellation, and cleanup checks. In standalone injection, set `showsEnabled: false` to leave Shows native; set `moviesOnly: true` to limit Alpha Jump to the original Movies main grid and leave all expanded views native. Source and local regression tests verify the hooks; Shows has not yet been tested in the live browser.

For testing, replace the existing Injector entry with the updated source, save, and fully reload. Open Shows, select its main Shows tab, use Name ascending/grid, and clear native alphabet filtering. Try A, M, Z, then #, and verify all shows remain scrollable. Navigate Movies → Shows → Movies and verify both pickers. Episodes and other TV tabs should retain native behavior.
