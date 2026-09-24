const test = require('node:test');
const assert = require('node:assert/strict');
const createAlphaJump = require('../src/alpha-jump.js');

class FakeElement {
    constructor({ value, text = '', dataset = {}, selectors = [] } = {}) {
        this.nodeType = 1;
        this.value = value;
        this.textContent = text;
        this.dataset = dataset;
        this.selectors = new Set(selectors);
        this.childrenBySelector = new Map();
        this.attributes = new Map();
        this.listeners = new Map();
        this.classNames = new Set();
        this.classList = {
            add: name => this.classNames.add(name),
            remove: name => this.classNames.delete(name),
            toggle: (name, enabled) => enabled ? this.classNames.add(name) : this.classNames.delete(name),
            contains: name => this.classNames.has(name)
        };
        this.style = {};
        this.computedStyle = { display: 'block', visibility: 'visible', position: 'static' };
        this.children = [];
        this.parentElement = null;
        this.hidden = false;
        this.isConnected = true;
    }

    querySelectorAll(selector) {
        const mapped = this.childrenBySelector.get(selector);
        if (mapped) return mapped;
        const descendants = [];
        const visit = element => {
            element.children.forEach(child => {
                descendants.push(child);
                visit(child);
            });
        };
        visit(this);
        return descendants.filter(element => element.matches(selector));
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    matches(selector) {
        return selector.split(',').some(value => {
            const candidate = value.trim();
            if (this.selectors.has(candidate)) return true;
            if (candidate.startsWith('.')) return this.classNames.has(candidate.slice(1));
            const role = candidate.match(/^\[role="([^"]+)"\]$/);
            return !!role && this.getAttribute('role') === role[1];
        });
    }

    closest(selector) {
        let current = this;
        while (current) {
            if (current.matches(selector)) return current;
            current = current.parentElement;
        }
        return null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    addEventListener(type, callback) {
        this.listeners.set(type, callback);
    }

    removeEventListener(type, callback) {
        if (this.listeners.get(type) === callback) this.listeners.delete(type);
    }

    appendChild(child) {
        if (child.parentElement) {
            const index = child.parentElement.children.indexOf(child);
            if (index >= 0) child.parentElement.children.splice(index, 1);
        }
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    replaceChildren(...children) {
        this.children = children;
        children.forEach(child => { child.parentElement = this; });
    }

    remove() {
        this.isConnected = false;
        if (this.parentElement) {
            const index = this.parentElement.children.indexOf(this);
            if (index >= 0) this.parentElement.children.splice(index, 1);
            this.parentElement = null;
        }
    }

    get nextElementSibling() {
        if (!this.parentElement) return null;
        const index = this.parentElement.children.indexOf(this);
        return index < 0 ? null : this.parentElement.children[index + 1] || null;
    }

    getBoundingClientRect() {
        return { top: 100, bottom: 100 };
    }
}

function createDialogFixture({ state = 'open', kind = 'dialog', empty = false, hiddenAncestor = false } = {}) {
    const wrapper = new FakeElement();
    const container = new FakeElement();
    container.classList.add('dialogContainer');
    const dialog = new FakeElement();
    if (kind === 'aria') {
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
    } else {
        dialog.classList.add('dialog');
        if (kind === 'actionSheet') dialog.classList.add('actionSheet');
    }
    const backdrop = new FakeElement();
    backdrop.classList.add('dialogBackdrop');

    if (state === 'open') {
        dialog.classList.add('opened');
        backdrop.classList.add('dialogBackdropOpened');
    } else if (state === 'hidden') {
        dialog.classList.add('hide');
        backdrop.hidden = true;
    } else if (state === 'closing') {
        // Jellyfin's close path hides the dialog before removing its backdrop.
        dialog.classList.add('hide');
    } else if (state === 'aria-hidden') {
        dialog.setAttribute('aria-hidden', 'true');
        backdrop.hidden = true;
    } else if (state === 'display-none') {
        dialog.computedStyle.display = 'none';
        backdrop.computedStyle.display = 'none';
    } else if (state === 'visibility-hidden') {
        dialog.computedStyle.visibility = 'hidden';
        backdrop.computedStyle.visibility = 'hidden';
    }

    if (hiddenAncestor) wrapper.classList.add('hide');
    if (empty) backdrop.hidden = true;
    if (!empty) container.appendChild(dialog);
    wrapper.appendChild(backdrop);
    wrapper.appendChild(container);
    return { wrapper, container, dialog, backdrop };
}

// Mirrors only the source-backed entries in Alpha Jump's browser registry.
// The harness intentionally gives every rendered card a concrete type so the
// production completeness check can reject heterogeneous/unknown result DOM.
const TEST_VIEWS = {
    movies: { path: '#/movies', collectionType: 'movies', pageId: 'moviesPage', settingsKey: 'movies', itemTypes: ['Movie'] },
    series: { path: '#/tv', collectionType: 'tvshows', pageId: 'tvshowsPage', settingsKey: 'series', itemTypes: ['Series'] },
    movieCollections: { path: '#/movies', collectionType: 'movies', pageId: 'moviesPage', settingsKey: 'collections', itemTypes: ['BoxSet'], tab: 3 },
    showCollections: { path: '#/tv', collectionType: 'tvshows', pageId: 'tvshowsPage', settingsKey: 'collections', itemTypes: ['BoxSet'], tab: 6 },
    booksFolders: { path: '#/books', collectionType: 'books', pageId: 'booksPage', settingsKey: 'folders', itemTypes: ['Folder', 'AudioBook', 'Book'] },
    books: { path: '#/books', collectionType: 'books', pageId: 'booksPage', settingsKey: 'books', itemTypes: ['AudioBook', 'Book'], tab: 1 },
    bookCollections: { path: '#/books', collectionType: 'books', pageId: 'booksPage', settingsKey: 'collections', itemTypes: ['BoxSet'], tab: 5 },
    bookFavorites: { path: '#/books', collectionType: 'books', pageId: 'booksPage', settingsKey: 'favorites', itemTypes: ['AudioBook', 'Book'], tab: 6 },
    boxsets: { path: '#/boxsets', collectionType: 'boxsets', pageId: 'boxsetsPage', settingsKey: 'collections', itemTypes: ['BoxSet'], tab: 0, scope: 'collections' },
    boxsetFavorites: { path: '#/boxsets', collectionType: 'boxsets', pageId: 'boxsetsPage', settingsKey: 'favorites', itemTypes: ['BoxSet'], tab: 1, scope: 'collections' },
    homevideos: { path: '#/homevideos', collectionType: 'homevideos', pageId: 'homevideos', settingsKey: 'folders', itemTypes: ['Folder', 'Photo', 'PhotoAlbum', 'Video'] },
    photos: { path: '#/homevideos', collectionType: 'homevideos', pageId: 'homevideos', settingsKey: 'photos', itemTypes: ['Photo'], tab: 1 },
    photoalbums: { path: '#/homevideos', collectionType: 'homevideos', pageId: 'homevideos', settingsKey: 'photoalbums', itemTypes: ['PhotoAlbum'], tab: 2 },
    homevideosVideos: { path: '#/homevideos', collectionType: 'homevideos', pageId: 'homevideos', settingsKey: 'videos', itemTypes: ['Video'], tab: 3 },
    mixedFolders: { path: '#/mixed', collectionType: 'mixed', pageId: 'mixed', settingsKey: 'folders', itemTypes: ['Folder', 'Movie', 'Series'] },
    mixed: { path: '#/mixed', collectionType: 'mixed', pageId: 'mixed', settingsKey: 'mixed', itemTypes: ['Movie', 'Series'], tab: 2 },
    mixedCollections: { path: '#/mixed', collectionType: 'mixed', pageId: 'mixed', settingsKey: 'collections', itemTypes: ['BoxSet'], tab: 3 },
    music: { path: '#/music', collectionType: 'music', pageId: 'musicPage', settingsKey: 'albums', itemTypes: ['MusicAlbum'] },
    musicCollections: { path: '#/music', collectionType: 'music', pageId: 'musicPage', settingsKey: 'collections', itemTypes: ['BoxSet'], tab: 7 },
    musicvideosFolders: { path: '#/musicvideos', collectionType: 'musicvideos', pageId: 'musicvideos', settingsKey: 'folders', itemTypes: ['Folder', 'MusicVideo'] },
    musicvideos: { path: '#/musicvideos', collectionType: 'musicvideos', pageId: 'musicvideos', settingsKey: 'musicvideos', itemTypes: ['MusicVideo'], tab: 2 },
    playlists: { path: '#/playlists', collectionType: 'playlists', pageId: 'playlistsPage', settingsKey: 'playlists', itemTypes: ['Playlist'] },
    playlistFavorites: { path: '#/playlists', collectionType: 'playlists', pageId: 'playlistsPage', settingsKey: 'favorites', itemTypes: ['Playlist'], tab: 1 },
    livetv: { path: '#/livetv', collectionType: 'livetv', pageId: 'liveTvPage', settingsKey: 'programs', itemTypes: ['Program'] }
};

function createHarness({
    alphabet = null,
    loading = false,
    prefixes = ['AL', 'ZM'],
    settingsPatch = {},
    renderedCount = 101,
    cardCount = renderedCount,
    userId = 'active-user',
    library = 'movies',
    cardTypes = null,
    missingPrefixAt = null,
    routeLibraryId = 'library',
    loggedIn = true,
    apiAvailable = true,
    pluginConfiguration = null,
    pluginConfigurationFailure = false,
    runtime = null,
    playbackExposed = false,
    visibility = 'visible',
    dialogFixtures = []
} = {}) {
    const serverConfiguration = pluginConfiguration && {
        ...pluginConfiguration,
        keyboardJumpMode: pluginConfiguration.keyboardJumpMode ?? 'prefix'
    };
    const view = TEST_VIEWS[library] || TEST_VIEWS.movies;
    const pageId = view.pageId;
    const observers = [];
    const scrollCalls = [];
    const settings = {
        StartIndex: 0,
        ViewMode: 'grid',
        SortBy: ['SortName'],
        SortOrder: 'Ascending',
        Alphabet: alphabet,
        ...settingsPatch
    };
    const allPrefixes = [...prefixes];
    while (allPrefixes.length < renderedCount) allPrefixes.push(`Q${allPrefixes.length}`);
    const page = new FakeElement({ selectors: ['#' + pageId] });
    const toolbar = new FakeElement({ selectors: ['.MuiToolbar-root'] });
    const chip = new FakeElement({ text: loading ? '∙' : String(allPrefixes.length), selectors: ['.MuiChip-label'] });
    toolbar.childrenBySelector.set('.MuiChip-label', [chip]);
    const pickerRoot = new FakeElement({ selectors: ['.alphaPicker-fixed-right'] });
    const group = new FakeElement({ selectors: ['[role="group"].MuiToggleButtonGroup-vertical'] });
    const buttons = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(value => {
        const button = new FakeElement();
        button.value = value;
        button.setAttribute('aria-pressed', value === alphabet ? 'true' : 'false');
        button.closest = selector => selector.includes('button') ? button : null;
        return button;
    });
    const cards = allPrefixes.slice(0, cardCount).map((prefix, index) => new FakeElement({
        dataset: {
            ...(index === missingPrefixAt ? {} : { prefix }),
            type: cardTypes?.[index] || view.itemTypes[index % view.itemTypes.length]
        },
        selectors: ['.card']
    }));
    pickerRoot.childrenBySelector.set('[role="group"].MuiToggleButtonGroup-vertical', [group]);
    group.childrenBySelector.set('button[type="button"][value]', buttons);
    group.contains = node => buttons.includes(node);
    page.childrenBySelector.set('.alphaPicker-fixed-right', [pickerRoot]);
    page.childrenBySelector.set('.itemsContainer .card', cards);
    page.childrenBySelector.set('.noItemsMessage.centerMessage', []);

    const documentListeners = new Map();
    const documentListenerSets = new Map();
    const windowListeners = new Map();
    const windowListenerSets = new Map();
    const addListener = (listeners, listenerSets, type, callback) => {
        const callbacks = listenerSets.get(type) || new Set();
        callbacks.add(callback);
        listenerSets.set(type, callbacks);
        listeners.set(type, event => callbacks.forEach(listener => listener(event)));
    };
    const removeListener = (listeners, listenerSets, type, callback) => {
        const callbacks = listenerSets.get(type);
        if (!callbacks) return;
        callbacks.delete(callback);
        if (!callbacks.size) {
            listenerSets.delete(type);
            listeners.delete(type);
        }
    };
    const body = new FakeElement();
    const head = new FakeElement();
    const dialogElements = dialogFixtures.flatMap(fixture => {
        const nodes = createDialogFixture(fixture);
        body.appendChild(nodes.wrapper);
        return nodes.container.children.length
            ? [nodes.container, nodes.dialog, nodes.backdrop]
            : [nodes.container, nodes.backdrop];
    });
    const document = {
        body,
        head,
        visibilityState: visibility,
        activeElement: null,
        querySelectorAll: selector => {
            if (selector === '#' + pageId) return [page];
            if (selector === '.MuiToolbar-root') return [toolbar];
            if (selector === '[role="banner"], .MuiAppBar-root') return [];
            if (selector === '#alpha-jump-plugin-bootstrap') return serverConfiguration ? [pluginMarker] : [];
            return dialogElements.filter(element => element.matches(selector));
        },
        querySelector: selector => {
            if (selector === '.docspinner.mdlSpinnerActive') return null;
            return document.querySelectorAll(selector)[0] || null;
        },
        createElement: () => new FakeElement(),
        createTextNode: text => ({ nodeType: 3, textContent: text }),
        addEventListener(type, callback) { addListener(documentListeners, documentListenerSets, type, callback); },
        removeEventListener(type, callback) { removeListener(documentListeners, documentListenerSets, type, callback); }
    };
    const storage = new Map([
        [`${view.settingsKey} - library`, JSON.stringify(settings)]
    ]);
    const pluginMarker = serverConfiguration ? new FakeElement() : null;
    if (pluginMarker) {
        pluginMarker.setAttribute('data-alpha-jump-mode', 'plugin');
        pluginMarker.setAttribute('data-alpha-jump-config-url', '/AlphaJump/client-config');
        if (runtime) {
            pluginMarker.setAttribute('data-alpha-jump-runtime-url', '/AlphaJump/runtime');
            pluginMarker.setAttribute('data-alpha-jump-runtime-id', runtime.initial.runtimeId);
            pluginMarker.setAttribute('data-alpha-jump-script-fingerprint', runtime.initial.fingerprint);
        }
    }
    const sessionStorage = new Map();
    let reloads = 0;
    let activeUserId = userId;
    let isLoggedIn = loggedIn;
    let isApiAvailable = apiAvailable;
    const subscriptions = [];
    let runtimeCalls = 0;
    const ajaxRequests = [];
    const nextRuntimeResponse = () => {
        runtimeCalls += 1;
        const value = runtime?.responses?.length ? runtime.responses.shift() : runtime?.response;
        return typeof value === 'function' ? value() : value;
    };
    const makeApiClient = () => ({
        getCurrentUserId: () => activeUserId,
        isLoggedIn: () => isLoggedIn,
        ajax: options => {
            ajaxRequests.push(options);
            return pluginConfigurationFailure
                ? Promise.reject(new Error('server unavailable'))
                : Promise.resolve(options.url === '/AlphaJump/runtime' ? nextRuntimeResponse() : serverConfiguration);
        },
        subscribe: (_events, callback) => {
            const subscription = { callback, active: true };
            subscriptions.push(subscription);
            return () => { subscription.active = false; };
        }
    });
    let apiClient = makeApiClient();
    const root = {
        document,
        playbackManager: playbackExposed ? { isPlayingLocally: () => false } : undefined,
        location: {
            hash: view.path + '?topParentId=' + routeLibraryId + '&collectionType=' + view.collectionType + (view.tab === undefined ? '' : '&tab=' + view.tab),
            origin: 'http://jellyfin.test',
            reload: () => { reloads += 1; }
        },
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: key => storage.delete(key)
        },
        sessionStorage: {
            getItem: key => sessionStorage.get(key) || null,
            setItem: (key, value) => sessionStorage.set(key, String(value)),
            removeItem: key => sessionStorage.delete(key)
        },
        get ApiClient() { return isApiAvailable ? apiClient : null; },
        matchMedia: () => ({ matches: true }),
        getComputedStyle: element => element?.computedStyle || { display: 'block', visibility: 'visible', position: 'static' },
        scrollY: 0,
        scrollTo: options => scrollCalls.push(options),
        requestAnimationFrame: callback => {
            queueMicrotask(callback);
            return 1;
        },
        cancelAnimationFrame() {},
        setTimeout,
        clearTimeout,
        addEventListener(type, callback) { addListener(windowListeners, windowListenerSets, type, callback); },
        removeEventListener(type, callback) { removeListener(windowListeners, windowListenerSets, type, callback); },
        MutationObserver: class {
            constructor(callback) {
                this.callback = callback;
                this.connected = true;
                observers.push(this);
            }
            observe() {}
            disconnect() {
                this.connected = false;
            }
        }
    };
    const notify = target => {
        const record = { type: 'childList', target, addedNodes: [], removedNodes: [] };
        observers.filter(observer => observer.connected).forEach(observer => observer.callback([record]));
    };
    const persist = () => storage.set(`${view.settingsKey} - library`, JSON.stringify(settings));
    const setLoading = value => {
        chip.textContent = value ? '∙' : String(allPrefixes.length);
        notify(chip);
    };
    const clearNative = () => {
        settings.Alphabet = null;
        buttons.forEach(button => button.setAttribute('aria-pressed', 'false'));
        persist();
        notify(chip);
    };
    const activateNative = value => {
        settings.Alphabet = value;
        buttons.forEach(button => button.setAttribute('aria-pressed', button.value === value ? 'true' : 'false'));
        persist();
        notify(chip);
    };
    const clickPicker = value => {
        const event = {
            target: buttons.find(button => button.value === value),
            preventDefault() { this.prevented = true; },
            stopImmediatePropagation() { this.stopped = true; }
        };
        pickerRoot.listeners.get('click')?.(event);
        return event;
    };
    const editableTarget = selector => {
        const target = new FakeElement({ selectors: [selector] });
        target.closest = query => target.matches(query) ? target : null;
        return target;
    };
    const keyDown = ({ key, target = body, ...options }) => {
        const event = {
            key,
            target,
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; this.prevented = true; },
            stopImmediatePropagation() { this.stopped = true; },
            getModifierState: name => name === 'AltGraph' && options.altGraph === true,
            ...options
        };
        documentListeners.get('keydown')?.(event);
        return event;
    };
    buttons.forEach(button => {
        button.click = () => {
            const event = { target: button, preventDefault() {}, stopImmediatePropagation() {} };
            pickerRoot.listeners.get('click')?.(event);
            if (button.value === settings.Alphabet) clearNative();
        };
    });
    const instance = createAlphaJump(root);
    return {
        ...instance,
        settings,
        settingsKey: `${view.settingsKey} - library`,
        view,
        buttons,
        cards,
        page,
        pickerRoot,
        chip,
        scrollCalls,
        documentListeners,
        setLoading,
        persist,
        notify,
        clickPicker,
        keyDown,
        editableTarget,
        activateNative,
        root,
        storage,
        sessionStorage,
        setUser: value => { activeUserId = value; },
        setLoggedIn: value => { isLoggedIn = value; },
        setApiAvailable: value => { isApiAvailable = value; },
        replaceApiClient: () => { apiClient = makeApiClient(); },
        emitRestart: () => subscriptions.filter(subscription => subscription.active).forEach(subscription => subscription.callback()),
        get activeSubscriptions() { return subscriptions.filter(subscription => subscription.active).length; },
        setVisibility: value => { document.visibilityState = value; documentListeners.get('visibilitychange')?.(); },
        blur: () => windowListeners.get('blur')?.(),
        focusEditable: target => { document.activeElement = target; documentListeners.get('focusin')?.({ target }); },
        get runtimeCalls() { return runtimeCalls; },
        ajaxRequests,
        get reloads() { return reloads; }
    };
}

const turn = () => new Promise(resolve => setTimeout(resolve, 0));
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function enableKeyboard(harness, mode) {
    harness.storage.set('active-user-libraryPageSize', '0');
    harness.api.config.keyboardJumpMode = mode;
    harness.init();
}

function assertNoPersistentAlphaJumpMarker(harness) {
    harness.buttons.forEach(button => {
        assert.equal(button.classNames.has('alpha-jump-selected'), false);
        assert.equal(button.getAttribute('data-alpha-jump-selected'), null);
        assert.equal(button.getAttribute('aria-current'), null);
    });
}

test('production context requires complete rendered cards and explicit StartIndex zero', () => {
    const complete = createHarness();
    assert.equal(complete.test.hasCompleteUnpaginatedResult(complete.test.getContext()), true);
    const incomplete = createHarness({ renderedCount: 101, cardCount: 100 });
    assert.equal(incomplete.test.hasCompleteUnpaginatedResult(incomplete.test.getContext()), false);
    const offset = createHarness({ settingsPatch: { StartIndex: 100 } });
    const context = offset.test.getContext();
    assert.equal(offset.test.hasInitialIndex(context.settings), false);
});

test('complete small results are supported only when every toolbar item has a card', () => {
    const complete = createHarness({ renderedCount: 3, cardCount: 3 });
    const incomplete = createHarness({ renderedCount: 3, cardCount: 2 });
    const pending = createHarness({ renderedCount: 3, cardCount: 3, loading: true });
    assert.equal(complete.test.hasCompleteUnpaginatedResult(complete.test.getContext()), true);
    assert.equal(incomplete.test.hasCompleteUnpaginatedResult(incomplete.test.getContext()), false);
    assert.equal(pending.test.isReady(pending.test.getContext()), false);
});

test('auto configuration backs up a missing or explicit active-user preference and reloads once', () => {
    const missing = createHarness();
    assert.equal(missing.test.configurePaginationPreference(), 'active-user');
    assert.equal(missing.storage.get('active-user-libraryPageSize'), '0');
    assert.equal(missing.reloads, 1);
    assert.deepEqual(JSON.parse(missing.storage.get(missing.test.backupKey('active-user'))), {
        version: 1,
        origin: 'http://jellyfin.test',
        userId: 'active-user',
        existed: false,
        value: null
    });

    const explicit = createHarness();
    explicit.storage.set('active-user-libraryPageSize', '250');
    explicit.test.configurePaginationPreference();
    assert.equal(explicit.storage.get('active-user-libraryPageSize'), '0');
    assert.equal(explicit.reloads, 1);
    assert.equal(JSON.parse(explicit.storage.get(explicit.test.backupKey('active-user'))).value, '250');
});

test('production init runs automatic configuration through the public active client', () => {
    const harness = createHarness();
    harness.init();
    assert.equal(harness.storage.get('active-user-libraryPageSize'), '0');
    assert.equal(harness.reloads, 1);
    assert.equal(harness.root.__alphaJumpPrototypeV1?.config.autoDisablePagination, true);
});

test('auto configuration uses only the active API-client user key and does nothing for an existing zero', () => {
    const harness = createHarness();
    harness.storage.set('other-user-libraryPageSize', '25');
    harness.storage.set('active-user-libraryPageSize', '0');
    harness.test.configurePaginationPreference();
    assert.equal(harness.storage.get('active-user-libraryPageSize'), '0');
    assert.equal(harness.storage.get('other-user-libraryPageSize'), '25');
    assert.equal(harness.storage.has(harness.test.backupKey('active-user')), false);
    assert.equal(harness.reloads, 0);
});

test('one session never loops or fights a user preference change after setup', () => {
    const harness = createHarness();
    harness.test.configurePaginationPreference();
    harness.storage.set('active-user-libraryPageSize', '100');
    harness.test.configurePaginationPreference();
    const reinjected = createAlphaJump(harness.root);
    reinjected.test.configurePaginationPreference();
    assert.equal(harness.storage.get('active-user-libraryPageSize'), '100');
    assert.equal(harness.reloads, 1);
    assert.equal(JSON.parse(harness.storage.get(harness.test.backupKey('active-user'))).existed, false);
});

test('authentication, malformed backup, and storage failures leave preferences untouched', () => {
    const signedOut = createHarness({ loggedIn: false });
    assert.equal(signedOut.test.configurePaginationPreference(), null);
    assert.equal(signedOut.storage.has('active-user-libraryPageSize'), false);
    assert.equal(signedOut.reloads, 0);

    const malformedBackup = createHarness();
    malformedBackup.storage.set('active-user-libraryPageSize', '100');
    malformedBackup.storage.set(malformedBackup.test.backupKey('active-user'), '{bad json');
    malformedBackup.test.configurePaginationPreference();
    assert.equal(malformedBackup.storage.get('active-user-libraryPageSize'), '100');
    assert.equal(malformedBackup.reloads, 0);

    const brokenStorage = createHarness();
    brokenStorage.root.localStorage.getItem = () => { throw new Error('denied'); };
    brokenStorage.test.configurePaginationPreference();
    assert.equal(brokenStorage.reloads, 0);
});

test('user switching and restoration stay scoped to the matching active user', () => {
    const harness = createHarness();
    harness.storage.set('active-user-libraryPageSize', '400');
    harness.test.configurePaginationPreference();
    harness.setUser('second-user');
    harness.storage.set('second-user-libraryPageSize', '50');
    harness.test.configurePaginationPreference();
    assert.equal(harness.storage.get('active-user-libraryPageSize'), '0');
    assert.equal(harness.storage.get('second-user-libraryPageSize'), '0');
    assert.equal(JSON.parse(harness.storage.get(harness.test.backupKey('active-user'))).value, '400');
    assert.equal(JSON.parse(harness.storage.get(harness.test.backupKey('second-user'))).value, '50');

    assert.equal(harness.test.restorePaginationPreference(), true);
    assert.equal(harness.storage.get('second-user-libraryPageSize'), '50');
    assert.equal(harness.storage.get('active-user-libraryPageSize'), '0');
    const reinjected = createAlphaJump(harness.root);
    reinjected.test.configurePaginationPreference();
    assert.equal(harness.storage.get('second-user-libraryPageSize'), '50');
});

test('restoration removes an originally absent preference and does not reapply in the session', () => {
    const harness = createHarness();
    harness.test.configurePaginationPreference();
    assert.equal(harness.test.restorePaginationPreference(), true);
    assert.equal(harness.storage.has('active-user-libraryPageSize'), false);
    const reinjected = createAlphaJump(harness.root);
    reinjected.test.configurePaginationPreference();
    assert.equal(harness.storage.has('active-user-libraryPageSize'), false);
    assert.equal(harness.reloads, 1);
});

test('an existing zero does not make stale paged cards jump-ready', () => {
    const harness = createHarness({ renderedCount: 101, cardCount: 100 });
    harness.storage.set('active-user-libraryPageSize', '0');
    harness.test.configurePaginationPreference();
    assert.equal(harness.reloads, 0);
    assert.equal(harness.test.hasCompleteUnpaginatedResult(harness.test.getContext()), false);
});

test('# goes through the production native-clear and readiness path before scrolling top', async () => {
    const harness = createHarness({ prefixes: ['MM', 'MN'] });
    harness.test.refreshSurface();
    harness.activateNative('M');
    await turn();
    const event = harness.clickPicker('#');
    await turn();
    assert.equal(event.prevented, true);
    assert.equal(harness.settings.Alphabet, null);
    assert.equal(harness.buttons.find(button => button.value === 'M').getAttribute('aria-pressed'), 'false');
    assert.equal(harness.scrollCalls.at(-1).top, 0);
    assert.equal(harness.test.getState().run, null);
    assertNoPersistentAlphaJumpMarker(harness);
});

test('repeated letter clicks are independent jump commands with no persistent marker', async () => {
    const harness = createHarness({ prefixes: ['MA', 'MZ', 'ZA'] });
    harness.test.attachSurface(harness.test.getContext());

    const first = harness.clickPicker('M');
    await turn();
    const firstDestination = harness.scrollCalls.at(-1);
    const second = harness.clickPicker('M');
    await turn();

    assert.equal(first.prevented, true);
    assert.equal(second.prevented, true);
    assert.equal(harness.settings.Alphabet, null);
    assert.equal(harness.buttons.find(button => button.value === 'M').getAttribute('aria-pressed'), 'false');
    assert.equal(harness.scrollCalls.length, 2);
    assert.equal(firstDestination.top, 88);
    assert.equal(harness.scrollCalls.at(-1).top, 88);
    assert.notEqual(harness.scrollCalls.at(-1).top, 0);
    assert.equal(harness.test.getState().feedback.children[0].textContent, 'First M title.');
    assertNoPersistentAlphaJumpMarker(harness);
});

test('# remains the explicit return-to-beginning command after a letter jump', async () => {
    const harness = createHarness({ prefixes: ['MA', 'ZA'] });
    harness.test.attachSurface(harness.test.getContext());
    harness.clickPicker('M');
    await turn();
    const beginning = harness.clickPicker('#');

    assert.equal(beginning.prevented, true);
    assert.equal(harness.scrollCalls.at(-1).top, 0);
    assert.equal(harness.test.getState().feedback.children[0].textContent, 'At the beginning.');
    assert.equal(harness.buttons.find(button => button.value === '#').getAttribute('aria-pressed'), 'false');
    assertNoPersistentAlphaJumpMarker(harness);
});

test('a native alphabet subset is eligible only after this query was proven fully unpaginated', () => {
    const unproven = createHarness({ alphabet: 'M', renderedCount: 2 });
    assert.equal(unproven.test.hasPotentialUnpaginatedResult(unproven.test.getContext()), false);

    const proven = createHarness({ renderedCount: 101 });
    proven.test.refreshSurface();
    proven.page.childrenBySelector.set('.itemsContainer .card', proven.test.getContext().cards.slice(0, 2));
    proven.chip.textContent = '2';
    proven.activateNative('M');
    assert.equal(proven.test.hasPotentialUnpaginatedResult(proven.test.getContext()), true);
});

test('production waiter remains pending for the toolbar bullet and resolves from its observed removal', async () => {
    const harness = createHarness({ loading: true, prefixes: ['AL'] });
    const pending = harness.test.execute(harness.test.getContext(), 'A');
    await turn();
    assert.notEqual(harness.test.getState().run, null);
    harness.setLoading(false);
    await pending;
    assert.equal(harness.scrollCalls.length, 1);
    assert.equal(harness.scrollCalls[0].top, 88);
    assert.equal(harness.buttons.find(button => button.value === 'A').getAttribute('aria-pressed'), 'false');
    assertNoPersistentAlphaJumpMarker(harness);
});

test('a real second execute cancels the first waiter and only the latest request scrolls', async () => {
    const harness = createHarness({ loading: true, prefixes: ['AL', 'ZM'] });
    const first = harness.test.execute(harness.test.getContext(), 'A');
    await turn();
    const latest = harness.test.execute(harness.test.getContext(), 'Z');
    harness.setLoading(false);
    await Promise.all([first, latest]);
    assert.equal(harness.scrollCalls.length, 1);
    assert.equal(harness.scrollCalls[0].top, 88);
    assertNoPersistentAlphaJumpMarker(harness);
});

test('a production waiter cancels when the persisted query identity changes', async () => {
    const harness = createHarness({ loading: true, prefixes: ['AL'] });
    const pending = harness.test.execute(harness.test.getContext(), 'A');
    await turn();
    harness.settings.Filters = { Genres: ['Drama'] };
    harness.persist();
    harness.notify(harness.chip);
    await pending;
    assert.equal(harness.scrollCalls.length, 0);
    assertNoPersistentAlphaJumpMarker(harness);
});

test('production detach removes its listener and feedback without changing native button state', async () => {
    const harness = createHarness();
    const context = harness.test.getContext();
    harness.test.attachSurface(context);
    const button = harness.buttons[1];
    button.setAttribute('aria-pressed', 'false');
    await harness.test.execute(context, 'A');
    const feedback = harness.test.getState().feedback;
    assert.ok(feedback?.isConnected);
    harness.test.detachSurface(true);
    assert.equal(harness.pickerRoot.listeners.has('click'), false);
    assert.equal(feedback.isConnected, false);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assertNoPersistentAlphaJumpMarker(harness);
});

test('keyboard shortcuts default to Prefix and invalid/old plugin contract responses fail closed', async () => {
    const standalone = createHarness();
    standalone.storage.set('active-user-libraryPageSize', '0');
    standalone.init();
    const untouched = standalone.keyDown({ key: 'A' });
    assert.equal(untouched.prevented, undefined);
    assert.equal(standalone.scrollCalls.length, 0);
    assert.equal(standalone.keyDown({ key: 'J', shiftKey: true }).prevented, true);
    assert.ok(standalone.test.getState().keyboard.prefix);
    standalone.api.destroy();

    const oldContract = createHarness({
        pluginConfiguration: {
            contractVersion: 2, scope: 'library', libraryId: 'library', enabled: true,
            libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false
        }
    });
    oldContract.init();
    await turn();
    assert.equal(oldContract.pickerRoot.listeners.has('click'), false);
    oldContract.api.destroy();

    const invalidMode = createHarness({
        routeLibraryId: '0123456789abcdef0123456789abcdef',
        pluginConfiguration: {
            contractVersion: 3, scope: 'library', libraryId: '01234567-89ab-cdef-0123-456789abcdef',
            enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false,
            debug: false, keyboardJumpMode: 'unexpected'
        }
    });
    invalidMode.init();
    await turn();
    assert.equal(invalidMode.pickerRoot.listeners.has('click'), false);
    invalidMode.api.destroy();
});

test('Prefix keyboard mode owns Shift+J then uses the picker activation path for letters and #', async () => {
    const h = createHarness({ prefixes: ['AL', 'ZM'] });
    h.storage.set('active-user-libraryPageSize', '0');
    h.api.config.keyboardJumpMode = 'prefix';
    h.init();
    const arm = h.keyDown({ key: 'J', shiftKey: true });
    assert.equal(arm.prevented, true);
    assert.equal(h.test.getState().keyboard.prefix.notice.textContent, 'Jump to: A–Z / #');
    const letter = h.keyDown({ key: 'a' });
    assert.equal(letter.prevented, true);
    await turn();
    assert.equal(h.scrollCalls.length, 1);
    assert.equal(h.settings.Alphabet, null);
    assert.equal(h.test.getState().keyboard.prefix, null);

    h.scrollCalls.length = 0;
    h.root.scrollY = 55;
    h.keyDown({ key: 'J', shiftKey: true });
    const shift = h.keyDown({ key: 'Shift', shiftKey: true });
    assert.equal(shift.prevented, undefined);
    assert.ok(h.test.getState().keyboard.prefix);
    const top = h.keyDown({ key: '#' , shiftKey: true });
    assert.equal(top.prevented, true);
    await turn();
    assert.equal(h.scrollCalls[0].top, 0);
    h.api.destroy();
});

test('Prefix mode expires, Escape and unrelated keys cancel, and repeated Shift+J restarts its window', async () => {
    const h = createHarness();
    h.storage.set('active-user-libraryPageSize', '0');
    h.api.config.keyboardJumpMode = 'prefix';
    h.api.config.keyboardPrefixTimeoutMs = 1;
    h.init();
    h.keyDown({ key: 'J', shiftKey: true });
    await pause(5);
    assert.equal(h.test.getState().keyboard.prefix, null);
    assert.equal(h.keyDown({ key: 'A' }).prevented, undefined);

    h.keyDown({ key: 'J', shiftKey: true });
    const escape = h.keyDown({ key: 'Escape' });
    assert.equal(escape.prevented, true);
    assert.equal(h.test.getState().keyboard.prefix, null);
    h.keyDown({ key: 'J', shiftKey: true });
    const handledEscape = h.keyDown({ key: 'Escape', defaultPrevented: true });
    assert.equal(handledEscape.prevented, undefined);
    assert.equal(h.test.getState().keyboard.prefix, null);
    h.keyDown({ key: 'J', shiftKey: true });
    assert.equal(h.keyDown({ key: '!' }).prevented, undefined);
    assert.equal(h.test.getState().keyboard.prefix, null);
    h.keyDown({ key: 'J', shiftKey: true });
    const first = h.test.getState().keyboard.prefix;
    h.keyDown({ key: 'J', shiftKey: true });
    assert.notEqual(h.test.getState().keyboard.prefix, first);
    h.api.destroy();
});

test('Plain keyboard mode matches picker destination semantics and rejects editing, controls, dialogs, and modifiers', async () => {
    const keyboard = createHarness({ prefixes: ['AL', 'ZM'] });
    keyboard.storage.set('active-user-libraryPageSize', '0');
    keyboard.api.config.keyboardJumpMode = 'plain';
    keyboard.init();
    const a = keyboard.keyDown({ key: 'A', shiftKey: true });
    assert.equal(a.prevented, true);
    await turn();
    const keyboardTop = keyboard.scrollCalls[0].top;
    keyboard.scrollCalls.length = 0;
    keyboard.clickPicker('A');
    await turn();
    assert.equal(keyboard.scrollCalls[0].top, keyboardTop);
    for (const options of [
        { key: 'A', target: keyboard.editableTarget('input') },
        { key: 'A', target: keyboard.editableTarget('[role="textbox"]') },
        { key: 'A', target: keyboard.editableTarget('button') },
        { key: 'A', ctrlKey: true }, { key: 'A', altKey: true }, { key: 'A', metaKey: true },
        { key: 'A', altGraph: true }, { key: 'A', repeat: true }, { key: 'A', isComposing: true },
        { key: 'Enter' }, { key: ' ' }, { key: 'ArrowDown' }
    ]) assert.equal(keyboard.keyDown(options).prevented, undefined);
    keyboard.api.destroy();

    const dialog = createHarness({ dialogFixtures: [{ state: 'open' }] });
    dialog.storage.set('active-user-libraryPageSize', '0');
    dialog.api.config.keyboardJumpMode = 'plain';
    dialog.init();
    assert.equal(dialog.keyDown({ key: 'A' }).prevented, undefined);
    dialog.api.destroy();
});

test('a retained hidden Jellyfin dialog and backdrop do not block the production Plain keyboard path', async () => {
    const h = createHarness({
        prefixes: ['AL', 'ZM'],
        dialogFixtures: [{ state: 'hidden' }]
    });
    enableKeyboard(h, 'plain');

    const event = h.keyDown({ key: 'A' });
    assert.equal(event.prevented, true);
    await turn();
    assert.equal(h.scrollCalls.length, 1);
    h.api.destroy();
});

test('inactive retained dialog surfaces and hidden ancestors allow Plain keyboard jumps', async () => {
    const inactiveStates = [
        { state: 'hidden' },
        { state: 'display-none' },
        { state: 'visibility-hidden' },
        { state: 'open', hiddenAncestor: true },
        { state: 'open', empty: true },
        { state: 'aria-hidden', kind: 'aria' }
    ];
    for (const fixture of inactiveStates) {
        const h = createHarness({ prefixes: ['AL', 'ZM'], dialogFixtures: [fixture] });
        enableKeyboard(h, 'plain');
        assert.equal(h.keyDown({ key: 'A' }).prevented, true, JSON.stringify(fixture));
        await turn();
        assert.equal(h.scrollCalls.length, 1, JSON.stringify(fixture));
        h.api.destroy();
    }
});

test('real Jellyfin dialog, action sheet, ARIA dialog, opening, and closing states block both keyboard modes', () => {
    const activeFixtures = [
        { state: 'open' },
        { state: 'open', kind: 'actionSheet' },
        { state: 'open', kind: 'aria' },
        // Opening has no .opened yet, but dialogHelper already removed .hide.
        { state: 'opening' },
        // Closing has restored .hide while its sibling backdrop remains mounted.
        { state: 'closing' }
    ];
    for (const fixture of activeFixtures) {
        const plain = createHarness({ dialogFixtures: [fixture] });
        enableKeyboard(plain, 'plain');
        assert.equal(plain.keyDown({ key: 'A' }).prevented, undefined, JSON.stringify(fixture));
        plain.api.destroy();

        const prefix = createHarness({ dialogFixtures: [fixture] });
        enableKeyboard(prefix, 'prefix');
        assert.equal(prefix.keyDown({ key: 'J', shiftKey: true }).prevented, undefined, JSON.stringify(fixture));
        assert.equal(prefix.test.getState().keyboard.prefix, null, JSON.stringify(fixture));
        prefix.api.destroy();
    }
});

test('Prefix keyboard arms and jumps through retained inactive dialog nodes, including Shift+#', async () => {
    const h = createHarness({
        prefixes: ['AL', 'ZM'],
        dialogFixtures: [{ state: 'hidden' }, { state: 'open', empty: true }]
    });
    enableKeyboard(h, 'prefix');
    assert.equal(h.keyDown({ key: 'J', shiftKey: true }).prevented, true);
    assert.equal(h.keyDown({ key: 'A' }).prevented, true);
    await turn();
    assert.equal(h.scrollCalls.length, 1);

    h.scrollCalls.length = 0;
    h.root.scrollY = 50;
    assert.equal(h.keyDown({ key: 'J', shiftKey: true }).prevented, true);
    assert.equal(h.keyDown({ key: 'Shift', shiftKey: true }).prevented, undefined);
    assert.ok(h.test.getState().keyboard.prefix);
    assert.equal(h.keyDown({ key: '#', shiftKey: true }).prevented, true);
    await turn();
    assert.equal(h.scrollCalls[0].top, 0);
    h.api.destroy();
});

test('Escape cancels Alpha Jump work without intercepting Escape from an input or dialog', async () => {
    const input = createHarness({ loading: true });
    input.storage.set('active-user-libraryPageSize', '0');
    input.api.config.keyboardJumpMode = 'plain';
    input.init();
    assert.equal(input.keyDown({ key: 'A' }).prevented, true);
    await turn();
    const inputEscape = input.keyDown({ key: 'Escape', target: input.editableTarget('input') });
    assert.equal(inputEscape.prevented, undefined);
    assert.equal(inputEscape.stopped, undefined);
    assert.equal(input.test.getState().run, null);
    input.api.destroy();

    const dialog = createHarness({ loading: true, dialogFixtures: [{ state: 'open' }] });
    dialog.storage.set('active-user-libraryPageSize', '0');
    dialog.init();
    const pending = dialog.test.execute(dialog.test.getContext(), 'A');
    await turn();
    const dialogEscape = dialog.keyDown({ key: 'Escape' });
    assert.equal(dialogEscape.prevented, undefined);
    assert.equal(dialogEscape.stopped, undefined);
    assert.equal(dialog.test.getState().run, null);
    await pending;
    dialog.api.destroy();
});

test('keyboard prefix cancels on loading changes, focus, blur, hidden tabs, destroy, and reinjection', async () => {
    const h = createHarness({ loading: true, renderedCount: 8 });
    h.storage.set('active-user-libraryPageSize', '0');
    h.api.config.keyboardJumpMode = 'prefix';
    h.init();
    h.keyDown({ key: 'J', shiftKey: true });
    assert.equal(h.keyDown({ key: 'A' }).prevented, true);
    h.settings.Filters = { Genres: ['Drama'] };
    h.persist();
    h.test.refreshSurface();
    assert.equal(h.test.getState().keyboard.prefix, null);
    assert.equal(h.test.getState().run, null);

    h.keyDown({ key: 'J', shiftKey: true });
    h.focusEditable(h.editableTarget('textarea'));
    assert.equal(h.test.getState().keyboard.prefix, null);
    h.keyDown({ key: 'J', shiftKey: true });
    h.blur();
    assert.equal(h.test.getState().keyboard.prefix, null);
    h.keyDown({ key: 'J', shiftKey: true });
    h.setVisibility('hidden');
    assert.equal(h.test.getState().keyboard.prefix, null);
    h.setVisibility('visible');
    h.keyDown({ key: 'J', shiftKey: true });
    const replacement = createAlphaJump(h.root);
    replacement.init();
    assert.equal(h.test.getState().keyboard.prefix, null);
    replacement.api.destroy();
});

test('Shows route uses series settings and Series cards and jumps without native filtering', async () => {
    const h = createHarness({ library: 'series' });
    const context = h.test.getContext();
    assert.equal(context.route.pageId, 'tvshowsPage');
    assert.equal(context.route.kind, 'series');
    h.test.attachSurface(context);
    const event = h.clickPicker('A');
    await turn();
    assert.equal(event.prevented, true);
    assert.equal(h.scrollCalls.length, 1);
    assert.equal(h.settings.Alphabet, null);
    assert.equal(h.buttons.find(button => button.value === 'A').getAttribute('aria-pressed'), 'false');
    assertNoPersistentAlphaJumpMarker(h);
    h.api.destroy();
});
test('Shows unsupported tabs, saved landing tabs, and standalone opt-outs remain native', () => {
    const h = createHarness({ library: 'series' });
    h.root.location.hash += '&tab=5';
    assert.equal(h.test.getContext(), null);
    h.root.location.hash = h.root.location.hash.replace('&tab=5','');
    h.storage.set('active-user-landing-library','episodes');
    assert.equal(h.test.getContext(), null);
    h.root.location.hash += '&tab=0';
    assert.ok(h.test.getContext());
    h.api.config.showsEnabled = false;
    assert.equal(h.test.getContext(), null);
    h.api.config.showsEnabled = true;
    h.api.config.moviesOnly = true;
    assert.equal(h.test.getContext(), null);
});

test('standalone Movies-only mode keeps the original Movies main grid and leaves expanded views native', () => {
    const movies = createHarness({ library: 'movies' });
    const collections = createHarness({ library: 'movieCollections' });
    const books = createHarness({ library: 'books' });

    movies.api.config.moviesOnly = true;
    collections.api.config.moviesOnly = true;
    books.api.config.moviesOnly = true;

    assert.ok(movies.test.getContext());
    assert.equal(collections.test.getContext(), null);
    assert.equal(books.test.getContext(), null);
});

for (const [library, expected] of Object.entries(TEST_VIEWS).filter(([name]) => name !== 'livetv')) {
    test(library + ': source-backed grid route accepts its exact card contract and clears native alphabet', async () => {
        const h = createHarness({ library, prefixes: ['MA', 'ZA'] });
        // Prove the alphabet-clear query first. A real native alphabet subset
        // is intentionally not trusted until this query has that proof.
        h.test.refreshSurface();
        h.activateNative('M');
        const context = h.test.getContext();
        assert.ok(context);
        assert.equal(context.route.pageId, expected.pageId);
        assert.equal(context.route.kind, expected.settingsKey);
        assert.deepEqual(context.route.itemTypes, expected.itemTypes);
        assert.equal(context.cardsMatchRouteContract, true);
        h.test.attachSurface(context);
        const event = h.clickPicker('M');
        assert.equal(event.prevented, true);
        await turn();
        assert.equal(h.settings.Alphabet, null);
        assert.equal(h.scrollCalls.length, 1);
        assertNoPersistentAlphaJumpMarker(h);
        h.api.destroy();
    });
}

test('mixed grids do not arm when one rendered card is unsupported or lacks a usable prefix', () => {
    const wrongType = createHarness({ library: 'booksFolders', cardTypes: ['Folder', 'Movie'] });
    const missingPrefix = createHarness({ library: 'homevideos', missingPrefixAt: 1 });

    assert.equal(wrongType.test.isReady(wrongType.test.getContext()), false);
    assert.equal(missingPrefix.test.isReady(missingPrefix.test.getContext()), false);
});

test('Live TV, song lists, suggestions, and collection details remain native', () => {
    const liveTv = createHarness({ library: 'livetv' });
    const songs = createHarness({ library: 'music' });
    const suggestions = createHarness({ library: 'books' });
    const details = createHarness({ library: 'movies' });
    songs.root.location.hash += '&tab=5';
    suggestions.root.location.hash = suggestions.root.location.hash.replace('&tab=1', '&tab=3');
    details.root.location.hash = '#/details?id=0123456789abcdef0123456789abcdef';

    assert.equal(liveTv.test.getContext(), null);
    assert.equal(songs.test.getContext(), null);
    assert.equal(suggestions.test.getContext(), null);
    assert.equal(details.test.getContext(), null);
});

test('built-in Collections uses the distinct server configuration scope without a fabricated library id', async () => {
    const configuration = {
        contractVersion: 3,
        scope: 'collections',
        libraryId: null,
        enabled: true,
        libraryEnabled: true,
        autoDisablePagination: false,
        smoothScroll: false,
        debug: false
    };
    const h = createHarness({ library: 'boxsets', pluginConfiguration: configuration });
    h.init();
    await turn();
    assert.equal(h.pickerRoot.listeners.has('click'), true);
    assert.equal(h.ajaxRequests[0].url, '/AlphaJump/client-config?scope=collections');
    h.api.destroy();
});

for (const [library] of Object.entries(TEST_VIEWS).filter(([name]) => name !== 'livetv')) {
    test(library + ': absent view settings use the source-backed first-click defaults without writing storage', async () => {
        const h = createHarness({ library, prefixes: ['KA', 'MA'] });
        h.storage.delete(h.settingsKey);
        h.storage.set('active-user-libraryPageSize', '0');
        h.init();
        assert.equal(h.clickPicker('K').prevented, true);
        await turn();
        assert.equal(h.settings.Alphabet, null);
        assert.equal(h.storage.has(h.settingsKey), false);
        assert.equal(h.scrollCalls.length, 1);
        assertNoPersistentAlphaJumpMarker(h);
        h.api.destroy();
    });
}

for (const library of ['movies', 'series']) {
    test(library + ': first navigation arms after external toolbar count settles', async () => {
        const h = createHarness({ library });
        h.chip.textContent = ''; // Cards mounted before the external count chip settles.
        h.storage.set('active-user-libraryPageSize', '0');
        h.init();
        assert.equal(h.pickerRoot.listeners.has('click'), true);
        h.setLoading(false);
        await turn();
        assert.equal(h.pickerRoot.listeners.has('click'), true);
        assert.equal(h.clickPicker('A').prevented, true);
        await turn();
        assert.equal(h.settings.Alphabet, null);
        h.api.destroy();
    });
}


test('first-click recovery intercepts a ready picker even without a mount notification', async () => {
    const h = createHarness();
    h.storage.set('active-user-libraryPageSize', '0');
    h.chip.textContent = '';
    h.init();
    h.chip.textContent = '101';
    h.test.detachSurface(true); // Simulate a missed attachment before the fallback click.
    const event = { target: h.buttons.find(b => b.value === 'A'), preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
    h.documentListeners.get('click')(event);
    assert.equal(event.prevented, true);
    await turn();
    assert.equal(h.scrollCalls.length, 1);
    assert.equal(h.settings.Alphabet, null);
    assertNoPersistentAlphaJumpMarker(h);
    h.api.destroy();
    assert.equal(h.documentListeners.has('click'), false);
});

for (const library of ['movies', 'series']) {
    test(library + ': first click while count is pending is owned and waits for complete results', async () => {
        const h = createHarness({ library, loading: true, renderedCount: 8, prefixes: ['KA', 'MA'] });
        h.storage.set('active-user-libraryPageSize', '0');
        h.init();
        const event = h.clickPicker('K');
        assert.equal(event.prevented, true);
        await turn();
        assert.equal(h.scrollCalls.length, 0);
        assert.equal(h.settings.Alphabet, null);
        h.setLoading(false);
        await turn();
        assert.equal(h.scrollCalls.length, 1);
        assertNoPersistentAlphaJumpMarker(h);
        h.api.destroy();
    });
}
test('zero preference can own clicks but cannot declare partial cards ready', () => {
    const h = createHarness({ renderedCount: 101, cardCount: 100 });
    h.storage.set('active-user-libraryPageSize','0');
    assert.equal(h.test.isReady(h.test.getContext()),false);
});

test('plugin mode validates a route-specific config before enabling automatic pagination setup', async () => {
    const routeLibraryId = '0123456789abcdef0123456789abcdef';
    const configuration = {
        contractVersion: 3,
        scope: 'library',
        libraryId: '01234567-89ab-cdef-0123-456789abcdef',
        enabled: true,
        libraryEnabled: true,
        autoDisablePagination: false,
        smoothScroll: false,
        debug: false
    };
    const h = createHarness({ pluginConfiguration: configuration, routeLibraryId });
    h.init();
    await turn();
    assert.equal(h.storage.has('active-user-libraryPageSize'), false);
    assert.equal(h.pickerRoot.listeners.has('click'), true);
    assert.equal(h.api.config.smoothScroll, false);
    h.api.destroy();
});

test('plugin config load failure does not fall back to standalone defaults or intercept clicks', async () => {
    const routeLibraryId = '0123456789abcdef0123456789abcdef';
    const configuration = {
        contractVersion: 3,
        scope: 'library',
        libraryId: '01234567-89ab-cdef-0123-456789abcdef',
        enabled: true,
        libraryEnabled: true,
        autoDisablePagination: true,
        smoothScroll: true,
        debug: false
    };
    const h = createHarness({ pluginConfiguration: configuration, routeLibraryId, pluginConfigurationFailure: true });
    h.init();
    await turn();
    assert.equal(h.storage.has('active-user-libraryPageSize'), false);
    assert.equal(h.pickerRoot.listeners.has('click'), false);
    h.api.destroy();
});

test('plugin mode retries a temporarily unavailable ApiClient and arms when it appears', async () => {
    const routeLibraryId = '0123456789abcdef0123456789abcdef';
    const configuration = {
        contractVersion: 3,
        scope: 'library',
        libraryId: '01234567-89ab-cdef-0123-456789abcdef',
        enabled: true,
        libraryEnabled: true,
        autoDisablePagination: false,
        smoothScroll: false,
        debug: false
    };
    const h = createHarness({ pluginConfiguration: configuration, routeLibraryId, apiAvailable: false });
    h.api.config.pluginApiRetryDelayMs = 1;
    h.init();
    await turn();
    assert.equal(h.pickerRoot.listeners.has('click'), false);
    h.setApiAvailable(true);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(h.pickerRoot.listeners.has('click'), true);
    h.api.destroy();
});

test('plugin config rejects a different normalized library ID', async () => {
    const configuration = {
        contractVersion: 3,
        scope: 'library',
        libraryId: 'fedcba98-7654-3210-fedc-ba9876543210',
        enabled: true,
        libraryEnabled: true,
        autoDisablePagination: false,
        smoothScroll: false,
        debug: false
    };
    const h = createHarness({ pluginConfiguration: configuration, routeLibraryId: '0123456789abcdef0123456789abcdef' });
    h.init();
    await turn();
    assert.equal(h.pickerRoot.listeners.has('click'), false);
    h.api.destroy();
});

test('plugin runtime recovery ignores unchanged code and reloads a safe changed fingerprint once', async () => {
    const routeLibraryId = '0123456789abcdef0123456789abcdef';
    const configuration = { contractVersion: 3, scope: 'library', libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
    const runtime = { initial: { runtimeId: 'old', fingerprint: 'a'.repeat(64) }, response: { runtimeId: 'new', scriptFingerprint: 'a'.repeat(64), pluginVersion: '0.2.1.0' } };
    const h = createHarness({ pluginConfiguration: configuration, routeLibraryId, runtime, playbackExposed: true });
    h.init(); await turn();
    h.test.checkForPluginUpdate(true); await turn();
    assert.equal(h.reloads, 0);
    runtime.response = { runtimeId: 'newer', scriptFingerprint: 'b'.repeat(64), pluginVersion: '0.2.1.0' };
    h.test.checkForPluginUpdate(true); await turn();
    assert.equal(h.reloads, 1);
    const reinjected = createAlphaJump(h.root); reinjected.init(); await turn();
    reinjected.test.checkForPluginUpdate(true); await turn();
    assert.equal(h.reloads, 1);
    reinjected.api.destroy();
});

test('a runtime response resolving after destroy or reinjection cannot show an update notice or reload', async () => {
    const routeLibraryId = '0123456789abcdef0123456789abcdef';
    const configuration = { contractVersion: 3, scope: 'library', libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
    let resolveOld;
    const runtime = {
        initial: { runtimeId: 'old', fingerprint: 'a'.repeat(64) },
        response: new Promise(resolve => { resolveOld = resolve; })
    };
    const h = createHarness({ pluginConfiguration: configuration, routeLibraryId, runtime, playbackExposed: true });
    h.init(); await turn();
    h.test.checkForPluginUpdate(true);
    assert.equal(h.runtimeCalls, 1);
    const replacement = createAlphaJump(h.root);
    replacement.init();
    resolveOld({ runtimeId: 'new', scriptFingerprint: 'b'.repeat(64), pluginVersion: '0.2.1.0' });
    await turn(); await turn();
    assert.equal(h.reloads, 0);
    assert.equal(h.test.getState().plugin.update.notice, null);
    replacement.api.destroy();
});

test('an unabortable runtime timeout remains outstanding instead of overlapping a second request', async () => {
    const routeLibraryId = '0123456789abcdef0123456789abcdef';
    const configuration = { contractVersion: 3, scope: 'library', libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
    let resolveResponse;
    const runtime = { initial: { runtimeId: 'old', fingerprint: 'a'.repeat(64) }, response: new Promise(resolve => { resolveResponse = resolve; }) };
    const h = createHarness({ pluginConfiguration: configuration, routeLibraryId, runtime });
    h.api.config.updateRequestTimeoutMs = 1;
    h.init(); await turn();
    h.test.checkForPluginUpdate(true); await pause(5);
    h.test.checkForPluginUpdate(true);
    assert.equal(h.runtimeCalls, 1);
    resolveResponse({ runtimeId: 'old', scriptFingerprint: 'a'.repeat(64), pluginVersion: '0.2.1.0' });
    await turn();
    h.api.destroy();
});

for (const [label, fingerprint, expectedReloads] of [
    ['unchanged script', 'a'.repeat(64), 0],
    ['changed script', 'b'.repeat(64), 1]
]) {
    test('restart recovery continues past an old runtime response and applies a ' + label, async () => {
        const routeLibraryId = '0123456789abcdef0123456789abcdef';
        const configuration = { contractVersion: 3, scope: 'library', libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
        const runtime = {
            initial: { runtimeId: 'old', fingerprint: 'a'.repeat(64) },
            responses: [
                { runtimeId: 'old', scriptFingerprint: 'a'.repeat(64), pluginVersion: '0.2.1.0' },
                () => Promise.reject(new Error('server unavailable')),
                { runtimeId: 'new', scriptFingerprint: fingerprint, pluginVersion: '0.2.1.0' }
            ]
        };
        const h = createHarness({ pluginConfiguration: configuration, routeLibraryId, runtime, playbackExposed: true });
        h.api.config.updateRetryDelaysMs = [1, 1, 1];
        h.init(); await turn();
        assert.equal(h.activeSubscriptions, 1);
        h.emitRestart(); h.emitRestart();
        await pause(20);
        assert.equal(h.runtimeCalls, 3);
        assert.equal(h.reloads, expectedReloads);
        assert.equal(h.test.getState().plugin.update.restartUntil, 0);
        h.api.destroy();
    });
}

test('delayed and replaced ApiClient instances subscribe once and clean up restart recovery', async () => {
    const routeLibraryId = '0123456789abcdef0123456789abcdef';
    const configuration = { contractVersion: 3, scope: 'library', libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
    const runtime = { initial: { runtimeId: 'old', fingerprint: 'a'.repeat(64) }, response: { runtimeId: 'old', scriptFingerprint: 'a'.repeat(64), pluginVersion: '0.2.1.0' } };
    const h = createHarness({ pluginConfiguration: configuration, routeLibraryId, runtime, apiAvailable: false });
    h.init(); await turn();
    assert.equal(h.activeSubscriptions, 0);
    h.setApiAvailable(true);
    h.test.refreshSurface(); await turn();
    assert.equal(h.activeSubscriptions, 1);
    h.emitRestart();
    assert.ok(h.test.getState().plugin.update.restartUntil > Date.now());
    h.replaceApiClient();
    h.test.refreshSurface();
    assert.equal(h.activeSubscriptions, 1);
    h.api.destroy();
    assert.equal(h.activeSubscriptions, 0);
});

for (const library of ['movies', 'series']) {
    test(library + ': absent view settings use native defaults on the very first click without writing storage', async () => {
        const h = createHarness({ library, prefixes: ['KA', 'MA'] });
        h.storage.delete(h.settingsKey);
        h.storage.set('active-user-libraryPageSize', '0');
        h.init();
        assert.equal(h.clickPicker('K').prevented, true);
        await turn();
        assert.equal(h.settings.Alphabet, null);
        assert.equal(h.storage.has(h.settingsKey), false);
        assert.equal(h.scrollCalls.length, 1);
        assertNoPersistentAlphaJumpMarker(h);
        h.api.destroy();
    });
}
