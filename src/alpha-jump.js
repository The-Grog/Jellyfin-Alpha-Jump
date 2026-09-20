/*
 * Jellyfin Alpha Jump prototype for Jellyfin Web 12.1 modern Movies.
 * Paste this file into an injector only after completing the browser checklist.
 * It intentionally uses only public browser state and ordinary native controls.
 */
(function alphaJumpPrototype() {
    'use strict';

    const CONFIG = {
        enabled: true,
        moviesOnly: true,
        smoothScroll: true,
        debug: false,
        respectSortOrder: true,
        // All native page-changing actions: Previous/Next, native-alphabet clear, and restoration.
        maxNavigationActions: 80,
        // Includes clearing a native alphabet filter, scanning, and best-effort restoration.
        maxElapsedMs: 60000,
        // Per native transition. This is a failure timeout, not a polling cadence.
        maxPageSettleMs: 8000,
        // Per native transition: maximum time without relevant pending/settings/card progress.
        maxNoProgressMs: 4000
    };

    const INSTANCE_KEY = '__alphaJumpPrototypeV1';
    const LETTERS = new Set(['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']);
    const LOG_PREFIX = '[AlphaJump]';

    if (window[INSTANCE_KEY] && typeof window[INSTANCE_KEY].destroy === 'function') {
        window[INSTANCE_KEY].destroy('re-injected');
    }

    const state = {
        selected: null,
        selectedQueryId: null,
        boundQueryId: null,
        run: null,
        picker: null,
        pager: null,
        observer: null,
        feedback: null,
        style: null,
        nativeClear: null,
        destroyed: false,
        pickerClick: null,
        pagerClick: null,
        hashChange: null,
        popState: null,
        keyDown: null,
        userClick: null
    };

    function log(...args) {
        if (CONFIG.debug) console.debug(LOG_PREFIX, ...args);
    }

    function error(...args) {
        console.error(LOG_PREFIX, ...args);
    }

    function escapeSelector(value) {
        return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    function routeInfo() {
        const hash = window.location.hash || '';
        const splitAt = hash.indexOf('?');
        const path = (splitAt < 0 ? hash : hash.slice(0, splitAt)).toLowerCase();
        const params = new URLSearchParams(splitAt < 0 ? '' : hash.slice(splitAt + 1));
        const parentId = params.get('topParentId');
        return { hash, path, parentId, isMovies: /(?:^|\/)movies(?:$|\/)/.test(path) && params.get('collectionType') === 'movies' };
    }

    function readSettings(route) {
        if (!route.parentId) return null;
        try {
            const raw = window.localStorage.getItem(`movies - ${route.parentId}`);
            return raw ? JSON.parse(raw) : null;
        } catch (caught) {
            error('Could not read the public Movies view settings.', caught);
            return null;
        }
    }

    function canonical(value) {
        if (Array.isArray(value)) return value.map(canonical);
        if (value && typeof value === 'object') {
            return Object.keys(value).sort().reduce((result, key) => {
                result[key] = canonical(value[key]);
                return result;
            }, {});
        }
        return value;
    }

    // Query identity deliberately excludes pagination and the native alphabet value.
    // The native alphabet is tracked separately because this prototype clears it first.
    function queryIdentity(route, settings) {
        const querySettings = { ...settings };
        delete querySettings.StartIndex;
        delete querySettings.Alphabet;
        return JSON.stringify(canonical({ hash: route.hash, parentId: route.parentId, settings: querySettings }));
    }

    function findPicker() {
        const roots = Array.from(document.querySelectorAll('.alphaPicker-fixed-right'));
        if (roots.length !== 1) return null;
        const groups = roots[0].querySelectorAll('[role="group"].MuiToggleButtonGroup-vertical');
        if (groups.length !== 1) return null;
        const buttons = Array.from(groups[0].querySelectorAll('button[type="button"][value]'));
        if (buttons.length !== LETTERS.size || buttons.some(button => !LETTERS.has(button.value))) return null;
        return { root: roots[0], group: groups[0], buttons };
    }

    function buttonForIcon(testId) {
        const icons = Array.from(document.querySelectorAll(`svg[data-testid="${escapeSelector(testId)}"]`));
        const buttons = icons.map(icon => icon.closest('button')).filter(Boolean);
        return buttons.length === 1 ? buttons[0] : null;
    }

    // Source v12.1 renders these two MUI icon components inside the pager buttons.
    // This intentionally does not depend on localized title or visible text.
    function findPager() {
        const previous = buttonForIcon('NavigateBeforeIcon');
        const next = buttonForIcon('NavigateNextIcon');
        if (!previous || !next || previous === next || previous.parentElement !== next.parentElement) return null;
        const toolbar = previous.closest('.MuiToolbar-root');
        if (!toolbar) return null;
        return { previous, next, toolbar };
    }

    function cardSignature(cards) {
        return cards.map(card => `${card.dataset.id || ''}:${card.dataset.prefix || ''}`).join('|');
    }

    function selectedNativeLetter(picker) {
        const pressed = picker.buttons.filter(button => button.getAttribute('aria-pressed') === 'true');
        return pressed.length === 1 ? pressed[0].value : null;
    }

    function hasPendingMarker(pager) {
        // v12.1's LibraryToolbar emits the literal bullet only while itemsResult.isPending.
        return Array.from(pager.toolbar.querySelectorAll('.MuiChip-label')).some(node => node.textContent.trim() === '∙');
    }

    function getContext() {
        const route = routeInfo();
        if (!route.isMovies || !document.querySelector('#moviesPage')) return null;
        const settings = readSettings(route);
        const picker = findPicker();
        const pager = findPager();
        if (!settings || !picker || !pager) return null;
        const cards = Array.from(document.querySelectorAll('#moviesPage .card[data-prefix][data-type="Movie"]'));
        const emptyResult = !!document.querySelector('#moviesPage .noItemsMessage.centerMessage');
        const startIndex = Number(settings.StartIndex || 0);
        if (!Number.isFinite(startIndex) || startIndex < 0) return null;
        return {
            route,
            settings,
            picker,
            pager,
            cards,
            emptyResult,
            cardSignature: cardSignature(cards),
            startIndex,
            nativeAlphabet: selectedNativeLetter(picker),
            queryId: queryIdentity(route, settings)
        };
    }

    function hasSupportedSort(settings) {
        return Array.isArray(settings.SortBy)
            && settings.SortBy.length === 1
            && settings.SortBy[0] === 'SortName'
            && settings.SortOrder === 'Ascending';
    }

    function isCompatible(context) {
        return !!context
            && (!CONFIG.moviesOnly || context.route.isMovies)
            && (!CONFIG.respectSortOrder || hasSupportedSort(context.settings))
            && context.settings.ViewMode === 'grid';
    }

    // Only a rendered card grid or Jellyfin's source-shaped NoItemsMessage can arm a click.
    // isCompatible intentionally remains true during an in-flight replacement so settle waits
    // do not mistake Jellyfin's temporary Loading component for an unsupported layout.
    function isSupported(context) {
        return isCompatible(context) && (context.cards.length > 0 || context.emptyResult);
    }

    function ensureFeedback(context) {
        if (state.feedback && state.feedback.isConnected) return state.feedback;
        const host = context.picker.root;
        const feedback = document.createElement('div');
        feedback.className = 'alpha-jump-feedback';
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'polite');
        feedback.style.cssText = 'position:fixed;right:3.5rem;bottom:1rem;z-index:1201;max-width:18rem;padding:.5rem .75rem;background:var(--theme-background,rgba(0,0,0,.85));color:inherit;border-radius:.25rem;font-size:.875rem;box-shadow:0 2px 8px rgba(0,0,0,.35);';
        host.appendChild(feedback);
        state.feedback = feedback;
        return feedback;
    }

    function ensureStyles() {
        if (state.style && state.style.isConnected) return;
        const style = document.createElement('style');
        style.id = 'alpha-jump-prototype-style';
        style.textContent = [
            '.alphaPicker-fixed-right button[data-alpha-jump-selected="true"] {',
            '  outline: 2px solid currentColor;',
            '  outline-offset: -2px;',
            '  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .22);',
            '  font-weight: 700;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
        state.style = style;
    }

    function removeStyles() {
        if (state.style) state.style.remove();
        state.style = null;
    }

    function announce(context, message, cancelable) {
        const feedback = ensureFeedback(context);
        feedback.replaceChildren(document.createTextNode(message));
        if (cancelable) {
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            cancel.style.cssText = 'margin-left:.5rem;';
            cancel.addEventListener('click', () => cancelRun('cancelled by user', true));
            feedback.appendChild(cancel);
        }
    }

    function clearFeedback() {
        if (state.feedback) state.feedback.remove();
        state.feedback = null;
    }

    function applySelection(context, value) {
        ensureStyles();
        state.selected = value;
        state.selectedQueryId = value === null ? null : context.queryId;
        context.picker.buttons.forEach(button => {
            const selected = button.value === value;
            button.classList.toggle('alpha-jump-selected', selected);
            button.setAttribute('data-alpha-jump-selected', selected ? 'true' : 'false');
            if (selected) button.setAttribute('aria-current', 'true');
            else button.removeAttribute('aria-current');
        });
    }

    function clearSelection(context) {
        applySelection(context, null);
    }

    function removeSelectionMarkers(picker) {
        if (!picker) return;
        picker.buttons.forEach(button => {
            button.classList.remove('alpha-jump-selected');
            button.removeAttribute('data-alpha-jump-selected');
            button.removeAttribute('aria-current');
        });
    }

    function runIsCurrent(run) {
        return state.run === run && !state.destroyed && !run.cancelled;
    }

    function cancelRun(reason, announceCancellation) {
        const run = state.run;
        if (!run) return;
        run.cancelled = true;
        state.run = null;
        state.nativeClear = null;
        log('Cancelled:', reason);
        if (announceCancellation) {
            const context = getContext();
            if (context) announce(context, 'Alpha jump cancelled.', false);
        }
    }

    function remainingNavigation(run) {
        return CONFIG.maxNavigationActions - run.navigationActions;
    }

    function assertBudget(run) {
        if (!runIsCurrent(run)) throw new Error('cancelled');
        if (performance.now() - run.startedAt > CONFIG.maxElapsedMs) throw new Error('time budget exhausted');
        if (remainingNavigation(run) <= 0) throw new Error('navigation budget exhausted');
    }

    function settledFor(context, wantedStart, oldSignature) {
        const isExpectedStart = wantedStart.test(context.startIndex);
        if (!isCompatible(context) || !isExpectedStart) return false;
        if (hasPendingMarker(context.pager)) return false;
        if (wantedStart.nativeAlphabet !== undefined && context.nativeAlphabet !== wantedStart.nativeAlphabet) return false;
        const previousShouldBeEnabled = wantedStart.previousEnabled(context.startIndex);
        if (context.pager.previous.disabled === previousShouldBeEnabled) return false;
        // An absent card set is settled only when Jellyfin rendered its NoItemsMessage, never
        // merely because a loading or error transition has no cards.
        if (!context.cards.length) return context.emptyResult;
        // Old cards are not accepted for a page change. Native alphabet clear can legitimately
        // retain the same IDs, but only after the separately verified Alphabet:null state.
        if (!wantedStart.allowSameCards && context.cardSignature === oldSignature) return false;
        return true;
    }

    function progressSnapshot(context) {
        if (!context || !isCompatible(context)) return null;
        return JSON.stringify({
            startIndex: context.startIndex,
            cards: context.cardSignature,
            pending: hasPendingMarker(context.pager),
            nativeAlphabet: context.nativeAlphabet,
            emptyResult: context.emptyResult,
            previousDisabled: context.pager.previous.disabled
        });
    }

    function waitForSettled(run, wantedStart, oldSignature, label) {
        return new Promise((resolve, reject) => {
            let done = false;
            let timeout = null;
            let noProgressTimeout = null;
            let lastProgressSnapshot = null;
            const finish = (failure, context) => {
                if (done) return;
                done = true;
                observer.disconnect();
                if (timeout !== null) window.clearTimeout(timeout);
                if (noProgressTimeout !== null) window.clearTimeout(noProgressTimeout);
                failure ? reject(failure) : resolve(context);
            };
            const resetNoProgressTimeout = () => {
                if (noProgressTimeout !== null) window.clearTimeout(noProgressTimeout);
                noProgressTimeout = window.setTimeout(
                    () => finish(new Error(`${label} made no relevant progress within ${CONFIG.maxNoProgressMs} ms`)),
                    CONFIG.maxNoProgressMs
                );
            };
            const inspect = () => {
                if (!runIsCurrent(run)) return finish(new Error('cancelled'));
                const context = getContext();
                if (!isCompatible(context)) return finish(new Error('supported Movies state disappeared'));
                if (context.queryId !== run.queryId) return finish(new Error('query changed'));
                const currentProgressSnapshot = progressSnapshot(context);
                if (currentProgressSnapshot !== lastProgressSnapshot) {
                    lastProgressSnapshot = currentProgressSnapshot;
                    resetNoProgressTimeout();
                }
                if (settledFor(context, wantedStart, oldSignature)) {
                    // One frame ensures React has committed the matching page, without using polling.
                    window.requestAnimationFrame(() => {
                        const confirmed = getContext();
                        if (runIsCurrent(run) && confirmed && settledFor(confirmed, wantedStart, oldSignature)) finish(null, confirmed);
                    });
                }
            };
            const observer = new MutationObserver(inspect);
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-disabled', 'disabled', 'aria-pressed', 'data-prefix', 'data-id'] });
            const remainingMs = CONFIG.maxElapsedMs - (performance.now() - run.startedAt);
            const timeoutMs = Math.min(CONFIG.maxPageSettleMs, Math.max(0, remainingMs));
            timeout = window.setTimeout(
                () => finish(new Error(remainingMs <= 0 ? 'time budget exhausted' : `${label} did not settle within ${timeoutMs} ms`)),
                timeoutMs
            );
            resetNoProgressTimeout();
            inspect();
        });
    }

    function activatePager(run, direction) {
        const before = getContext();
        if (!isSupported(before)) throw new Error('unsupported state before paging');
        assertBudget(run);
        const button = direction === 'previous' ? before.pager.previous : before.pager.next;
        if (button.disabled) throw new Error(direction === 'next' ? 'end of list' : 'cannot return to page one');
        run.navigationActions += 1;
        run.expectedStart = before.startIndex;
        button.click(); // Ordinary Jellyfin pager handler; no fetches or React state are invoked by this script.
        return waitForSettled(
            run,
            {
                test: direction === 'previous' ? index => index < before.startIndex : index => index > before.startIndex,
                previousEnabled: index => index > 0,
                allowSameCards: false
            },
            before.cardSignature,
            `native ${direction} page`
        )
            .then(context => {
                // Page size is user-configurable, so source only lets us assert directional movement.
                if (direction === 'previous' && context.startIndex >= before.startIndex) throw new Error('Previous did not move backward');
                if (direction === 'next' && context.startIndex <= before.startIndex) throw new Error('Next did not move forward');
                return context;
            });
    }

    async function clearNativeAlphabet(run, context) {
        const active = context.nativeAlphabet;
        if (!active) return context;
        const activeButton = context.picker.buttons.find(button => button.value === active);
        if (!activeButton) throw new Error('native alphabet state cannot be cleared safely');
        assertBudget(run);
        run.navigationActions += 1;
        state.nativeClear = activeButton;
        activeButton.click(); // Exactly one bypass through the ordinary exclusive ToggleButtonGroup action.
        const cleared = await waitForSettled(
            run,
            {
                test: index => index === 0,
                previousEnabled: () => false,
                nativeAlphabet: null,
                allowSameCards: true
            },
            context.cardSignature,
            'native alphabet clear'
        );
        state.nativeClear = null;
        if (cleared.nativeAlphabet) throw new Error('native alphabet filter remained active');
        return cleared;
    }

    async function returnToStart(run, context) {
        let current = context;
        while (current.startIndex > 0) {
            current = await activatePager(run, 'previous');
        }
        return current;
    }

    function firstMatchingCard(context, letter) {
        return context.cards.find(card => String(card.dataset.prefix || '').startsWith(letter)) || null;
    }

    function scrollToCard(card) {
        const header = document.querySelector('header, .MuiAppBar-root');
        const headerHeight = header ? header.getBoundingClientRect().height : 0;
        const y = window.scrollY + card.getBoundingClientRect().top - headerHeight - 8;
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: Math.max(0, y), behavior: CONFIG.smoothScroll && !reduceMotion ? 'smooth' : 'auto' });
    }

    function scrollToTop() {
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: CONFIG.smoothScroll && !reduceMotion ? 'smooth' : 'auto' });
    }

    function initialExpectation(context) {
        return {
            test: index => index === context.startIndex,
            previousEnabled: index => index > 0,
            nativeAlphabet: context.nativeAlphabet,
            allowSameCards: true
        };
    }

    async function restoreInitialPage(run) {
        let current = getContext();
        if (!isSupported(current) || current.queryId !== run.queryId) return false;
        while (current.startIndex !== run.initialStartIndex) {
            if (performance.now() - run.startedAt > CONFIG.maxElapsedMs || remainingNavigation(run) <= 0) return false;
            current = await activatePager(run, current.startIndex > run.initialStartIndex ? 'previous' : 'next');
        }
        window.scrollTo({ top: run.initialScrollY, behavior: 'auto' });
        return true;
    }

    async function execute(run, letter) {
        let context = getContext();
        if (!isCompatible(context) || context.queryId !== run.queryId) throw new Error('unsupported or changed initial state');
        context = await waitForSettled(run, initialExpectation(context), context.cardSignature, 'initial Movies results');
        context = await clearNativeAlphabet(run, context);
        context = await returnToStart(run, context);
        if (!runIsCurrent(run)) return;

        if (letter === null || letter === '#') {
            clearSelection(context);
            if (letter === '#') applySelection(context, '#');
            scrollToTop();
            announce(context, letter === '#' ? 'At the beginning of the matching Movies list.' : 'Alpha jump cleared; at page one.', false);
            return;
        }

        while (runIsCurrent(run)) {
            const match = firstMatchingCard(context, letter);
            if (match) {
                applySelection(context, letter);
                scrollToCard(match);
                announce(context, `Jumped to ${letter}.`, false);
                return;
            }

            // Next is end-of-list evidence only after waitForSettled has verified real cards/
            // a settled empty view, the expected settings start index, and no pending marker.
            if (context.pager.next.disabled) {
                const restored = await restoreInitialPage(run);
                const latest = getContext();
                if (latest) {
                    clearSelection(latest);
                    announce(latest, restored ? `No matching ${letter} titles.` : `No matching ${letter} titles; restoration was incomplete.`, false);
                }
                return;
            }
            context = await activatePager(run, 'next');
        }
    }

    function finishRun(run, caught) {
        if (!runIsCurrent(run)) return;
        state.run = null;
        state.nativeClear = null;
        const context = getContext();
        if (!context) return;
        if (caught && caught.message === 'cancelled') return;
        if (caught && /budget exhausted/.test(caught.message)) {
            clearSelection(context);
            announce(context, 'Search incomplete: navigation budget exhausted.', false);
            return;
        }
        error('Jump failed:', caught);
        clearSelection(context);
        announce(context, 'Alpha jump stopped; native controls remain available.', false);
    }

    function begin(letter) {
        const context = getContext();
        if (!isCompatible(context)) return;
        const supersedingRun = !!state.run;
        cancelRun('superseded');
        const target = !supersedingRun && state.selected === letter && state.selectedQueryId === context.queryId ? null : letter;
        clearSelection(context);
        const run = {
            queryId: context.queryId,
            startedAt: performance.now(),
            initialStartIndex: context.startIndex,
            initialScrollY: window.scrollY,
            navigationActions: 0,
            cancelled: false
        };
        state.run = run;
        announce(context, target ? `Finding ${target}…` : 'Returning to page one…', true);
        execute(run, target)
            .then(() => {
                if (runIsCurrent(run)) {
                    state.run = null;
                    state.nativeClear = null;
                }
            })
            .catch(caught => finishRun(run, caught));
    }

    function onPickerClick(event) {
        const button = event.target.closest('button[type="button"][value]');
        if (!button || !state.picker || !state.picker.group.contains(button) || !LETTERS.has(button.value)) return;
        if (state.nativeClear === button && !event.isTrusted) {
            // Narrow bypass for our own single native deselect click only.
            return;
        }
        const context = getContext();
        // While an enhancement-owned page replacement is loading, keep ownership of the
        // verified compatible picker: the newer letter supersedes the old run instead of
        // falling through to Jellyfin's native alphabet filter.
        if (!isCompatible(context) || (!isSupported(context) && !state.run)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        begin(button.value);
    }

    function onPagerClick(event) {
        if (!event.isTrusted || !state.run) return;
        const button = event.currentTarget;
        if (button === state.pager?.previous || button === state.pager?.next) {
            cancelRun('user paging change', true);
        }
    }

    function onKeyDown(event) {
        if (event.key === 'Escape' && state.run) {
            event.preventDefault();
            cancelRun('cancelled by Escape', true);
        }
    }

    // Bubble phase deliberately runs after React's normal click handling. This is observation
    // only: it catches same-document local-storage setting changes even when the visible cards
    // happen not to change, and it never prevents or rewrites a native event.
    function onUserClick() {
        window.requestAnimationFrame(bindSurface);
    }

    function detachSurface() {
        removeSelectionMarkers(state.picker);
        if (state.picker && state.pickerClick) state.picker.group.removeEventListener('click', state.pickerClick, true);
        if (state.pager && state.pagerClick) {
            state.pager.previous.removeEventListener('click', state.pagerClick, true);
            state.pager.next.removeEventListener('click', state.pagerClick, true);
        }
        state.picker = null;
        state.pager = null;
        clearFeedback();
    }

    function bindSurface() {
        if (state.destroyed) return;
        const context = getContext();
        const compatible = isCompatible(context);
        const supported = isSupported(context);
        const changed = !context || state.picker?.group !== context.picker.group || state.pager?.next !== context.pager.next;
        if (!compatible) {
            if (state.run) cancelRun('route, sort, filter, or view changed');
            state.selected = null;
            state.selectedQueryId = null;
            state.boundQueryId = null;
            detachSurface();
            return;
        }
        if (state.boundQueryId && context.queryId !== state.boundQueryId) {
            if (state.run) cancelRun('query changed', true);
            state.selected = null;
            state.selectedQueryId = null;
            clearSelection(context);
        }
        state.boundQueryId = context.queryId;
        // Retain native listeners while an enhancement-owned page replacement is loading;
        // otherwise detach until a rendered card grid or genuine NoItemsMessage returns.
        if (!supported) {
            if (!state.run) detachSurface();
            return;
        }
        if (!changed) {
            return;
        }
        detachSurface();
        state.picker = context.picker;
        state.pager = context.pager;
        state.pickerClick = onPickerClick;
        state.pagerClick = onPagerClick;
        state.picker.group.addEventListener('click', state.pickerClick, true);
        state.pager.previous.addEventListener('click', state.pagerClick, true);
        state.pager.next.addEventListener('click', state.pagerClick, true);
        applySelection(context, state.selected);
        log('Armed for', context.route.parentId);
    }

    function initialize() {
        if (!CONFIG.enabled) return;
        state.hashChange = () => {
            cancelRun('navigation');
            state.selected = null;
            state.selectedQueryId = null;
            detachSurface();
            bindSurface();
        };
        state.popState = state.hashChange;
        state.keyDown = onKeyDown;
        state.userClick = onUserClick;
        window.addEventListener('hashchange', state.hashChange);
        window.addEventListener('popstate', state.popState);
        document.addEventListener('keydown', state.keyDown, true);
        document.addEventListener('click', state.userClick, false);
        state.observer = new MutationObserver(bindSurface);
        state.observer.observe(document.documentElement, { childList: true, subtree: true });
        bindSurface();
    }

    function destroy(reason) {
        if (state.destroyed) return;
        state.destroyed = true;
        cancelRun(reason || 'disabled');
        detachSurface();
        if (state.observer) state.observer.disconnect();
        if (state.hashChange) window.removeEventListener('hashchange', state.hashChange);
        if (state.popState) window.removeEventListener('popstate', state.popState);
        if (state.keyDown) document.removeEventListener('keydown', state.keyDown, true);
        if (state.userClick) document.removeEventListener('click', state.userClick, false);
        removeStyles();
        delete window[INSTANCE_KEY];
        log('Destroyed:', reason || 'disabled');
    }

    window[INSTANCE_KEY] = { destroy, config: CONFIG };
    initialize();
}());
