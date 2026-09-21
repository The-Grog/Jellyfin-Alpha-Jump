# Alpha Jump test record

Date: 2026-09-20 to 2026-09-21. Prototype commit under test: local working tree based on `fe5d042038912484240d77b530b1c6e136e51c97`; this uncommitted rework has **not** been committed or pushed.

Browser/session: authorized Codex in-app browser (its Chromium version was not exposed by the available test surface); Jellyfin Server/Web identified in the UI as Grogpool 12.1; Jellyfin Enhanced 12.7.0.0-639247594740000000 was active. The user authorized a temporary authenticated JavaScript Injector script named `AJ test`. The diagnostic script used to inspect prerequisites is disabled again. No credentials, tokens, or HAR were recorded.

## Actually run

| Check | Result | Evidence |
| --- | --- | --- |
| Pinned source inspection | Passed | Local `jellyfin-web-v12.1` is tag `v12.1` / `fae41f33eb7cd636a9ef68984adb82bb247a6e1b`. Source paths and semantics are recorded in [architecture.md](architecture.md). |
| Syntax | Passed | `node --check src/alpha-jump.js` completed on 2026-09-20. |
| Focused production-path regressions | Passed | On 2026-09-21, `node --check src/alpha-jump.js` and `node --test tests/alpha-jump.test.js` passed: 6 passed, 0 failed. A minimal fake DOM drives the actual context, complete-render gate, picker capture/native-clear, `execute`, `waitForReady`, cancellation, query-change, and detach code paths. It does not establish browser compatibility. |
| Whitespace/diff check | Passed | `git diff --check` completed on 2026-09-20 with no whitespace errors (Git printed only repository line-ending warnings). |
| Served Movies DOM | Observed | Movies rendered one `#moviesPage`, one native alphabet picker with 27 buttons, one candidate LibraryToolbar, grid cards carrying `data-prefix`, and an unfiltered total of 1,538. The normal session state was `1-100 of 1,538`, Previous disabled / Next enabled. |
| Injector delivery | Observed | A temporary authenticated probe ran only after an actual browser reload. A same-document SPA route change is not a substitute for the Injector's required browser refresh after configuration changes. |
| Saved-zero served shape | Observed | Movies showed toolbar total `1,538`, no Previous/Next pager, one picker, and `1,538` `#moviesPage .card[data-prefix][data-type="Movie"]` elements. The active injected probe nevertheless reported `pageSize: null`; the served storage key is not a reliable arming input. |
| Page-size UI location and persistence | Observed, user action needed | The served UI is **User Menu → Settings → Display → Libraries → Library page size**. It showed `100` and has a separate Save button. A developer-storage change to zero did not survive a hard refresh; the prototype never writes that key. Set the UI control to `0`, click Save, return to Movies, and do not refresh before the next arm test. |
| A click with the stale Injector copy | Failed — implementation defect found | In the saved-zero state, the existing `AJ test` copy still used the `libraryPageSize` guard. Clicking A applied Jellyfin's native alphabet filter (toolbar/card count became 73; native A was pressed; no Alpha Jump feedback or marker). Local code now uses the observed complete-render proof instead. JavaScript Injector's Import accepts exported JSON, not a standalone `.js`, so its old entry was not overwritten automatically. |

The controlled browser run has started, but no enhancement-controlled letter click, network-parameter validation, full-card-count validation, or performance result has passed yet. Earlier 100-item pagination observations cannot validate the unpaginated architecture.

## Required controlled browser run

Record Server version, served Web asset/version, browser/version, JavaScript Injector version/state, Jellyfin Enhanced version/state, initial `libraryPageSize`, `movies - <parentId>` settings, and the exact local commit or working-tree diff. Do not save credentials, tokens, or unsanitized HAR files.

| Scenario | Evidence needed | Status |
| --- | --- | --- |
| Arm prerequisite | Page size zero, explicit StartIndex zero, grid, ascending SortName, and `#moviesPage` exist; `window.__alphaJumpPrototypeV1` is present after temporary console injection. | Not run |
| Page-size zero request | DevTools Network shows no item `limit`, `startIndex=0`, preserved non-alphabet filters, and no alphabet parameter during an enhancement jump. | Not run |
| Page-one / M / Z | A page-one letter, unloaded M, and Z each scroll to the first rendered matching card without native alphabet state. | Not run |
| Roughly 1,500 titles and rapid scrolling | Record load time, card count/total, scrolling responsiveness, memory/CPU symptoms, and browser recovery. Do not call it acceptable without observed results. | Not run |
| Native clear | Start with an active native alphabet, including a same-card result; verify ordinary clear, replacement readiness, and retained non-alphabet filters. | Not run |
| Delayed load + A → Z → M | Artificially throttle if safely available; only M may finish and no native letter filter may slip through while cards are absent. | Not run |
| Cancel / Escape | Cancel during loading and confirm the status no longer appears busy. | Not run |
| Query/route changes | Change filter, search, sort, page size, and navigate away during load. Work must cancel, selection markers must clear, and changed query must not receive a stale scroll. | Not run |
| Unsupported behavior | List view, descending/non-SortName sort, page size nonzero, and nonzero StartIndex retain native picker behavior. | Not run |
| Missing / empty | Missing letter only reports after ready result; empty result uses the real no-items message; no false result during loading/failure. | Not run |
| Re-injection / SPA / destroy | Repeat injection, Movies → detail → Movies, then `destroy('testing complete')`, refresh, and verify native picker plus marker cleanup. | Not run |
| Coexistence | Playback, card click/selection, context menu, keyboard picker activation, sticky headers, reduced motion, and Jellyfin Enhanced enabled/disabled. | Not run |

## Exact manual procedure

1. Use a disposable or authorized temporary browser session. In **User Menu → Settings → Display → Libraries**, set **Library page size** to `0` and click **Save**. Return to Movies without refreshing. Do not change server settings.
2. Open Movies with ascending Name/SortName grid view, clear native alphabet, and record the settings/result count. Confirm all constrained results have rendered before proceeding.
3. In DevTools, paste the local [src/alpha-jump.js](../src/alpha-jump.js), then set `window.__alphaJumpPrototypeV1.config.debug = true` and verify the instance exists.
4. Run the table above while observing Network. Record sanitized request URLs/parameters and outcomes here immediately.
5. Finish with `window.__alphaJumpPrototypeV1?.destroy('testing complete')`, refresh, and verify native alphabet behavior. Do not install through JavaScript Injector unless review accepts the recorded result.
