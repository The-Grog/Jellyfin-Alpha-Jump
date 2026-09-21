/*
 * Jellyfin Alpha Jump prototype for Jellyfin Web 12.1 modern Movies.
 *
 * This is deliberately a browser-only DOM enhancement. It requires the user's
 * Library page size preference to be 0; it never changes that setting and it
 * never requests items itself. The served Web client need not expose that
 * preference through localStorage, so arming is proven from the rendered
 * result instead of trusting an implementation-detail storage key.
 */
(function bootstrapAlphaJump(factory) {
    if (typeof window === 'undefined' && typeof module === 'object' && module.exports) {
        module.exports = factory;
        return;
    }
    // JavaScript Injector can evaluate a custom script from the document head,
    // before the parser has created document.body. init() observes the body, so
    // wait for it rather than failing silently inside the injector's wrapper.
    const start = () => factory(window).init();
    if (window.document?.body) start();
    else window.addEventListener('DOMContentLoaded', start, { once: true });
}(function createAlphaJump(root) {
    'use strict';

    const doc = root.document;
    const CONFIG = {
        enabled: true,
        moviesOnly: true,
        smoothScroll: true,
        debug: false,
        respectSortOrder: true,
        // Bounds a native alphabet-clear replacement and initial readiness wait.
        maxReadyWaitMs: 8000,
        // Bounds a complete request, including the optional native clear.
        maxElapsedMs: 15000
    };
    const INSTANCE_KEY = '__alphaJumpPrototypeV1';
    const LETTERS = new Set(['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']);
    const LOG_PREFIX = '[AlphaJump]';
    const state = {
        destroyed: false,
        selected: null,
        selectedQueryId: null,
        picker: null,
        pickerClick: null,
        page: null,
        pageClick: null,
        pageObserver: null,
        mountObserver: null,
        lifecycleFrame: 0,
        run: null,
        sequence: 0,
        nativeBypassButton: null,
        feedback: null,
        style: null,
        hashChange: null,
        popState: null,
        keyDown: null,
        confirmedUnpaginatedQueryId: null,
        confirmedUnpaginatedTotal: null
    };

    function log(...args) {
        if (CONFIG.debug) console.debug(LOG_PREFIX, ...args);
    }

    function reportError(...args) {
        console.error(LOG_PREFIX, ...args);
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

    function routeInfo() {
        const hash = root.location.hash || '';
        const splitAt = hash.indexOf('?');
        const path = (splitAt < 0 ? hash : hash.slice(0, splitAt)).toLowerCase();
        const params = new URLSearchParams(splitAt < 0 ? '' : hash.slice(splitAt + 1));
        const parentId = params.get('topParentId');
        return {
            hash,
            parentId,
            isMovies: /(?:^|\/)movies(?:$|\/)/.test(path) && params.get('collectionType') === 'movies'
        };
    }

    // v12.1 getSettingsKey(LibraryTab.Movies, parentId) produces this lowercase key.
    function readViewSettings(route) {
        if (!route.parentId) return null;
        try {
            const raw = root.localStorage.getItem(`movies - ${route.parentId}`);
            return raw ? JSON.parse(raw) : null;
        } catch (caught) {
            reportError('Could not read Movies view settings.', caught);
            return null;
        }
    }

    // userSettings.libraryPageSize() reads this unprefixed local-storage key with
    // enableOnServer=false and returns 100 when it is absent or malformed.
    function readLibraryPageSize() {
        try {
            const raw = root.localStorage.getItem('libraryPageSize');
            return raw === '0' ? 0 : Number.parseInt(raw || '', 10) || 100;
        } catch (caught) {
            reportError('Could not read Library page size.', caught);
            return null;
        }
    }

    function getPage() {
        const pages = Array.from(doc.querySelectorAll('#moviesPage'));
        return pages.length === 1 ? pages[0] : null;
    }

    function findPicker(page) {
        const roots = Array.from(page.querySelectorAll('.alphaPicker-fixed-right'));
        if (roots.length !== 1) return null;
        const groups = roots[0].querySelectorAll('[role="group"].MuiToggleButtonGroup-vertical');
        if (groups.length !== 1) return null;
        const buttons = Array.from(groups[0].querySelectorAll('button[type="button"][value]'));
        if (buttons.length !== LETTERS.size || buttons.some(button => !LETTERS.has(button.value))) return null;
        return { root: roots[0], group: groups[0], buttons };
    }

    function nativeAlphabet(picker) {
        const pressed = picker.buttons.filter(button => button.getAttribute('aria-pressed') === 'true');
        return pressed.length === 1 ? pressed[0].value : null;
    }

    function cardsIn(page) {
        return Array.from(page.querySelectorAll('.card[data-prefix][data-type="Movie"]'));
    }

    // LibraryToolbar is rendered by AppLayout, outside the Page/#moviesPage
    // subtree. In v12.1 Movies it is the one MUI toolbar containing the count chip.
    function findLibraryToolbar() {
        const candidates = Array.from(doc.querySelectorAll('.MuiToolbar-root'))
            .filter(toolbar => toolbar.querySelector('.MuiChip-label'));
        return candidates.length === 1 ? candidates[0] : null;
    }

    function hasSupportedSort(settings) {
        return Array.isArray(settings.SortBy)
            && settings.SortBy.length === 1
            && settings.SortBy[0] === 'SortName'
            && settings.SortOrder === 'Ascending';
    }

    function renderedResultCount(toolbar) {
        const labels = Array.from(toolbar.querySelectorAll('.MuiChip-label'))
            .map(node => node.textContent.trim())
            .filter(text => /^\d[\d,]*$/.test(text));
        if (labels.length !== 1) return null;
        return Number.parseInt(labels[0].replaceAll(',', ''), 10);
    }

    function renderedCardsMatchToolbarTotal(context) {
        const total = renderedResultCount(context.toolbar);
        return Number.isInteger(total) && context.cards.length === total;
    }

    function hasConfirmedNativeAlphabetSubset(context) {
        // A <=100 result is ambiguous by itself: it could be an ordinary
        // paged response with no pager. It is safe only when this exact query
        // was already observed as a large, fully rendered, alphabet-clear
        // result in this page session. queryIdentity deliberately omits
        // Alphabet but retains every other persisted filter/sort setting.
        return state.confirmedUnpaginatedQueryId === context.queryId
            && renderedCardsMatchToolbarTotal(context);
    }

    function hasCompleteUnpaginatedResult(context) {
        // A missing localStorage key was observed in the served v12.1 client
        // despite the page-size-zero UI setting being active. Do not guess from
        // the absence of pager buttons: a normal <=100-result query has none.
        // Instead require a large result whose toolbar total equals the number
        // of renderer-owned Movie cards currently in the DOM.
        const total = renderedResultCount(context.toolbar);
        return context.alphabetClear
            ? Number.isInteger(total) && total > 100 && context.cards.length === total
            : hasConfirmedNativeAlphabetSubset(context);
    }

    function hasPotentialUnpaginatedResult(context) {
        // While the query-specific toolbar bullet is present, its count chip is
        // intentionally replaced. Keep an already full rendered result eligible
        // only long enough for waitForReady() to observe the new settled count.
        return state.confirmedUnpaginatedQueryId === context.queryId
            || (context.loading
                ? context.cards.length > 100
                : hasCompleteUnpaginatedResult(context));
    }

    function hasInitialIndex(settings) {
        // Do not infer zero from a missing persisted field: StartIndex remains in
        // the item request even when Jellyfin omits limit for page size zero.
        return Number.isInteger(settings.StartIndex) && settings.StartIndex === 0;
    }

    function queryIdentity(route, settings, pageSize) {
        const querySettings = { ...settings };
        delete querySettings.Alphabet;
        return JSON.stringify(canonical({
            hash: route.hash,
            parentId: route.parentId,
            pageSize,
            settings: querySettings
        }));
    }

    function isAlphabetClear(settings, picker) {
        return settings.Alphabet == null && nativeAlphabet(picker) === null;
    }

    function hasLoadingMarker(toolbar) {
        const toolbarPending = Array.from(toolbar.querySelectorAll('.MuiChip-label'))
            .some(node => node.textContent.trim() === '∙');
        // The global document spinner is not query-specific and is not under the
        // Movies/toolbar observers. The v12.1 LibraryToolbar pending bullet is
        // query-specific, observed, and therefore the readiness prerequisite.
        return toolbarPending;
    }

    function getContext() {
        const route = routeInfo();
        const page = getPage();
        if (!route.isMovies || !page) return null;
        const settings = readViewSettings(route);
        const picker = findPicker(page);
        const toolbar = findLibraryToolbar();
        const pageSize = readLibraryPageSize();
        if (!settings || !picker || !toolbar || pageSize === null) return null;
        const cards = cardsIn(page);
        return {
            route,
            page,
            settings,
            picker,
            toolbar,
            pageSize,
            cards,
            empty: !!page.querySelector('.noItemsMessage.centerMessage'),
            loading: hasLoadingMarker(toolbar),
            alphabetClear: isAlphabetClear(settings, picker),
            queryId: queryIdentity(route, settings, pageSize)
        };
    }

    function isPotentiallySupported(context) {
        return !!context
            && (!CONFIG.moviesOnly || context.route.isMovies)
            && hasPotentialUnpaginatedResult(context)
            && hasInitialIndex(context.settings)
            && context.settings.ViewMode === 'grid'
            && (!CONFIG.respectSortOrder || hasSupportedSort(context.settings));
    }

    // Source-backed readiness: ItemsView renders Loading while itemsResult.isPending,
    // then renders either Cards from that query result or NoItemsMessage. Empty DOM is
    // deliberately not accepted as an empty result.
    function isReady(context) {
        return isPotentiallySupported(context)
            && context.alphabetClear
            && !context.loading
            && (context.cards.length > 0 || context.empty);
    }

    function firstMatch(cards, letter) {
        return cards.find(card => (card.dataset.prefix || '').startsWith(letter)) || null;
    }

    function removeSelectionMarkers(picker) {
        if (!picker) return;
        picker.buttons.forEach(button => {
            button.classList.remove('alpha-jump-selected');
            button.removeAttribute('data-alpha-jump-selected');
            button.removeAttribute('aria-current');
        });
    }

    function ensureStyles() {
        if (state.style?.isConnected) return;
        const style = doc.createElement('style');
        style.id = 'alpha-jump-prototype-style';
        style.textContent = [
            '.alphaPicker-fixed-right button[data-alpha-jump-selected="true"] {',
            '  outline: 2px solid currentColor;',
            '  outline-offset: -2px;',
            '  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .22);',
            '  font-weight: 700;',
            '}'
        ].join('\n');
        doc.head.appendChild(style);
        state.style = style;
    }

    function clearSelection() {
        removeSelectionMarkers(state.picker);
        state.selected = null;
        state.selectedQueryId = null;
    }

    function applySelection(context, value) {
        ensureStyles();
        state.selected = value;
        state.selectedQueryId = value === null ? null : context.queryId;
        context.picker.buttons.forEach(button => {
            const selected = button.value === value;
            button.classList.toggle('alpha-jump-selected', selected);
            if (selected) button.setAttribute('data-alpha-jump-selected', 'true');
            else button.removeAttribute('data-alpha-jump-selected');
            // This is enhancement-owned state. Native aria-pressed remains untouched.
            if (selected) button.setAttribute('aria-current', 'true');
            else button.removeAttribute('aria-current');
        });
    }

    function ensureFeedback(context) {
        if (state.feedback?.isConnected) return state.feedback;
        const feedback = doc.createElement('div');
        feedback.className = 'alpha-jump-feedback';
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'polite');
        feedback.style.cssText = 'position:fixed;right:3.5rem;bottom:1rem;z-index:1201;max-width:18rem;padding:.5rem .75rem;background:var(--theme-background,rgba(0,0,0,.85));color:inherit;border-radius:.25rem;font-size:.875rem;box-shadow:0 2px 8px rgba(0,0,0,.35);';
        context.picker.root.appendChild(feedback);
        state.feedback = feedback;
        return feedback;
    }

    function clearFeedback() {
        state.feedback?.remove();
        state.feedback = null;
    }

    function announce(context, message, cancelable) {
        const feedback = ensureFeedback(context);
        feedback.replaceChildren(doc.createTextNode(message));
        if (cancelable) {
            const cancel = doc.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            cancel.style.cssText = 'margin-left:.5rem;';
            cancel.addEventListener('click', () => cancelRun('Cancelled.', true));
            feedback.appendChild(cancel);
        }
    }

    function scrollTop() {
        root.scrollTo({
            top: 0,
            behavior: CONFIG.smoothScroll && !root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'
        });
    }

    function stickyOffset() {
        return Array.from(doc.querySelectorAll('[role="banner"], .MuiAppBar-root'))
            .filter(node => {
                const style = root.getComputedStyle(node);
                return (style.position === 'fixed' || style.position === 'sticky') && node.getBoundingClientRect().top <= 1;
            })
            .reduce((largest, node) => Math.max(largest, node.getBoundingClientRect().bottom), 0) + 12;
    }

    function scrollToCard(card) {
        const destination = Math.max(0, root.scrollY + card.getBoundingClientRect().top - stickyOffset());
        root.scrollTo({
            top: destination,
            behavior: CONFIG.smoothScroll && !root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'
        });
    }

    function beginRun(context, value) {
        cancelRun(null, false);
        const run = {
            id: ++state.sequence,
            value,
            queryId: context.queryId,
            routeHash: context.route.hash,
            cancelled: false,
            timeout: 0,
            observer: null,
            frame: 0,
            finishWait: null,
            awaitingNativeClear: false
        };
        run.timeout = root.setTimeout(() => {
            if (state.run === run) cancelRun('Timed out waiting for Jellyfin results.', true);
        }, CONFIG.maxElapsedMs);
        state.run = run;
        return run;
    }

    function isCurrent(run) {
        return !state.destroyed && state.run === run && !run.cancelled;
    }

    function finishRun(run) {
        if (state.run !== run) return;
        if (run.timeout) root.clearTimeout(run.timeout);
        if (run.frame) root.cancelAnimationFrame(run.frame);
        run.observer?.disconnect();
        run.timeout = 0;
        run.frame = 0;
        run.observer = null;
        run.finishWait = null;
        state.run = null;
    }

    function cancelRun(message, showFeedback) {
        const run = state.run;
        if (!run) {
            if (showFeedback) {
                const context = getContext();
                if (context) announce(context, message || 'Cancelled.', false);
            }
            return;
        }
        run.cancelled = true;
        run.finishWait?.({ cancelled: true });
        finishRun(run);
        if (showFeedback) {
            const context = getContext();
            if (context) announce(context, message || 'Cancelled.', false);
            else clearFeedback();
        } else {
            clearFeedback();
        }
        log('cancelled', message || 'superseded');
    }

    function relevantPageMutation(records) {
        return records.some(record => {
            const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            if (target?.closest('.alpha-jump-feedback')) return false;
            if (record.type === 'attributes') {
                return record.target.matches?.('.MuiChip-label, .alphaPicker-fixed-right button');
            }
            if (target?.matches?.('.MuiChip-label')) return true;
            return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(node => {
                if (node.nodeType !== 1) return false;
                return node.matches?.('.card[data-prefix], .noItemsMessage, .alphaPicker-fixed-right, .MuiChip-label')
                    || !!node.querySelector?.('.card[data-prefix], .noItemsMessage, .alphaPicker-fixed-right, .MuiChip-label');
            });
        });
    }

    function waitForReady(run) {
        return new Promise((resolve, reject) => {
            let settled = false;
            let timeout = 0;
            const finish = (result, failure) => {
                if (settled) return;
                settled = true;
                if (timeout) root.clearTimeout(timeout);
                if (run.frame) root.cancelAnimationFrame(run.frame);
                run.observer?.disconnect();
                run.frame = 0;
                run.observer = null;
                run.finishWait = null;
                failure ? reject(failure) : resolve(result);
            };
            const examine = () => {
                run.frame = 0;
                if (!isCurrent(run)) return finish(null, new Error('cancelled'));
                const context = getContext();
                if (!context || !isPotentiallySupported(context)) return finish(null, new Error('unsupported'));
                if (context.route.hash !== run.routeHash || context.queryId !== run.queryId) {
                    return finish(null, new Error('query changed'));
                }
                if (run.awaitingNativeClear) {
                    const total = renderedResultCount(context.toolbar);
                    if (!context.alphabetClear
                        || !hasCompleteUnpaginatedResult(context)
                        || total !== state.confirmedUnpaginatedTotal) return;
                }
                if (isReady(context)) return finish(context);
            };
            const schedule = () => {
                if (!isCurrent(run) || run.frame) return;
                run.frame = root.requestAnimationFrame(examine);
            };
            const initial = getContext();
            if (!initial || !isPotentiallySupported(initial)) {
                reject(new Error('unsupported'));
                return;
            }
            run.observer = new root.MutationObserver(records => {
                if (relevantPageMutation(records)) schedule();
            });
            const observeOptions = { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] };
            run.observer.observe(initial.page, observeOptions);
            run.observer.observe(initial.toolbar, observeOptions);
            run.finishWait = () => finish(null, new Error('cancelled'));
            timeout = root.setTimeout(() => finish(null, new Error('readiness timeout')), CONFIG.maxReadyWaitMs);
            schedule();
        });
    }

    async function clearNativeAlphabet(run, context) {
        if (context.alphabetClear) return context;
        const value = nativeAlphabet(context.picker);
        const button = value && context.picker.buttons.find(candidate => candidate.value === value);
        if (!button) throw new Error('native alphabet state is ambiguous');
        run.awaitingNativeClear = true;
        state.nativeBypassButton = button;
        button.click(); // Ordinary Jellyfin ToggleButton activation; the capture listener allows this one click.
        return waitForReady(run);
    }

    async function execute(context, value) {
        const run = beginRun(context, value);
        announce(context, value === '#' ? 'Returning to the beginning…' : `Finding ${value}…`, true);
        try {
            let readyContext = context;
            if (!readyContext.alphabetClear) readyContext = await clearNativeAlphabet(run, readyContext);
            else readyContext = await waitForReady(run);
            if (!isCurrent(run)) return;
            if (value === '#') {
                clearSelection();
                scrollTop();
                announce(readyContext, 'At the beginning.', false);
                finishRun(run);
                return;
            }
            const card = firstMatch(readyContext.cards, value);
            if (card) {
                applySelection(readyContext, value);
                scrollToCard(card);
                announce(readyContext, `First ${value} title.`, false);
            } else {
                clearSelection();
                announce(readyContext, `No matching ${value} titles.`, false);
            }
            finishRun(run);
        } catch (caught) {
            if (!isCurrent(run)) return;
            const current = getContext();
            finishRun(run);
            if (current && /query changed/.test(String(caught?.message))) {
                clearSelection();
                announce(current, 'Cancelled: library query changed.', false);
            } else if (current && /unsupported/.test(String(caught?.message))) {
                clearSelection();
                announce(current, 'Alpha Jump is unavailable for this view.', false);
            } else if (current && /timeout/.test(String(caught?.message))) {
                announce(current, 'Search incomplete: Jellyfin results did not settle.', false);
            } else {
                reportError('Could not prepare Movies results.', caught);
                if (current) announce(current, 'Alpha Jump could not prepare these results.', false);
            }
        }
    }

    function onPickerClick(event) {
        const button = event.target.closest?.('button[type="button"][value]');
        if (!button || !state.picker?.group.contains(button) || !LETTERS.has(button.value)) return;
        if (button === state.nativeBypassButton) {
            state.nativeBypassButton = null;
            return;
        }
        const context = getContext();
        // Potential support intentionally includes transient no-card loading states so
        // a superseding click cannot fall through to Jellyfin's native alphabet filter.
        if (!isPotentiallySupported(context)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const value = button.value;
        if ((value === '#' || (state.selected === value && state.selectedQueryId === context.queryId))
            && context.alphabetClear && !state.run) {
            clearSelection();
            scrollTop();
            announce(context, 'At the beginning.', false);
            return;
        }
        void execute(context, value);
    }

    function attachSurface(context) {
        if (state.picker?.root !== context.picker.root) {
            detachSurface(false);
            state.picker = context.picker;
            state.pickerClick = onPickerClick;
            context.picker.root.addEventListener('click', state.pickerClick, true);
        }
        if (state.page !== context.page) {
            if (state.page && state.pageClick) state.page.removeEventListener('click', state.pageClick);
            state.pageObserver?.disconnect();
            state.page = context.page;
            // Native toolbar/filter/sort/pager interactions can change persisted
            // settings without changing a card node (for example, a cached result
            // with the same cards). Re-read identity after React's click handling.
            state.pageClick = event => {
                if (!event.target.closest?.('.alphaPicker-fixed-right')) scheduleLifecycle();
            };
            state.page.addEventListener('click', state.pageClick);
            state.pageObserver = new root.MutationObserver(records => {
                if (relevantPageMutation(records)) scheduleLifecycle();
            });
            const observeOptions = { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] };
            state.pageObserver.observe(context.page, observeOptions);
            state.pageObserver.observe(context.toolbar, observeOptions);
        }
    }

    function detachSurface(removeFeedback) {
        if (state.picker?.root && state.pickerClick) {
            state.picker.root.removeEventListener('click', state.pickerClick, true);
        }
        removeSelectionMarkers(state.picker);
        state.picker = null;
        state.pickerClick = null;
        if (state.page && state.pageClick) state.page.removeEventListener('click', state.pageClick);
        state.pageClick = null;
        state.pageObserver?.disconnect();
        state.pageObserver = null;
        state.page = null;
        state.nativeBypassButton = null;
        if (removeFeedback) clearFeedback();
    }

    function refreshSurface() {
        if (state.destroyed) return;
        const context = getContext();
        if (context && context.alphabetClear && renderedCardsMatchToolbarTotal(context)
            && renderedResultCount(context.toolbar) > 100) {
            state.confirmedUnpaginatedQueryId = context.queryId;
            state.confirmedUnpaginatedTotal = renderedResultCount(context.toolbar);
        }
        if (state.run && (!context || context.route.hash !== state.run.routeHash || context.queryId !== state.run.queryId)) {
            cancelRun('Cancelled: library query changed.', true);
        }
        if (state.selected && (!context || state.selectedQueryId !== context.queryId)) clearSelection();
        if (!isPotentiallySupported(context)) {
            detachSurface(true);
            return;
        }
        attachSurface(context);
    }

    function scheduleLifecycle() {
        if (state.destroyed || state.lifecycleFrame) return;
        state.lifecycleFrame = root.requestAnimationFrame(() => {
            state.lifecycleFrame = 0;
            refreshSurface();
        });
    }

    function pageWasAddedOrRemoved(records) {
        return records.some(record => {
            // The page itself remains mounted when a user changes a view setting
            // such as page size. Its result subtree is replaced in place, so a
            // newly supported state must be reconsidered even when #moviesPage
            // was not added or removed.
            const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            if (target?.closest?.('#moviesPage')) return true;
            return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(node => {
                if (node.nodeType !== 1) return false;
                return node.id === 'moviesPage' || !!node.querySelector?.('#moviesPage');
            });
        });
    }

    function init() {
        if (!CONFIG.enabled || !doc || state.destroyed) return;
        if (root[INSTANCE_KEY]?.destroy) root[INSTANCE_KEY].destroy('re-injected');
        state.hashChange = () => {
            cancelRun('Cancelled: navigation changed.', false);
            scheduleLifecycle();
        };
        state.popState = state.hashChange;
        state.keyDown = event => {
            if (event.key === 'Escape' && state.run) {
                event.preventDefault();
                cancelRun('Cancelled.', true);
            }
        };
        root.addEventListener('hashchange', state.hashChange);
        root.addEventListener('popstate', state.popState);
        doc.addEventListener('keydown', state.keyDown, true);
        // This observer only finds insertion/removal of the active Movies page;
        // card discovery and result observation remain scoped to #moviesPage.
        state.mountObserver = new root.MutationObserver(records => {
            if (pageWasAddedOrRemoved(records)) scheduleLifecycle();
        });
        state.mountObserver.observe(doc.body, { childList: true, subtree: true });
        refreshSurface();
        root[INSTANCE_KEY] = api;
        log('initialized');
    }

    function destroy(reason = 'destroyed') {
        if (state.destroyed) return;
        state.destroyed = true;
        if (state.lifecycleFrame) root.cancelAnimationFrame(state.lifecycleFrame);
        cancelRun(null, false);
        detachSurface(true);
        state.mountObserver?.disconnect();
        state.mountObserver = null;
        root.removeEventListener('hashchange', state.hashChange);
        root.removeEventListener('popstate', state.popState);
        doc.removeEventListener('keydown', state.keyDown, true);
        state.style?.remove();
        state.style = null;
        if (root[INSTANCE_KEY] === api) delete root[INSTANCE_KEY];
        log(reason);
    }

    const api = { config: CONFIG, destroy, refresh: scheduleLifecycle };
    // Node's focused regression tests receive only deterministic helpers. The
    // injected browser instance does not expose these test hooks.
    const test = {
        canonical,
        renderedResultCount,
        hasCompleteUnpaginatedResult,
        hasPotentialUnpaginatedResult,
        hasInitialIndex,
        hasSupportedSort,
        isPotentialSnapshot: snapshot => snapshot.completeUnpaginatedResult === true
            && hasInitialIndex(snapshot.settings)
            && snapshot.settings.ViewMode === 'grid'
            && hasSupportedSort(snapshot.settings),
        queryIdentity,
        removeSelectionMarkers,
        getContext,
        attachSurface,
        detachSurface,
        refreshSurface,
        execute,
        waitForReady,
        getState: () => state
    };
    return { init, api, test };
}));
