# Alpha Jump test record

Date: 2026-09-20 to 2026-09-21. Prototype commit under test: local working tree based on `fe5d042038912484240d77b530b1c6e136e51c97`; this uncommitted rework has **not** been committed or pushed.

Browser/session: authorized Codex in-app browser (its Chromium version was not exposed by the available test surface); Jellyfin Server/Web identified in the UI as Grogpool 12.1; Jellyfin Enhanced 12.7.0.0-639247594740000000 was active. The user authorized a temporary authenticated JavaScript Injector script named `AJ test`. The diagnostic script used to inspect prerequisites is disabled again. No credentials, tokens, or HAR were recorded.

## Actually run

| Check | Result | Evidence |
| --- | --- | --- |
| Pinned source inspection | Passed | Local `jellyfin-web-v12.1` is tag `v12.1` / `fae41f33eb7cd636a9ef68984adb82bb247a6e1b`. Source paths and semantics are recorded in [architecture.md](architecture.md). |
| Syntax | Passed | `node --check src/alpha-jump.js` completed on 2026-09-20. |
| Focused production-path regressions | Passed | On 2026-09-21, `node --check src/alpha-jump.js` and `node --test tests/alpha-jump.test.js` passed: 16 passed, 0 failed. A minimal fake DOM drives the actual init/configuration, backup/restore, complete-render gate (including small/pending results), confirmed native-subset gate, picker capture/native-clear, `execute`, `waitForReady`, cancellation, query-change, and detach code paths. It does not establish browser compatibility. Expected error output covers denied/malformed storage and unavailable authentication. |
| Whitespace/diff check | Passed | `git diff --check` completed on 2026-09-20 with no whitespace errors (Git printed only repository line-ending warnings). |
| Served Movies DOM | Observed | Movies rendered one `#moviesPage`, one native alphabet picker with 27 buttons, one candidate LibraryToolbar, grid cards carrying `data-prefix`, and an unfiltered total of 1,538. The normal session state was `1-100 of 1,538`, Previous disabled / Next enabled. |
| Injector delivery | Observed | A temporary authenticated probe ran only after an actual browser reload. A same-document SPA route change is not a substitute for the Injector's required browser refresh after configuration changes. |
| Saved-zero served shape | Observed | Movies showed toolbar total `1,538`, no Previous/Next pager, one picker, and `1,538` `#moviesPage .card[data-prefix][data-type="Movie"]` elements. The active injected probe nevertheless reported no unprefixed key. The old unprefixed storage assumption was wrong; a saved preference is not an arming input in any case. |
| Page-size UI location and persistence | Observed | The served UI is **User Menu → Settings → Display → Libraries → Library page size**. It showed `100` and has a separate Save button. Source now verifies the actual client-local key is `<activeUserId>-libraryPageSize`; the updated prototype writes that key only as the requested automatic setup, then reloads once. This behavior remains untested in the served browser. |
| Automatic preference configuration and restoration | Passed locally | Production-path tests cover missing, explicit `100`/`250`, already-zero, multiple-user keys, unavailable authentication, malformed backup, denied storage, reinjection, user switching, one reload maximum, restoration of explicit and absent values, and no immediate reapply after restore. No live browser preference changed for these tests. |
| A click with the stale Injector copy | Failed — implementation defect found | In the saved-zero state, the existing `AJ test` copy still used the `libraryPageSize` guard. Clicking A applied Jellyfin's native alphabet filter (toolbar/card count became 73; native A was pressed; no Alpha Jump feedback or marker). Local code now uses the observed complete-render proof instead. JavaScript Injector's Import accepts exported JSON, not a standalone `.js`, so its old entry was not overwritten automatically. |
| Injector entry recovery | Resolved for this temporary session | The user manually pasted the corrected local script into `AJ test`, saved it, and returned to Movies. Served-DOM inspection found a 40,306-character `AJ test` script containing both `hasCompleteUnpaginatedResult` and `hasPotentialUnpaginatedResult`, with neither diagnostic-probe text nor a pre-existing Alpha Jump marker. This establishes delivery for this browser session only; it does not validate persistence or authorize deployment. |
| A jump on the fully rendered library | Passed | With toolbar total/card count `1,538`, clicking A left all `1,538` cards in the DOM, native `aria-pressed` for A at `false`, and added only Alpha Jump's A marker. Feedback read `First A title.` The first literal `data-prefix.startsWith('A')` card was `About Time` (`data-prefix="ABO"`), positioned at document top 1,851 after the click; the viewport was scrolled to 1,743 so it sat below the sticky header. |
| K regression jump on the fully rendered library | Passed | Clicking K retained all `1,538` cards and native K `aria-pressed="false"`, marked K, and reported `First K title.` After the configured smooth-scroll animation settled (about five seconds for this distance), the first matching card, `K-19: The Widowmaker` (`data-prefix="K-1"`), was at viewport top 108. |
| M and Z jumps on the fully rendered library | Passed | M and Z each retained all `1,538` cards and native pressed state `false`, marked only the requested enhancement letter, and announced its first title. M reached `M3GAN` (`M3G`) at viewport top 108. Z reached `Zathura: A Space Adventure` (`ZAT`) at viewport top 311; its position is lower because the document cannot scroll beyond the final row. |
| `#` and selected-letter re-click | Passed | From selected Z, `#` cleared Alpha Jump's marker, retained all cards/native `#` state, announced `At the beginning.`, and reached `scrollY=0`. After selecting A (`scrollY=1,743`), clicking A again cleared the marker, kept native A `false`, announced `At the beginning.`, and returned to `scrollY=0`. |

The controlled browser run has established two enhancement-controlled clicks in the saved-zero shape. It has **not** yet captured Network request parameters, validated all requested scenarios, or measured sustained performance. Earlier 100-item pagination observations cannot validate the unpaginated architecture.

## Required controlled browser run

Record Server version, served Web asset/version, browser/version, JavaScript Injector version/state, Jellyfin Enhanced version/state, active-user-prefixed page-size key, `movies - <parentId>` settings, and the exact local commit or working-tree diff. Do not save credentials, tokens, or unsanitized HAR files.

| Scenario | Evidence needed | Status |
| --- | --- | --- |
| Arm prerequisite | Page size zero, explicit StartIndex zero, grid, ascending SortName, and `#moviesPage` exist; `window.__alphaJumpPrototypeV1` is present after temporary console injection. | Partially observed: served `AJ test` has the corrected gate and intercepted A/K in the full-rendered grid; the isolated-window test surface could not read the page global, and explicit StartIndex/network evidence remains untested. |
| Automatic setup / reload / restore | Start from a nonzero and an absent active-user preference in a disposable browser profile. Confirm only that user's prefixed key changes, one reload occurs, the console script must be re-pasted, and `restorePagination()` restores/removes the original key after the injector is disabled. | Not run in a served browser; this action changes the signed-in user's browser/origin-local preference. |
| Page-size zero request | DevTools Network shows no item `limit`, `startIndex=0`, preserved non-alphabet filters, and no alphabet parameter during an enhancement jump. | Not run |
| Page-one / M / Z | A page-one letter, unloaded M, and Z each scroll to the first rendered matching card without native alphabet state. | Passed for the full unfiltered rendered library: A, M, and Z reached their first literal prefix matches with native state off. This was no longer a paged/unloaded scenario, so it does not test pagination or delayed rendering. |
| Roughly 1,500 titles and rapid scrolling | Record load time, card count/total, scrolling responsiveness, memory/CPU symptoms, and browser recovery. Do not call it acceptable without observed results. | Not run |
| `#` and selected-letter reset | Press `#`, then re-click a selected letter while scrolled down; verify top position, cleared enhancement state, and no native letter state. | Passed in the full unfiltered rendered library. |
| Native clear | Start with an active native alphabet, including a same-card result; verify ordinary clear, replacement readiness, and retained non-alphabet filters. | Not run in the browser. The newest local source permits a native subset only after the same alphabet-clear query was observed as complete; deterministic coverage passes. The currently served `AJ test` predates this change, so paste the latest source, save, reload, then test it. |
| Delayed load + A → Z → M | Artificially throttle if safely available; only M may finish and no native letter filter may slip through while cards are absent. | Not run |
| Cancel / Escape | Cancel during loading and confirm the status no longer appears busy. | Not run |
| Query/route changes | Change filter, search, sort, page size, and navigate away during load. Work must cancel, selection markers must clear, and changed query must not receive a stale scroll. | Not run |
| Unsupported behavior | List view, descending/non-SortName sort, nonzero StartIndex, identity/storage failure, and incomplete/pending results retain native picker behavior. | Not run |
| Missing / empty | Missing letter only reports after ready result; empty result uses the real no-items message; no false result during loading/failure. | Not run |
| Re-injection / SPA / destroy | Repeat injection, Movies → detail → Movies, then `destroy('testing complete')`, refresh, and verify native picker plus marker cleanup. | Not run |
| Coexistence | Playback, card click/selection, context menu, keyboard picker activation, sticky headers, reduced motion, and Jellyfin Enhanced enabled/disabled. | Not run |

## Exact manual procedure

1. Use a disposable or explicitly authorized temporary browser profile. This test writes the active user's browser/origin-local Library page-size preference and reloads once; it does not change the Jellyfin server.
2. In DevTools, paste the local [src/alpha-jump.js](../src/alpha-jump.js). Record the active-user prefixed key and its previous value/absence before pasting. The first run may reload; paste the console script again afterward, then set `window.__alphaJumpPrototypeV1.config.debug = true` and verify the instance exists.
3. Open Movies with ascending Name/SortName grid view, clear native alphabet, and record the toolbar/card counts. Confirm all constrained results have rendered before proceeding.
4. Run the table above while observing Network. Record sanitized request URLs/parameters and outcomes here immediately.
5. To restore, first disable/remove the Injector entry or stop re-pasting the console script. Run `window.__alphaJumpPrototypeV1?.restorePagination()`, then `window.__alphaJumpPrototypeV1?.destroy('testing complete')`, and refresh manually.

## Shows extension — 2026-09-21

Added modern Shows main-tab support using the pinned v12.1 LibraryRoutes (/tv, CollectionType.Tvshows, LibraryTab.Series), LibraryPage (#tvshowsPage), and useCurrentTab/getDefaultViewIndex semantics. View settings are series - <parentId>; cards are data-type="Series". Explicit nonzero tabs and non-Series saved landing views stay native. Local tests cover Series jumping and tab/config opt-outs alongside the Movies suite. Live Shows testing remains pending; no Injector entry was changed by this implementation.

## First-navigation activation fix — 2026-09-21

User reports full results but native filtering on first navigation, with reload restoring Alpha Jump. A local production-path regression reproduced a missed attachment when cards mount before the external toolbar count settles. The mount observer now includes toolbar/count insertion and text changes, and a narrowly filtered document capture listener attempts synchronous attachment on the first supported picker click. It does not suppress unrelated or unsupported clicks. Movies/Shows late-count tests and first-click recovery/cleanup pass locally; the exact live-session cause and fresh-session behavior still require browser verification.

## First-click ownership follow-up — 2026-09-21

User reports the first click still applies native filtering, while a second works. The prior mount repair did not cover a picker clicked before complete-result proof was available. A verified active-user page-size-zero preference now permits owning/queuing a click in a supported view while readiness is pending. It is not completeness evidence: actual jumping and missing-letter feedback now require non-pending cards exactly matching the toolbar total. The # shortcut uses the same readiness gate. New production-path tests cover a first K click during loading for both Movies and Shows, plus rejection of partial results. Live confirmation is still pending.
