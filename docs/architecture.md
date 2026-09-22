# Unpaginated Alpha Jump architecture

Date: 2026-09-20. Target source: Jellyfin Web `v12.1`, commit `fae41f33eb7cd636a9ef68984adb82bb247a6e1b`.

## Source evidence

| Fact | v12.1 evidence | Prototype use |
| --- | --- | --- |
| Page size preference | `src/apps/modern/features/preferences/components/LibraryPreferences.tsx:25-43` exposes `libraryPageSize`. `src/scripts/settings/userSettings.js:105-134,517-527` calls `appSettings` with the current user and `enableOnServer=false`; `src/scripts/settings/appSettings.js:6-11,263-273` prefixes its local-storage key with `<userId>-`. | Read/write only `<activeUserId>-libraryPageSize`, preserving a one-time Alpha Jump backup per origin/user. The old unprefixed-key assumption is retained only as historical evidence. |
| Active signed-in user | `src/lib/jellyfin-apiclient/ServerConnections.js:92-99` assigns the active client to `window.ApiClient`; `src/utils/dashboard.js:90-97` calls its `getCurrentUserId()`. | Use public `window.ApiClient.getCurrentUserId()` (and `isLoggedIn()` when available). No storage-key guessing or React context is used. |
| Zero disables pagination | `src/strings/en-us.json:819-820` explicitly says zero disables pagination and warns of bugs/reduced performance. `src/apps/modern/features/libraries/components/LibraryToolbar.tsx:75-92,234-241` hides pagination when the value is not positive. | Default configuration sets zero once, verifies the local write, and performs at most one session-scoped reload. It never uses pager controls. |
| Item request semantics | `src/utils/items.ts:122-126` converts zero to an omitted `limit`; `src/hooks/useFetchItems.ts:330-347` still supplies `startIndex: libraryViewSettings.StartIndex`. | Require persisted `StartIndex === 0` before interpreting cards as the complete constrained result. |
| Public Movies view settings | `src/apps/modern/features/libraries/hooks/useLibrary.tsx:48-59` uses `getSettingsKey`; `utils/settings.ts:30-32` yields `movies - <parentId>`. | Read, but never write, that public local-storage JSON. |
| Render and readiness | `ItemsView.tsx:186-210` maps alphabet changes to persisted `Alphabet`/`StartIndex`; it renders `Loading` while pending and otherwise Cards or `NoItemsMessage`. `LoadingComponent.tsx` and `loading.ts` provide the spinner; `LibraryToolbar.tsx:62-92` uses the pending bullet. | Require no native alphabet, no pending marker, and cards or the actual no-items message. |
| Card/picker identity | `AlphabetPicker.tsx:37-88` renders the MUI toggle group; `LibraryPage.tsx:13-38` gives Movies `#moviesPage`; `src/utils/items.ts:159-183` emits `data-prefix`. | Identify the exact picker shape and match rendered `data-prefix` with `startsWith`. |

No private React context, query client, network interception, or independent item request is used.

## Support and readiness gates

The script reads public inputs:

1. Route/hash and `#moviesPage` establish Movies scope.
2. `movies - <topParentId>` establishes `ViewMode`, sort, filters/search-related view state, `Alphabet`, and explicit `StartIndex`.
3. The numeric toolbar count exactly matching rendered Movie-card count proves the currently shown result is complete. This is independently required after preference configuration.

It arms only for grid + ascending `SortName`, explicit initial index zero, and a complete rendered result. Equality supports a complete small library/filter too; a count above 100 alone never does. A native alphabet subset is only intercepted after the same alphabet-clear query was already confirmed in this page session.

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

## Preference configuration and restoration

Initialization uses the verified public API client to wait for a signed-in user.
For that user and browser origin only, it records an Alpha Jump-owned backup of
the exact prior setting (including absence), writes `0` to
`<userId>-libraryPageSize`, verifies it, and calls `location.reload()` once.
Session storage records the attempted reload and subsequent handling, so a
failed apply cannot loop and a user change in the same session is not rewritten.
Missing identity, malformed backup, or storage failure leaves native behavior
available and emits one specific error.

`restorePagination()` reads only the matching user/origin backup and restores
its exact value or removes the setting if it was absent. It marks that user as
restored for the session and does not reload. `destroy()` never restores or
reloads. Disable/remove the injector before restoration so a later fresh load
cannot intentionally configure zero again.

## Lifecycle and cleanup

The active result observer is scoped to `#moviesPage` plus the single source-shaped LibraryToolbar that AppLayout renders outside that page; it only considers card/no-items/pending/picker changes and coalesces each mutation burst to one animation frame. A non-suppressing page-scoped click observer schedules the same check after native toolbar/filter/sort/pager interactions, so a cached same-card query change is still noticed. A small document observer only notices insertion/removal of `#moviesPage` so the result observer can be attached after SPA navigation. It does not discover or rescan cards.

Each request has an overall timeout and a readiness timeout, both cancellable. A route/hash, active-user, or query-identity change cancels current work. Query identity contains route, parent, and persisted view settings except native `Alphabet`; page-size is deliberately excluded because a guessed/stale client setting must not define a query. It also clears idle enhancement selection after a completed-query change.

`destroy()` removes capture/key/route/load listeners, both observers, timeouts/animation frames, feedback, injected style, and only enhancement-owned `alpha-jump-selected`, `data-alpha-jump-selected`, and `aria-current` markers. It does not change Jellyfin's native selection or pagination preference.

## Historical paging experiment

The earlier prototype returned to page one with native Previous and scanned native Next pages. It was accepted only as a visible-transition experiment, then superseded after v12.1 source inspection established page size zero. Its pager discovery, pager activation, page settling, page budgets, and restoration logic have been removed. It is evidence that replacing pagination cannot produce the original continuously scrollable Plex-style experience—not an instruction for this implementation.

## Remaining runtime evidence

Source confirms the request and render paths, but it does not prove served-DOM compatibility, event ordering for browser-generated keyboard clicks, nor full-library performance. Those remain explicit browser checks in [testing.md](testing.md).

## Server-plugin delivery prototype — 2026-09-21

`plugin/Jellyfin.Plugin.AlphaJump` is a separate .NET 10 Jellyfin 12.1 plugin project. Its only browser payload is an MSBuild-linked embedded resource from `../../src/alpha-jump.js`; the standalone and plugin modes therefore execute identical source.

On server startup, `IPluginServiceRegistrator` registers a stock ASP.NET Core `IStartupFilter`. The filter places `AlphaJumpInjectionMiddleware` before the static-file branch and before Jellyfin maps a configured Base URL. It therefore recognizes only a Web-index suffix and derives the raw prefix as its base path: root hosting is `/web`, `/web/`, or `/web/index.html`; Base URL `/jellyfin` is `/jellyfin/web`, `/jellyfin/web/`, or `/jellyfin/web/index.html`. After the normal pipeline renders an HTTP 200 `text/html` body, it adds a unique bootstrap marker before `</head>`. It never serves a replacement index and so preserves transformations made by earlier/later middleware. The marker contains same-origin URLs using that derived prefix. A marker already in the body is left alone.

The transformed response cannot retain static-file validators: request `Accept-Encoding`, `If-None-Match`, and `If-Modified-Since` are removed only for those three candidate index paths; an injected response strips `ETag`, `Last-Modified`, `Content-Encoding`, and `Content-Range` before recalculating `Content-Length`. This is intentionally limited to the index document. Actual cache/compression behavior with Jellyfin Enhanced or File Transformation remains untested.

The plugin configuration stores global flags and XML-compatible `LibrarySelectionRecord` values, rather than a dictionary. Every record holds an unhyphenated GUID and enabled state. `AlphaJumpConfigurationService` enumerates current `CollectionFolder` values through Jellyfin's `ILibraryManager` on both client-config and administrator-config access. Under one service lock, discovery adds exactly one record for each new Movies/Shows folder using the policy that existed at discovery; it never rewrites existing choices or removes stale IDs. This makes existing libraries default enabled on initial setup, preserves explicit choices across rename/reload/policy changes, and keeps deleted records harmless. The elevation-protected dashboard endpoint displays every current library, disables unsupported types with an explanation, and applies only submitted supported selections after discovery, avoiding a discovery write overwriting an administrator choice. The authenticated client endpoint returns only one requested normalized GUID and Alpha Jump's five booleans, not an inventory.

In plugin mode, the browser code does not set its page-size preference or attach picker capture handlers until it validates contract version 1 for the current `topParentId`. A failed/unavailable/malformed request marks that route unavailable and retains native behavior; it cannot fall back to the standalone defaults. Browser refresh is the configured change boundary.

## Shows extension — 2026-09-21

Added modern Shows main-tab support using the pinned v12.1 LibraryRoutes (/tv, CollectionType.Tvshows, LibraryTab.Series), LibraryPage (#tvshowsPage), and useCurrentTab/getDefaultViewIndex semantics. View settings are series - <parentId>; cards are data-type="Series". Explicit nonzero tabs and non-Series saved landing views stay native. Local tests cover Series jumping and tab/config opt-outs alongside the Movies suite. Live Shows testing remains pending; no Injector entry was changed by this implementation.

## First-navigation activation fix — 2026-09-21

User reports full results but native filtering on first navigation, with reload restoring Alpha Jump. A local production-path regression reproduced a missed attachment when cards mount before the external toolbar count settles. The mount observer now includes toolbar/count insertion and text changes, and a narrowly filtered document capture listener attempts synchronous attachment on the first supported picker click. It does not suppress unrelated or unsupported clicks. Movies/Shows late-count tests and first-click recovery/cleanup pass locally; the exact live-session cause and fresh-session behavior still require browser verification.

## First-click ownership follow-up — 2026-09-21

User reports the first click still applies native filtering, while a second works. The prior mount repair did not cover a picker clicked before complete-result proof was available. A verified active-user page-size-zero preference now permits owning/queuing a click in a supported view while readiness is pending. It is not completeness evidence: actual jumping and missing-letter feedback now require non-pending cards exactly matching the toolbar total. The # shortcut uses the same readiness gate. New production-path tests cover a first K click during loading for both Movies and Shows, plus rejection of partial results. Live confirmation is still pending.

## First-use settings correction — 2026-09-21

The user supplied before/after evidence: the Movies view-settings key did not exist before the first letter click and existed afterward. Jellyfin LibraryProvider uses getDefaultLibraryViewSettings for an absent key; Alpha Jump previously rejected it. The script now mirrors the pinned v12.1 Movies/Series defaults in memory only when the key is absent. Existing persisted settings remain authoritative; no storage write or synthetic native click is used to initialize them. Result completeness and loading checks remain required. Two production-path regressions reproduced first-click failure before the fix and pass afterward for Movies and Shows. All 26 tests pass; fresh-browser confirmation of this specific fix remains pending. Earlier timing fixes alone did not resolve the reported failure.
