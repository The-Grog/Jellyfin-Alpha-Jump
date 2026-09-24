/*
 * Jellyfin Alpha Jump for Jellyfin Web 12.1 source-backed library grids.
 *
 * This is deliberately a browser-only DOM enhancement. By default it sets the
 * signed-in user's browser-local Library page-size preference to 0 once, then
 * reloads once so Jellyfin can apply it. It never requests items itself.
 * Configuration is separate from arming: only rendered card/toolbar evidence
 * proves that the current result is complete enough to jump within.
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
        // Alpha Jump is designed around Jellyfin's documented zero-page-size
        // mode. This preference is local to the signed-in user and this origin.
        autoDisablePagination: true,
        moviesOnly: false,
        showsEnabled: true,
        smoothScroll: true,
        debug: false,
        // Prefix is the default compatibility-friendly shortcut. Wire values
        // are exact lower-case strings; invalid values still fail closed.
        keyboardJumpMode: 'prefix',
        keyboardPrefixTimeoutMs: 2000,
        respectSortOrder: true,
        // Bounds a native alphabet-clear replacement and initial readiness wait.
        maxReadyWaitMs: 8000,
        // Bounds a complete request, including the optional native clear.
        maxElapsedMs: 15000,
        // Plugin injection can run before Jellyfin publishes ApiClient. Retry
        // that public readiness boundary briefly without polling indefinitely.
        maxPluginApiRetries: 8,
        pluginApiRetryDelayMs: 250,
        updateCheckThrottleMs: 10000,
        updateRequestTimeoutMs: 5000,
        updateRetryDelaysMs: [1000, 3000, 8000],
        // Server shutdown can leave the old runtime answering briefly. Keep a
        // deliberately short, bounded handoff window after its restart events.
        updateRestartWindowMs: 30000
    };
    const INSTANCE_KEY = '__alphaJumpPrototypeV1';
    const LETTERS = new Set(['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']);
    const LOG_PREFIX = '[AlphaJump]';
    const MANUAL_REFRESH_MESSAGE = 'Alpha Jump updated—refresh to apply.';
    // This registry is deliberately narrower than Jellyfin's route list. Each
    // entry is an ItemsView grid with a v12.1 route, tab, local-storage key,
    // and explicit rendered item contract. Suggestions, genres, people,
    // songs, playlists embedded in a media library, Live TV, and detail pages
    // are intentionally absent and retain Jellyfin's native behavior.
    const VIEW_REGISTRY = [
        { path: '#/movies', collectionTypes: ['movies'], pageId: 'moviesPage', defaultTab: 0, views: [
            { tab: 0, settingsKey: 'movies', itemTypes: ['Movie'] },
            { tab: 2, settingsKey: 'favorites', itemTypes: ['Movie'] },
            { tab: 3, settingsKey: 'collections', itemTypes: ['BoxSet'] }
        ] },
        { path: '#/tv', collectionTypes: ['tvshows'], pageId: 'tvshowsPage', defaultTab: 0, views: [
            { tab: 0, settingsKey: 'series', itemTypes: ['Series'] },
            { tab: 6, settingsKey: 'collections', itemTypes: ['BoxSet'] }
        ] },
        { path: '#/books', collectionTypes: ['books'], pageId: 'booksPage', defaultTab: 0, views: [
            { tab: 0, settingsKey: 'folders', itemTypes: ['Folder', 'AudioBook', 'Book'] },
            { tab: 1, settingsKey: 'books', itemTypes: ['AudioBook', 'Book'] },
            { tab: 5, settingsKey: 'collections', itemTypes: ['BoxSet'] },
            { tab: 6, settingsKey: 'favorites', itemTypes: ['AudioBook', 'Book'] }
        ] },
        // /boxsets is a server-provided Collections view, not a media folder.
        // Its opt-in is therefore scoped separately in plugin mode.
        { path: '#/boxsets', collectionTypes: ['boxsets'], pageId: 'boxsetsPage', defaultTab: 0, scope: 'collections', views: [
            { tab: 0, settingsKey: 'collections', itemTypes: ['BoxSet'] },
            { tab: 1, settingsKey: 'favorites', itemTypes: ['BoxSet'] }
        ] },
        { path: '#/homevideos', collectionTypes: ['homevideos'], pageId: 'homevideos', defaultTab: 0, views: [
            { tab: 0, settingsKey: 'folders', itemTypes: ['Folder', 'Photo', 'PhotoAlbum', 'Video'] },
            { tab: 1, settingsKey: 'photos', itemTypes: ['Photo'] },
            { tab: 2, settingsKey: 'photoalbums', itemTypes: ['PhotoAlbum'] },
            { tab: 3, settingsKey: 'videos', itemTypes: ['Video'] }
        ] },
        { path: '#/mixed', collectionTypes: ['mixed'], pageId: 'mixed', defaultTab: 0, views: [
            { tab: 0, settingsKey: 'folders', itemTypes: ['Folder', 'Movie', 'Series'] },
            { tab: 2, settingsKey: 'mixed', itemTypes: ['Movie', 'Series'] },
            { tab: 3, settingsKey: 'collections', itemTypes: ['BoxSet'] }
        ] },
        { path: '#/music', collectionTypes: ['music'], pageId: 'musicPage', defaultTab: 0, views: [
            { tab: 0, settingsKey: 'albums', itemTypes: ['MusicAlbum'] },
            { tab: 7, settingsKey: 'collections', itemTypes: ['BoxSet'] }
        ] },
        { path: '#/musicvideos', collectionTypes: ['musicvideos'], pageId: 'musicvideos', defaultTab: 0, views: [
            { tab: 0, settingsKey: 'folders', itemTypes: ['Folder', 'MusicVideo'] },
            { tab: 2, settingsKey: 'musicvideos', itemTypes: ['MusicVideo'] }
        ] },
        { path: '#/playlists', collectionTypes: ['playlists'], pageId: 'playlistsPage', defaultTab: 0, views: [
            { tab: 0, settingsKey: 'playlists', itemTypes: ['Playlist'] },
            { tab: 1, settingsKey: 'favorites', itemTypes: ['Playlist'] }
        ] }
    ];
    const SUPPORTED_PAGE_SELECTOR = VIEW_REGISTRY.map(view => '#' + view.pageId).join(', ');
    const state = {
        destroyed: false,
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
        hashChange: null,
        popState: null,
        keyDown: null,
        keyboard: { prefix: null, focusIn: null, blur: null, visibility: null },
        confirmedUnpaginatedQueryId: null,
        confirmedUnpaginatedTotal: null,
        activeUserId: null,
        preferenceHandledUsers: new Set(),
        reportedPreferenceProblems: new Set(),
        loadListener: null,
        firstPickerClick: null,
        // A server plugin adds a small, unique bootstrap marker before loading
        // this same file. Its configuration is deliberately loaded per library:
        // a failed or malformed plugin response never falls back to the
        // standalone defaults.
        plugin: {
            marker: null,
            routeKey: null,
            configuration: null,
            pending: null,
            failedRoutes: new Set(),
            readinessRetry: null,
            readinessFailureReported: new Set(),
            update: { initial: null, pending: null, request: null, retry: null, retries: 0, lastCheck: 0, restartUntil: 0, generation: 0, client: null, notice: null, unsubscribe: null, focus: null, visibility: null }
        }
    };

    function log(...args) {
        if (CONFIG.debug) console.debug(LOG_PREFIX, ...args);
    }

    function reportError(...args) {
        console.error(LOG_PREFIX, ...args);
    }

    function pluginMarker() {
        const markers = Array.from(doc?.querySelectorAll?.('#alpha-jump-plugin-bootstrap') || [])
            .filter(marker => marker.getAttribute?.('data-alpha-jump-mode') === 'plugin');
        if (markers.length !== 1) return null;

        const marker = markers[0];
        const configUrl = marker.getAttribute('data-alpha-jump-config-url');
        if (typeof configUrl !== 'string' || !configUrl) return null;

        const runtimeUrl = marker.getAttribute('data-alpha-jump-runtime-url');
        const runtimeId = marker.getAttribute('data-alpha-jump-runtime-id');
        const fingerprint = marker.getAttribute('data-alpha-jump-script-fingerprint');
        const runtime = typeof runtimeUrl === 'string' && runtimeUrl && runtimeId && fingerprint
            ? { url: runtimeUrl, runtimeId, fingerprint }
            : null;

        return { element: marker, configUrl, runtime };
    }

    function validRuntime(value) {
        if (!value || typeof value !== 'object') return null;

        const runtimeId = pluginValue(value, 'runtimeId');
        const fingerprint = pluginValue(value, 'scriptFingerprint');
        const version = pluginValue(value, 'pluginVersion');

        if (typeof runtimeId !== 'string'
            || !/^[a-f0-9]{16,}$/i.test(fingerprint)
            || typeof version !== 'string') return null;

        return { runtimeId, fingerprint, version };
    }

    function updateNotice(message) {
        const update = state.plugin.update;
        if (state.destroyed) return;
        if (!update.notice?.isConnected) {
            const notice = doc.createElement('div');
            notice.className = 'alpha-jump-update-notice';
            notice.setAttribute('role', 'status');
            notice.setAttribute('aria-live', 'polite');
            notice.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:1201;padding:.5rem .75rem;background:var(--theme-background,rgba(0,0,0,.85));color:inherit;border-radius:.25rem;';
            doc.body?.appendChild(notice);
            update.notice = notice;
        }
        update.notice.replaceChildren(doc.createTextNode(message));
        const button = doc.createElement('button');
        button.type = 'button';
        button.textContent = 'Refresh';
        button.style.cssText = 'margin-left:.5rem;';
        button.addEventListener('click', () => root.location.reload());
        update.notice.appendChild(button);
    }

    function showManualRefreshNotice() {
        updateNotice(MANUAL_REFRESH_MESSAGE);
    }

    function updateSafeToReload() {
        if (doc.visibilityState && doc.visibilityState !== 'visible') return false;
        const context = getContext();
        // v12.1 exports playbackManager as an ES module, not a documented window API.
        // Only reload automatically when a host explicitly exposes its verified shape.
        const playback = root.playbackManager;
        if (!playback || typeof playback.isPlayingLocally !== 'function') return false;
        try { return !!context && isPotentiallySupported(context) && !playback.isPlayingLocally(['Video', 'Audio', 'Book']); }
        catch { return false; }
    }

    function updateReloadKey(fingerprint) { return originKey() ? `alpha-jump:v1:update-reload:${originKey()}:${fingerprint}` : null; }

    function applyPendingUpdate() {
        const update = state.plugin.update;
        if (state.destroyed || !update.pending) return;
        if (!updateSafeToReload()) {
            showManualRefreshNotice();
            return;
        }
        const key = updateReloadKey(update.pending.fingerprint);
        try {
            if (!key || root.sessionStorage?.getItem(key) === '1') {
                showManualRefreshNotice();
                return;
            }
            root.sessionStorage?.setItem(key, '1');
            root.location.reload();
        } catch {
            showManualRefreshNotice();
        }
    }

    function restartRecoveryActive() {
        return Date.now() < state.plugin.update.restartUntil;
    }

    function scheduleRestartRecovery() {
        const update = state.plugin.update;
        if (state.destroyed || update.retry || !restartRecoveryActive()) return;
        // The final delay repeats only until the finite restart window ends.
        const delay = CONFIG.updateRetryDelaysMs[Math.min(update.retries++, CONFIG.updateRetryDelaysMs.length - 1)];
        const remaining = update.restartUntil - Date.now();
        if (remaining <= 0) return;
        update.retry = root.setTimeout(() => { update.retry = null; checkForPluginUpdate(true); }, Math.min(delay, remaining));
    }

    function beginRestartRecovery() {
        const update = state.plugin.update;
        if (state.destroyed || !update.initial) return;
        update.restartUntil = Math.max(update.restartUntil, Date.now() + CONFIG.updateRestartWindowMs);
        update.retries = 0;
        scheduleRestartRecovery();
    }

    function updateRequestIsCurrent(request) {
        const update = state.plugin.update;
        return !state.destroyed && update.request === request && update.generation === request.generation && !request.cancelled;
    }

    function cancelUpdateRequest(request) {
        if (!request) return;
        request.cancelled = true;
        if (request.timeout) root.clearTimeout(request.timeout);
        // Jellyfin's ajax implementation can expose an abortable jqXHR. Do not
        // assume every promise is abortable; an unabortable request stays marked
        // outstanding until it settles so a timeout cannot create overlap.
        if (typeof request.transport?.abort === 'function') {
            let aborted = false;
            try { request.transport.abort(); aborted = true; } catch { /* cancellation is best effort */ }
            if (aborted && state.plugin.update.request === request) state.plugin.update.request = null;
        }
    }

    function checkForPluginUpdate(force = false) {
        const update = state.plugin.update;
        if (!pluginMode() || !update.initial || update.request || (!force && Date.now() - update.lastCheck < CONFIG.updateCheckThrottleMs)) return;
        const client = root.ApiClient;
        ensureUpdateSubscription();
        if (!pluginClientIsReady(client)) { scheduleRestartRecovery(); return; }
        update.lastCheck = Date.now();
        const request = { generation: update.generation, transport: null, timeout: null, cancelled: false, timedOut: false };
        update.request = request;
        try {
            request.transport = client.ajax({ type: 'GET', url: update.initial.url, dataType: 'json', timeout: CONFIG.updateRequestTimeoutMs });
        } catch {
            if (updateRequestIsCurrent(request)) {
                update.request = null;
                scheduleRestartRecovery();
            }
            return;
        }
        request.timeout = root.setTimeout(() => {
            if (!updateRequestIsCurrent(request)) return;
            request.timedOut = true;
            if (typeof request.transport?.abort === 'function') {
                cancelUpdateRequest(request);
                scheduleRestartRecovery();
            }
            // Unabortable requests intentionally remain outstanding. Their late
            // completion is ignored after destroy and cannot race a second fetch.
        }, CONFIG.updateRequestTimeoutMs);
        Promise.resolve(request.transport).then(payload => {
            if (!updateRequestIsCurrent(request)) return;
            const runtime = validRuntime(payload);
            if (!runtime) throw new Error('invalid runtime response');
            update.retries = 0;
            const runtimeChanged = runtime.runtimeId !== update.initial.runtimeId;
            if (runtimeChanged) update.restartUntil = 0;
            if (runtime.fingerprint !== update.initial.fingerprint) { update.pending = runtime; applyPendingUpdate(); }
            // A responsive old server is expected during shutdown. Do not treat
            // it as completion of a restart handoff.
            if (!runtimeChanged && restartRecoveryActive()) scheduleRestartRecovery();
        }).catch(() => {
            if (updateRequestIsCurrent(request)) scheduleRestartRecovery();
        }).finally(() => {
            if (request.timeout) root.clearTimeout(request.timeout);
            if (update.request === request) update.request = null;
        });
    }

    function clearUpdateSubscription() {
        const update = state.plugin.update;
        try { update.unsubscribe?.(); } catch { /* a replaced client must not break native behavior */ }
        update.unsubscribe = null;
        update.client = null;
    }

    function ensureUpdateSubscription() {
        const update = state.plugin.update;
        if (state.destroyed || !update.initial) return;
        const client = root.ApiClient;
        if (client !== update.client) clearUpdateSubscription();
        if (!pluginClientIsReady(client) || typeof client.subscribe !== 'function') return;
        if (update.unsubscribe && update.client === client) return;
        try {
            update.unsubscribe = client.subscribe(['ServerRestarting', 'ServerShuttingDown'], beginRestartRecovery);
            update.client = client;
        } catch { clearUpdateSubscription(); /* focus/visibility recovery remains available */ }
    }

    function startUpdateRecovery() {
        const marker = state.plugin.marker;
        if (!marker?.runtime) return;
        const update = state.plugin.update;
        update.initial = marker.runtime;
        update.focus = () => { ensureUpdateSubscription(); checkForPluginUpdate(false); applyPendingUpdate(); };
        update.visibility = () => { if (doc.visibilityState === 'visible') update.focus(); };
        root.addEventListener('focus', update.focus);
        doc.addEventListener('visibilitychange', update.visibility);
        ensureUpdateSubscription();
    }

    function stopUpdateRecovery() {
        const update = state.plugin.update;
        update.generation += 1;
        if (update.retry) root.clearTimeout(update.retry);
        cancelUpdateRequest(update.request);
        clearUpdateSubscription(); root.removeEventListener('focus', update.focus); doc.removeEventListener('visibilitychange', update.visibility);
        update.notice?.remove(); update.retry = update.request = update.notice = update.focus = update.visibility = null;
        update.restartUntil = 0;
    }

    function pluginValue(payload, name) {
        return payload?.[name] ?? payload?.[name[0].toUpperCase() + name.slice(1)];
    }

    // Jellyfin Web routes use an unhyphenated GUID while server-side Guid
    // formatting may include hyphens. Compare the identifier, not its spelling.
    function normalizeLibraryId(value) {
        const compact = typeof value === 'string' ? value.replaceAll('-', '').toLowerCase() : '';
        return /^[0-9a-f]{32}$/.test(compact) ? compact : null;
    }

    function validatePluginConfiguration(payload, route) {
        const scope = pluginValue(payload, 'scope');
        if (!payload || typeof payload !== 'object'
            || pluginValue(payload, 'contractVersion') !== 3
            || scope !== route.configScope) {
            return null;
        }
        const libraryId = normalizeLibraryId(pluginValue(payload, 'libraryId'));
        const routeLibraryId = normalizeLibraryId(route.parentId);
        if (scope === 'library'
            && (libraryId === null || libraryId !== routeLibraryId)) return null;
        if (scope === 'collections' && pluginValue(payload, 'libraryId') != null) return null;
        const fields = ['enabled', 'libraryEnabled', 'autoDisablePagination', 'smoothScroll', 'debug'];
        if (fields.some(field => typeof pluginValue(payload, field) !== 'boolean')) return null;
        const keyboardJumpMode = pluginValue(payload, 'keyboardJumpMode');
        if (!['off', 'prefix', 'plain'].includes(keyboardJumpMode)) return null;
        return { ...Object.fromEntries(fields.map(field => [field, pluginValue(payload, field)])), keyboardJumpMode };
    }

    function pluginMode() {
        return state.plugin.marker !== null;
    }

    function pluginAllowsRoute(route) {
        if (!pluginMode()) return true;
        return state.plugin.routeKey === route.configKey
            && state.plugin.configuration !== null
            && state.plugin.configuration.enabled
            && state.plugin.configuration.libraryEnabled;
    }

    function configureFromPlugin(configuration) {
        // The contract intentionally carries only Alpha Jump's own booleans.
        // Do not merge arbitrary server configuration into the standalone API.
        CONFIG.enabled = configuration.enabled;
        CONFIG.autoDisablePagination = configuration.autoDisablePagination;
        CONFIG.smoothScroll = configuration.smoothScroll;
        CONFIG.debug = configuration.debug;
        CONFIG.keyboardJumpMode = configuration.keyboardJumpMode;
    }

    function clearPluginReadinessRetry(routeKey = null) {
        const retry = state.plugin.readinessRetry;
        if (!retry || (routeKey && retry.routeKey !== routeKey)) return;
        if (retry.timer) root.clearTimeout(retry.timer);
        state.plugin.readinessRetry = null;
    }

    function pluginClientIsReady(client) {
        if (!client || typeof client.ajax !== 'function') return false;
        try {
            return typeof client.isLoggedIn !== 'function' || client.isLoggedIn();
        } catch {
            return false;
        }
    }

    function schedulePluginReadinessRetry(route) {
        const routeKey = route.configKey;
        if (!routeKey) return;
        const previous = state.plugin.readinessRetry;
        if (previous?.routeKey === routeKey && previous.timer) return;
        if (previous && previous.routeKey !== routeKey) clearPluginReadinessRetry();
        const attempts = previous?.routeKey === routeKey ? previous.attempts + 1 : 1;
        if (attempts > CONFIG.maxPluginApiRetries) {
            if (!state.plugin.readinessFailureReported.has(routeKey)) {
                state.plugin.readinessFailureReported.add(routeKey);
                reportError('Alpha Jump plugin configuration did not become available during startup. Native behavior remains available.');
            }
            state.plugin.readinessRetry = { routeKey, attempts, timer: null };
            return;
        }

        const retry = { routeKey, attempts, timer: null };
        retry.timer = root.setTimeout(() => {
            retry.timer = null;
            if (state.destroyed || state.plugin.readinessRetry !== retry) return;
            const currentRoute = routeInfo();
            if (currentRoute.configKey !== routeKey) return;
            void loadPluginConfiguration(currentRoute)
                .then(loaded => { if (loaded) scheduleLifecycle(); })
                .catch(() => scheduleLifecycle());
        }, CONFIG.pluginApiRetryDelayMs);
        state.plugin.readinessRetry = retry;
        log('waiting for Jellyfin plugin API readiness', attempts);
    }

    function loadPluginConfiguration(route) {
        if (!pluginMode() || !route.kind || !route.configKey) return Promise.resolve();
        const routeKey = route.configKey;
        if (state.plugin.routeKey === routeKey && state.plugin.configuration) return Promise.resolve();
        if (state.plugin.pending?.routeKey === routeKey) return state.plugin.pending.promise;
        if (state.plugin.failedRoutes.has(routeKey)) return Promise.reject(new Error('plugin configuration previously failed'));

        const client = root.ApiClient;
        if (!pluginClientIsReady(client)) {
            schedulePluginReadinessRetry(route);
            return Promise.resolve(false);
        }
        clearPluginReadinessRetry(routeKey);

        const parameter = route.configScope === 'collections'
            ? 'scope=collections'
            : `libraryId=${encodeURIComponent(route.parentId)}`;
        const url = `${state.plugin.marker.configUrl}${state.plugin.marker.configUrl.includes('?') ? '&' : '?'}${parameter}`;
        const pending = {
            routeKey,
            promise: client.ajax({ type: 'GET', url, dataType: 'json' })
                .then(payload => {
                    const configuration = validatePluginConfiguration(payload, route);
                    if (!configuration) throw new Error('plugin configuration response did not match contract v3');
                    // A route can change while an authenticated request is in flight.
                    // Store only the response for the route that requested it.
                    state.plugin.routeKey = routeKey;
                    state.plugin.configuration = configuration;
                    configureFromPlugin(configuration);
                    return true;
                })
                .catch(caught => {
                    state.plugin.failedRoutes.add(routeKey);
                    state.plugin.routeKey = routeKey;
                    state.plugin.configuration = null;
                    reportError('Alpha Jump plugin configuration could not be loaded. Native behavior remains available.', caught);
                    throw caught;
                })
                .finally(() => {
                    if (state.plugin.pending === pending) state.plugin.pending = null;
                })
        };
        state.plugin.pending = pending;
        return pending.promise;
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
        const requestedCollectionType = (params.get('collectionType') || '').trim().toLowerCase();
        // Web maps an empty/unknown collection type to /mixed. This is the only
        // unknown-type normalization accepted here; arbitrary types stay native.
        const collectionType = !requestedCollectionType || requestedCollectionType === 'unknown'
            ? 'mixed'
            : requestedCollectionType;
        const definition = VIEW_REGISTRY.find(candidate => candidate.path === path
            && candidate.collectionTypes.includes(collectionType)) || null;
        const tabParameter = params.get('tab');
        let view = null;
        if (definition && parentId) {
            if (tabParameter !== null) {
                const tab = Number.parseInt(tabParameter, 10);
                view = String(tab) === tabParameter ? definition.views.find(candidate => candidate.tab === tab) || null : null;
            } else {
                const userId = currentUserId();
                try {
                    const landing = userId ? root.localStorage.getItem(userId + '-landing-' + parentId) : null;
                    view = landing === null || landing === ''
                        ? definition.views.find(candidate => candidate.tab === definition.defaultTab) || null
                        : definition.views.find(candidate => candidate.settingsKey === landing) || null;
                } catch {
                    view = null;
                }
            }
        }
        // Retain the standalone prototype's documented opt-outs. Plugin mode
        // does not supply these legacy knobs, but a local injector user may
        // deliberately choose Movies-only or disable Shows. Movies-only keeps
        // the original Movies main grid rather than silently expanding to
        // collections or another library type.
        const legacyAllowed = !CONFIG.moviesOnly
            || (definition?.path === '#/movies' && view?.tab === 0);
        const showsAllowed = definition?.path !== '#/tv' || CONFIG.showsEnabled;
        const configScope = definition?.scope || 'library';
        const normalizedLibraryId = normalizeLibraryId(parentId);
        const configKey = configScope === 'collections'
            ? 'collections'
            : normalizedLibraryId ? `library:${normalizedLibraryId}` : null;
        return {
            hash, parentId, collectionType, kind: view?.settingsKey || null,
            definition, view, configScope, configKey,
            supported: !!definition && !!view && !!parentId && legacyAllowed && showsAllowed,
            pageId: definition?.pageId || null,
            itemTypes: view?.itemTypes || []
        };
    }

    // v12.1 stores every ItemsView setting under "LibraryTab - topParentId".
    function readViewSettings(route) {
        if (!route.parentId || !route.kind) return null;
        try {
            const raw = root.localStorage.getItem(`${route.kind} - ${route.parentId}`);
            // LibraryProvider uses getDefaultLibraryViewSettings before the first
            // native edit persists this key. Every registry view is source-backed
            // as grid + SortName ascending by default (Songs is excluded).
            if (raw === null) {
                return {
                    ShowTitle: true,
                    ShowYear: true,
                    ViewMode: 'grid',
                    ImageType: 'Primary',
                    CardLayout: false,
                    SortBy: ['SortName'],
                    SortOrder: 'Ascending',
                    StartIndex: 0
                };
            }
            return raw ? JSON.parse(raw) : null;
        } catch (caught) {
            reportError('Could not read library view settings.', caught);
            return null;
        }
    }

    function originKey() {
        return typeof root.location?.origin === 'string' && root.location.origin
            ? root.location.origin
            : null;
    }

    // v12.1 ServerConnections.setLocalApiClient assigns the signed-in client to
    // window.ApiClient. Dashboard's public getCurrentUserId() delegates to this
    // same method. Do not infer a user from localStorage names or library IDs.
    function currentUserId() {
        const client = root.ApiClient;
        if (!client || typeof client.getCurrentUserId !== 'function') return null;
        try {
            if (typeof client.isLoggedIn === 'function' && !client.isLoggedIn()) return null;
            const userId = client.getCurrentUserId();
            return typeof userId === 'string' && userId.trim() ? userId : null;
        } catch (caught) {
            reportPreferenceProblem('identity', 'Alpha Jump could not identify the signed-in Jellyfin user.', caught);
            return null;
        }
    }

    function preferenceKey(userId) {
        return `${userId}-libraryPageSize`;
    }

    function scopedKey(name, userId) {
        const origin = originKey();
        return origin ? `alpha-jump:v1:${name}:${origin}:${encodeURIComponent(userId)}` : null;
    }

    function backupKey(userId) {
        return scopedKey('library-page-size-backup', userId);
    }

    function handledKey(userId) {
        return scopedKey('library-page-size-handled', userId);
    }

    function reportPreferenceProblem(code, message, caught) {
        if (state.reportedPreferenceProblems.has(code)) return;
        state.reportedPreferenceProblems.add(code);
        // This is an actual configuration failure, so it remains visible with
        // debug disabled. Do not include user IDs, tokens, or storage values.
        reportError(message, caught || '');
    }

    function readJson(storage, key) {
        if (!storage || !key) return null;
        const raw = storage.getItem(key);
        return raw == null ? null : JSON.parse(raw);
    }

    function writeJson(storage, key, value) {
        if (!storage || !key) throw new Error('storage is unavailable');
        storage.setItem(key, JSON.stringify(value));
    }

    function readBackup(userId) {
        const key = backupKey(userId);
        const backup = readJson(root.localStorage, key);
        if (backup == null) return null;
        if (backup.version !== 1 || backup.origin !== originKey() || backup.userId !== userId
            || typeof backup.existed !== 'boolean'
            || (backup.existed && typeof backup.value !== 'string')) {
            throw new Error('backup record is malformed or belongs to another user');
        }
        return backup;
    }

    function preserveBackup(userId, value) {
        const existing = readBackup(userId);
        if (existing) return existing;
        const backup = {
            version: 1,
            origin: originKey(),
            userId,
            existed: value !== null,
            value: value === null ? null : value
        };
        writeJson(root.localStorage, backupKey(userId), backup);
        return backup;
    }

    function sessionValue(userId, keyForUser) {
        try {
            return root.sessionStorage?.getItem(keyForUser(userId)) || null;
        } catch (caught) {
            reportPreferenceProblem('session-storage', 'Alpha Jump could not track its one-time page-size setup attempt.', caught);
            return null;
        }
    }

    function setSessionValue(userId, keyForUser, value) {
        root.sessionStorage?.setItem(keyForUser(userId), value);
    }

    function resetForUserChange(userId) {
        if (state.activeUserId === userId) return;
        cancelRun('Cancelled: signed-in user changed.', false);
        detachSurface(true);
        state.confirmedUnpaginatedQueryId = null;
        state.confirmedUnpaginatedTotal = null;
        state.activeUserId = userId;
    }

    // This writes only Jellyfin's verified client-local key. Jellyfin's normal
    // display-settings UI calls userSettings.libraryPageSize(), which delegates
    // to appSettings.set('libraryPageSize', value, currentUserId) and produces
    // exactly this key. A reload is needed because the existing ItemsView query
    // was already created with the prior page-size preference.
    function configurePaginationPreference() {
        const userId = currentUserId();
        if (!userId) {
            if (routeInfo().supported) {
                reportPreferenceProblem('identity-unavailable', 'Alpha Jump is waiting for Jellyfin authentication and will leave native behavior available until the signed-in user is known.');
            }
            return null;
        }
        resetForUserChange(userId);
        if (!CONFIG.autoDisablePagination || state.preferenceHandledUsers.has(userId)) return userId;

        const origin = originKey();
        if (!origin || !root.localStorage || !root.sessionStorage) {
            reportPreferenceProblem('storage-unavailable', 'Alpha Jump could not access browser storage for the signed-in user. Native behavior remains available.');
            return userId;
        }

        try {
            const status = sessionValue(userId, handledKey);
            const raw = root.localStorage.getItem(preferenceKey(userId));
            if (raw === '0') {
                state.preferenceHandledUsers.add(userId);
                if (!status) setSessionValue(userId, handledKey, 'already-zero');
                return userId;
            }
            // A page-size change after Alpha Jump has run is a user decision for
            // this session. Re-injection and SPA lifecycle work must not fight it.
            if (status) {
                state.preferenceHandledUsers.add(userId);
                if (status === 'reload-attempted') {
                    reportPreferenceProblem('reload-failed', 'Alpha Jump set Library page size to zero but it was not available after its one reload. Native behavior remains available; change the setting in Jellyfin Display settings and reload manually.');
                }
                return userId;
            }
            preserveBackup(userId, raw);
            root.localStorage.setItem(preferenceKey(userId), '0');
            if (root.localStorage.getItem(preferenceKey(userId)) !== '0') {
                throw new Error('write verification failed');
            }
            state.preferenceHandledUsers.add(userId);
            setSessionValue(userId, handledKey, 'reload-attempted');
            if (typeof root.location?.reload !== 'function') throw new Error('reload is unavailable');
            root.location.reload();
        } catch (caught) {
            state.preferenceHandledUsers.add(userId);
            reportPreferenceProblem('configuration', 'Alpha Jump could not set the signed-in user\'s Library page size to zero. Native behavior remains available.', caught);
        }
        return userId;
    }

    function restorePaginationPreference() {
        const userId = currentUserId();
        if (!userId) {
            reportPreferenceProblem('restore-identity', 'Alpha Jump could not identify the signed-in Jellyfin user for restoration.');
            return false;
        }
        try {
            const backup = readBackup(userId);
            if (!backup) throw new Error('no Alpha Jump backup exists for this user and origin');
            const key = preferenceKey(userId);
            if (backup.existed) root.localStorage.setItem(key, backup.value);
            else root.localStorage.removeItem(key);
            setSessionValue(userId, handledKey, 'restored');
            state.preferenceHandledUsers.add(userId);
            return true;
        } catch (caught) {
            reportPreferenceProblem('restore', 'Alpha Jump could not restore this signed-in user\'s original Library page-size preference.', caught);
            return false;
        }
    }

    function getPage(route) {
        const pages = Array.from(doc.querySelectorAll('#' + route.pageId));
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

    function cardsIn(page, route) {
        // ItemsView renders Cards inside this source-backed container. Count every
        // card there exactly once, then fail closed if any result has a missing
        // prefix or an unexpected type; never silently count a preferred subtype.
        return Array.from(page.querySelectorAll('.itemsContainer .card'));
    }

    function cardsMatchRouteContract(cards, route) {
        return cards.every(card => typeof card.dataset?.prefix === 'string'
            && card.dataset.prefix.length > 0
            && route.itemTypes.includes(card.dataset.type));
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
        return context.cardsMatchRouteContract
            && Number.isInteger(total)
            && context.cards.length === total;
    }

    function hasConfirmedNativeAlphabetSubset(context) {
        // An already active native alphabet is safe only when this exact query
        // was already observed as a fully rendered, alphabet-clear result in
        // this page session. queryIdentity deliberately omits
        // Alphabet but retains every other persisted filter/sort setting.
        return state.confirmedUnpaginatedQueryId === context.queryId
            && renderedCardsMatchToolbarTotal(context);
    }

    function hasCompleteUnpaginatedResult(context) {
        // Page-size configuration is not evidence that the existing view was
        // re-queried. A toolbar total exactly matching renderer-owned Movie
        // cards proves this result is complete, including small libraries and
        // filtered results of 100 or fewer. A count above 100 by itself proves
        // neither the preference nor completeness.
        return context.alphabetClear
            ? renderedCardsMatchToolbarTotal(context)
            : hasConfirmedNativeAlphabetSubset(context);
    }

    function hasSavedUnpaginatedPreference() {
        const userId = currentUserId();
        if (!userId) return false;
        try { return root.localStorage.getItem(preferenceKey(userId)) === '0'; }
        catch { return false; }
    }

    function hasPotentialUnpaginatedResult(context) {
        // While the query-specific toolbar bullet is present, its count chip is
        // intentionally replaced. Keep a previously confirmed query eligible
        // only long enough for waitForReady() to observe its new settled count.
        return hasSavedUnpaginatedPreference()
            || state.confirmedUnpaginatedQueryId === context.queryId
            || (context.loading
                ? (context.cards.length === 0 || context.cardsMatchRouteContract) && context.cards.length > 100
                : hasCompleteUnpaginatedResult(context));
    }

    function hasInitialIndex(settings) {
        // Do not infer zero from a missing persisted field: StartIndex remains in
        // the item request even when Jellyfin omits limit for page size zero.
        return Number.isInteger(settings.StartIndex) && settings.StartIndex === 0;
    }

    function queryIdentity(route, settings) {
        const querySettings = { ...settings };
        delete querySettings.Alphabet;
        return JSON.stringify(canonical({
            hash: route.hash,
            parentId: route.parentId,
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
        const page = getPage(route);
        if (!route.supported || !page) return null;
        const settings = readViewSettings(route);
        const picker = findPicker(page);
        const toolbar = findLibraryToolbar();
        if (!settings || !picker || !toolbar) return null;
        const cards = cardsIn(page, route);
        return {
            route,
            page,
            settings,
            picker,
            toolbar,
            cards,
            cardsMatchRouteContract: cardsMatchRouteContract(cards, route),
            empty: !!page.querySelector('.noItemsMessage.centerMessage'),
            loading: hasLoadingMarker(toolbar),
            alphabetClear: isAlphabetClear(settings, picker),
            queryId: queryIdentity(route, settings)
        };
    }

    function isPotentiallySupported(context) {
        return !!context
            && context.route.supported
            && pluginAllowsRoute(context.route)
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
            && renderedCardsMatchToolbarTotal(context)
            && (context.cards.length > 0 || context.empty);
    }

    function firstMatch(cards, letter) {
        return cards.find(card => (card.dataset.prefix || '').startsWith(letter)) || null;
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

    function scrollBehavior() {
        return CONFIG.smoothScroll && !root.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'smooth'
            : 'auto';
    }

    function scrollTop() {
        root.scrollTo({
            top: 0,
            behavior: scrollBehavior()
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
            behavior: scrollBehavior()
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
                return node.matches?.('.itemsContainer .card, .noItemsMessage, .alphaPicker-fixed-right, .MuiChip-label')
                    || !!node.querySelector?.('.itemsContainer .card, .noItemsMessage, .alphaPicker-fixed-right, .MuiChip-label');
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

    function keyboardMode() {
        return ['off', 'prefix', 'plain'].includes(CONFIG.keyboardJumpMode)
            ? CONFIG.keyboardJumpMode
            : 'off';
    }

    function clearKeyboardPrefix(prefix = state.keyboard.prefix) {
        if (!prefix || state.keyboard.prefix !== prefix) return;
        if (prefix.timer) root.clearTimeout(prefix.timer);
        prefix.notice?.remove();
        state.keyboard.prefix = null;
    }

    function clearKeyboardPrefixIfStale(context = getContext()) {
        const prefix = state.keyboard.prefix;
        if (!prefix) return;
        if (!context || !isPotentiallySupported(context)
            || prefix.routeHash !== context.route.hash
            || prefix.queryId !== context.queryId
            || keyboardMode() !== 'prefix') clearKeyboardPrefix(prefix);
    }

    function showKeyboardPrefixNotice() {
        const notice = doc.createElement('div');
        notice.className = 'alpha-jump-keyboard-prefix';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.textContent = 'Jump to: A–Z / #';
        notice.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:1201;padding:.35rem .55rem;background:var(--theme-background,rgba(0,0,0,.85));color:inherit;border-radius:.25rem;pointer-events:none;';
        doc.body?.appendChild(notice);
        return notice;
    }

    function armKeyboardPrefix(context) {
        clearKeyboardPrefix();
        const prefix = {
            routeHash: context.route.hash,
            queryId: context.queryId,
            timer: null,
            notice: showKeyboardPrefixNotice()
        };
        prefix.timer = root.setTimeout(() => clearKeyboardPrefix(prefix), CONFIG.keyboardPrefixTimeoutMs);
        state.keyboard.prefix = prefix;
    }

    function elementIsEditableOrControl(element) {
        if (!element || element.nodeType !== 1) return false;
        if (element.isContentEditable) return true;
        return !!element.closest?.('input, textarea, select, button, [contenteditable], [role="textbox"], [role="combobox"], [role="searchbox"], [role="spinbutton"], [role="button"], [role="menuitem"], [role="option"], [role="listbox"]');
    }

    // Jellyfin Web v12.1 legacy dialogs mount a .dialogContainer/.dialog and
    // action-sheet backdrop. The ARIA checks additionally cover accessible
    // dialogs without relying on unrelated page-level class names.
    function blockingUiIsOpen() {
        return !!doc.querySelector?.('.dialogContainer, .dialog, .dialogBackdrop, [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]');
    }

    function keyboardEventIsEligible(event) {
        if (!event || event.defaultPrevented || event.repeat || event.isComposing
            || event.ctrlKey || event.altKey || event.metaKey
            || event.getModifierState?.('AltGraph')
            || elementIsEditableOrControl(event.target)
            || elementIsEditableOrControl(doc.activeElement)
            || blockingUiIsOpen()) return false;
        return true;
    }

    function keyboardJumpValue(event) {
        if (event.key === '#') return '#';
        return typeof event.key === 'string' && /^[A-Za-z]$/.test(event.key)
            ? event.key.toUpperCase()
            : null;
    }

    function ownKeyboardEvent(event) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
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
                scrollTop();
                announce(readyContext, 'At the beginning.', false);
                finishRun(run);
                return;
            }
            const card = firstMatch(readyContext.cards, value);
            if (card) {
                scrollToCard(card);
                announce(readyContext, `First ${value} title.`, false);
            } else {
                announce(readyContext, `No matching ${value} titles.`, false);
            }
            finishRun(run);
        } catch (caught) {
            if (!isCurrent(run)) return;
            const current = getContext();
            finishRun(run);
            if (current && /query changed/.test(String(caught?.message))) {
                announce(current, 'Cancelled: library query changed.', false);
            } else if (current && /unsupported/.test(String(caught?.message))) {
                announce(current, 'Alpha Jump is unavailable for this view.', false);
            } else if (current && /timeout/.test(String(caught?.message))) {
                announce(current, 'Search incomplete: Jellyfin results did not settle.', false);
            } else {
                reportError('Could not prepare library results.', caught);
                if (current) announce(current, 'Alpha Jump could not prepare these results.', false);
            }
        }
    }

    function activateJump(context, value) {
        if (value === '#' && context.alphabetClear && isReady(context) && !state.run) {
            scrollTop();
            announce(context, 'At the beginning.', false);
            return;
        }
        void execute(context, value);
    }

    function onKeyboardKeyDown(event) {
        const prefix = state.keyboard.prefix;
        if (event.key === 'Escape') {
            // Escape may cancel Alpha Jump internally, but a text control or
            // modal must retain its own Escape interaction and propagation.
            const canOwnEscape = keyboardEventIsEligible(event);
            if (prefix) {
                if (canOwnEscape) ownKeyboardEvent(event);
                clearKeyboardPrefix(prefix);
                return;
            }
            if (state.run) {
                if (canOwnEscape) ownKeyboardEvent(event);
                cancelRun('Cancelled.', true);
            }
            return;
        }

        if (prefix) {
            if (!keyboardEventIsEligible(event)) {
                clearKeyboardPrefix(prefix);
                return;
            }
            const context = getContext();
            if (!context || !isPotentiallySupported(context)
                || prefix.routeHash !== context.route.hash || prefix.queryId !== context.queryId
                || keyboardMode() !== 'prefix') {
                clearKeyboardPrefix(prefix);
                return;
            }
            // Repeating the chord restarts its brief prefix window; it does not
            // accidentally jump to J.
            if (event.key === 'J' && event.shiftKey) {
                ownKeyboardEvent(event);
                armKeyboardPrefix(context);
                return;
            }
            // On common layouts # is Shift+3, so preserve the armed prefix
            // while the standalone modifier key is depressed.
            if (event.key === 'Shift') return;
            const value = keyboardJumpValue(event);
            if (!value) {
                clearKeyboardPrefix(prefix);
                return;
            }
            ownKeyboardEvent(event);
            clearKeyboardPrefix(prefix);
            activateJump(context, value);
            return;
        }

        if (!keyboardEventIsEligible(event)) return;
        const context = getContext();
        if (!context || !isPotentiallySupported(context)) return;
        const mode = keyboardMode();
        if (mode === 'prefix') {
            if (event.key === 'J' && event.shiftKey) {
                ownKeyboardEvent(event);
                armKeyboardPrefix(context);
            }
            return;
        }
        if (mode !== 'plain') return;
        const value = keyboardJumpValue(event);
        if (!value) return;
        ownKeyboardEvent(event);
        activateJump(context, value);
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
        activateJump(context, button.value);
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
        clearKeyboardPrefix();
        if (state.picker?.root && state.pickerClick) {
            state.picker.root.removeEventListener('click', state.pickerClick, true);
        }
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
        // ApiClient can appear after the injected script and before the first
        // library render. This is also where SPA client replacement is noticed.
        ensureUpdateSubscription();
        const route = routeInfo();
        if (state.plugin.readinessRetry && state.plugin.readinessRetry.routeKey !== route.configKey) {
            clearPluginReadinessRetry();
        }
        // Plugin mode never arms from standalone defaults. Wait for one
        // authenticated, route-specific response before touching preferences or
        // picker events; failed requests leave Jellyfin's native picker intact.
        if (pluginMode() && route.kind && route.configKey && !pluginAllowsRoute(route)) {
            const hasRouteConfiguration = state.plugin.routeKey === route.configKey
                && state.plugin.configuration !== null;
            if (!hasRouteConfiguration && !state.plugin.failedRoutes.has(route.configKey)) {
                void loadPluginConfiguration(route)
                    .then(loaded => { if (loaded) scheduleLifecycle(); })
                    .catch(() => scheduleLifecycle());
            }
            cancelRun('Cancelled: plugin configuration changed.', false);
            detachSurface(true);
            return;
        }
        if (pluginMode() && (!route.kind || !route.configKey)) {
            cancelRun('Cancelled: navigation changed.', false);
            detachSurface(true);
            return;
        }
        const userId = configurePaginationPreference();
        if (!userId) {
            resetForUserChange(null);
            return;
        }
        const context = getContext();
        if (context && context.alphabetClear && renderedCardsMatchToolbarTotal(context)) {
            state.confirmedUnpaginatedQueryId = context.queryId;
            state.confirmedUnpaginatedTotal = renderedResultCount(context.toolbar);
        }
        if (state.run && (!context || context.route.hash !== state.run.routeHash || context.queryId !== state.run.queryId)) {
            cancelRun('Cancelled: library query changed.', true);
        }
        clearKeyboardPrefixIfStale(context);
        if (!isPotentiallySupported(context)) {
            detachSurface(true);
            applyPendingUpdate();
            return;
        }
        attachSurface(context);
        applyPendingUpdate();
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
            // newly supported state must be reconsidered even when a page root
            // was not added or removed.
            const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            if (target?.closest?.(SUPPORTED_PAGE_SELECTOR)) return true;
            // The count toolbar is outside the library page. It can settle after
            // the cards mount, while no surface-specific observer is attached yet.
            if (target?.matches?.('.MuiChip-label') || target?.closest?.('.MuiToolbar-root')) return true;
            return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(node => {
                if (node.nodeType !== 1) return false;
                return node.matches?.(SUPPORTED_PAGE_SELECTOR)
                    || node.matches?.('.MuiToolbar-root, .MuiChip-label')
                    || !!node.querySelector?.(`${SUPPORTED_PAGE_SELECTOR}, .MuiToolbar-root, .MuiChip-label`);
            });
        });
    }

    function init() {
        if (!CONFIG.enabled || !doc || state.destroyed) return;
        if (root[INSTANCE_KEY]?.destroy) root[INSTANCE_KEY].destroy('re-injected');
        state.plugin.marker = pluginMarker();
        startUpdateRecovery();
        state.hashChange = () => {
            clearKeyboardPrefix();
            cancelRun('Cancelled: navigation changed.', false);
            scheduleLifecycle();
        };
        state.popState = state.hashChange;
        state.loadListener = () => scheduleLifecycle();
        state.keyDown = onKeyboardKeyDown;
        state.keyboard.focusIn = event => {
            if (elementIsEditableOrControl(event.target) || blockingUiIsOpen()) clearKeyboardPrefix();
        };
        state.keyboard.blur = () => clearKeyboardPrefix();
        state.keyboard.visibility = () => {
            if (doc.visibilityState !== 'visible') clearKeyboardPrefix();
        };
        root.addEventListener('hashchange', state.hashChange);
        root.addEventListener('popstate', state.popState);
        root.addEventListener('load', state.loadListener, { once: true });
        root.addEventListener('blur', state.keyboard.blur);
        doc.addEventListener('keydown', state.keyDown, true);
        doc.addEventListener('focusin', state.keyboard.focusIn, true);
        doc.addEventListener('visibilitychange', state.keyboard.visibility);
        // Recover a missed first mount synchronously before React handles a letter.
        // Existing surface listeners still own normal clicks and native-clear bypass.
        state.firstPickerClick = event => {
            const button = event.target.closest?.('.alphaPicker-fixed-right button[value]');
            if (!button || !LETTERS.has(button.value) || state.picker?.group.contains(button)) return;
            refreshSurface();
            if (state.picker?.group.contains(button)) onPickerClick(event);
        };
        doc.addEventListener('click', state.firstPickerClick, true);
        // This observer only finds insertion/removal of a registry page; card
        // discovery and result observation remain scoped to its ItemsView.
        // It also wakes configuration when public ApiClient identity appears or
        // changes during SPA login/logout; it does not poll or patch that API.
        state.mountObserver = new root.MutationObserver(records => {
            if (pageWasAddedOrRemoved(records) || currentUserId() !== state.activeUserId) {
                scheduleLifecycle();
            }
        });
        state.mountObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });
        refreshSurface();
        root[INSTANCE_KEY] = api;
        log('initialized');
    }

    function destroy(reason = 'destroyed') {
        if (state.destroyed) return;
        state.destroyed = true;
        if (state.lifecycleFrame) root.cancelAnimationFrame(state.lifecycleFrame);
        clearPluginReadinessRetry();
        stopUpdateRecovery();
        clearKeyboardPrefix();
        cancelRun(null, false);
        detachSurface(true);
        state.mountObserver?.disconnect();
        state.mountObserver = null;
        root.removeEventListener('hashchange', state.hashChange);
        root.removeEventListener('popstate', state.popState);
        root.removeEventListener('load', state.loadListener);
        doc.removeEventListener('keydown', state.keyDown, true);
        doc.removeEventListener('focusin', state.keyboard.focusIn, true);
        doc.removeEventListener('visibilitychange', state.keyboard.visibility);
        doc.removeEventListener('click', state.firstPickerClick, true);
        root.removeEventListener('blur', state.keyboard.blur);
        if (root[INSTANCE_KEY] === api) delete root[INSTANCE_KEY];
        log(reason);
    }

    const api = {
        config: CONFIG,
        destroy,
        refresh: scheduleLifecycle,
        restorePagination: restorePaginationPreference
    };
    // Node's focused regression tests receive only deterministic helpers. The
    // injected browser instance does not expose these test hooks.
    const test = {
        canonical,
        renderedResultCount,
        hasCompleteUnpaginatedResult,
        hasPotentialUnpaginatedResult,
        isReady,
        hasInitialIndex,
        hasSupportedSort,
        isPotentialSnapshot: snapshot => snapshot.completeUnpaginatedResult === true
            && hasInitialIndex(snapshot.settings)
            && snapshot.settings.ViewMode === 'grid'
            && hasSupportedSort(snapshot.settings),
        queryIdentity,
        currentUserId,
        preferenceKey,
        backupKey,
        configurePaginationPreference,
        restorePaginationPreference,
        getContext,
        attachSurface,
        detachSurface,
        refreshSurface,
        execute,
        activateJump,
        onKeyboardKeyDown,
        keyboardMode,
        clearKeyboardPrefix,
        waitForReady,
        checkForPluginUpdate,
        applyPendingUpdate,
        getState: () => state
    };
    return { init, api, test };
}));
