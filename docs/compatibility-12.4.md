# Jellyfin 12.4 compatibility — 2026-10-28

The maintainer reports successful testing of the existing v0.5.2.0 release on
their Jellyfin 12.4 instance. No new plugin release is needed for this compatibility
update. Controller/Model package pins remain 12.2.0 and the minimum catalog ABI
remains 12.2.0.0 on net10.0. Published checksums and assets are unchanged.

## Source evidence

- [Server v12.4](https://github.com/jellyfin/jellyfin/tree/83d0d0e7f76e23e2e085c8ff67d28b772d35967d)
  (`83d0d0e7f76e23e2e085c8ff67d28b772d35967d`).
- [Web v12.4](https://github.com/jellyfin/jellyfin-web/tree/0a580ce8df89282dfd120b6d5efb8e106da23bd5)
  (`0a580ce8df89282dfd120b6d5efb8e106da23bd5`).
- Reviewed official [Server diff](https://github.com/jellyfin/jellyfin/compare/v12.2...v12.4)
  and [Web diff](https://github.com/jellyfin/jellyfin-web/compare/v12.2...v12.4).

The browser diff leaves ItemsView, LibraryToolbar, AlphabetPicker, route/view
registries, card attributes, pagination settings, and dialog-helper contracts
unchanged from the prior 12.2 audit. No browser implementation change was needed.

Relevant changes to verify live:

- LibraryPage now uses a library-ID React key and a library title. Existing
  page IDs/classes remain unchanged, but switching libraries can remount the page.
- QueryClientEventHandler now invalidates item queries on UserDataChanged.
  Played-state changes can refresh results while Alpha Jump is attached.
- useCurrentTab selects the Live TV settings key by collectionType rather than
  pathname. Supported normal library keys are unchanged; Live TV remains excluded.
- PlaybackManager removes a duplicate media-segment-manager binding. This does
  not provide a new public playback-state API; update recovery retains its guards.

Server changes include package/version updates and media/metadata fixes. Compilation
and tests against the actual 12.4 packages found no plugin API incompatibility.
This is not proof that every live server/browser integration path works.

## Validation

The automated build/test results below used temporary 12.4.0 package pins.
Those pins were reverted after validation to preserve the 12.2 minimum.

- `node --check src/alpha-jump.js`: passed.
- `node --test tests/*.test.js`: 103 passed.
- `node scripts/validate-release-abi.js`: passed, 12.4.0.0.
- Release plugin build: passed, zero warnings/errors.
- Release C# tests: 31 passed, zero failed/skipped.
- Resolved Controller and Model packages: both 12.4.0.

Maintainer live testing: reported successful on Jellyfin 12.4. Browser versions
and individual scenarios were not specified, so this does not establish full
coverage of the checklist below. The agent did not install, restart, or run a
live browser trial.

## Additional runtime checklist (individual coverage not reported)

1. Load the published v0.5.2.0 plugin in Jellyfin 12.4 and confirm it loads without errors;
   verify configuration loads/saves and library selections persist.
2. In Firefox and Chromium, verify first-click pointer jumping and both keyboard
   modes after a fresh session; verify native behavior in real dialogs/inputs.
3. Switch between two libraries of the same type and between different types.
   Confirm the replacement picker binds once and stale markers/listeners are removed.
4. Change watched state, return from item details, and repeat a jump after the list
   refreshes. Confirm pending or incomplete results remain native and settled full
   results jump without filtering.
5. Check excluded Live TV and suggestions, pagination setup/restoration, and update
   recovery during playback. Retest base-path/compressed HTML injection when used.
