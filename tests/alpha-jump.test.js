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
            toggle: (name, enabled) => enabled ? this.classNames.add(name) : this.classNames.delete(name)
        };
        this.style = {};
        this.isConnected = true;
    }

    querySelectorAll(selector) {
        return this.childrenBySelector.get(selector) || [];
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    matches(selector) {
        return selector.split(',').some(value => this.selectors.has(value.trim()));
    }

    closest() {
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
        child.parentElement = this;
        return child;
    }

    replaceChildren(...children) {
        this.children = children;
    }

    remove() {
        this.isConnected = false;
    }

    getBoundingClientRect() {
        return { top: 100, bottom: 100 };
    }
}

function createHarness({
    alphabet = null,
    loading = false,
    prefixes = ['AL', 'ZM'],
    settingsPatch = {},
    renderedCount = 101,
    cardCount = renderedCount,
    userId = 'active-user',
    library = 'movies',
    routeLibraryId = 'library',
    loggedIn = true,
    apiAvailable = true,
    pluginConfiguration = null,
    pluginConfigurationFailure = false,
    runtime = null,
    playbackExposed = false,
    visibility = 'visible'
} = {}) {
    const shows = library === 'series';
    const pageId = shows ? 'tvshowsPage' : 'moviesPage';
    const cardSelector = `.card[data-prefix][data-type="${shows ? 'Series' : 'Movie'}"]`;
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
    const cards = allPrefixes.slice(0, cardCount).map(prefix => new FakeElement({
        dataset: { prefix },
        selectors: [cardSelector]
    }));
    pickerRoot.childrenBySelector.set('[role="group"].MuiToggleButtonGroup-vertical', [group]);
    group.childrenBySelector.set('button[type="button"][value]', buttons);
    group.contains = node => buttons.includes(node);
    page.childrenBySelector.set('.alphaPicker-fixed-right', [pickerRoot]);
    page.childrenBySelector.set(cardSelector, cards);
    page.childrenBySelector.set('.noItemsMessage.centerMessage', []);

    const documentListeners = new Map();
    const windowListeners = new Map();
    const body = new FakeElement();
    const head = new FakeElement();
    const document = {
        body,
        head,
        visibilityState: visibility,
        querySelectorAll: selector => {
            if (selector === '#' + pageId) return [page];
            if (selector === '.MuiToolbar-root') return [toolbar];
            if (selector === '[role="banner"], .MuiAppBar-root') return [];
            if (selector === '#alpha-jump-plugin-bootstrap') return pluginConfiguration ? [pluginMarker] : [];
            return [];
        },
        querySelector: selector => selector === '.docspinner.mdlSpinnerActive' ? null : null,
        createElement: () => new FakeElement(),
        createTextNode: text => ({ nodeType: 3, textContent: text }),
        addEventListener(type, callback) { documentListeners.set(type, callback); },
        removeEventListener(type, callback) { if (documentListeners.get(type) === callback) documentListeners.delete(type); }
    };
    const storage = new Map([
        [`${library} - library`, JSON.stringify(settings)]
    ]);
    const pluginMarker = pluginConfiguration ? new FakeElement() : null;
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
    const nextRuntimeResponse = () => {
        runtimeCalls += 1;
        const value = runtime?.responses?.length ? runtime.responses.shift() : runtime?.response;
        return typeof value === 'function' ? value() : value;
    };
    const makeApiClient = () => ({
        getCurrentUserId: () => activeUserId,
        isLoggedIn: () => isLoggedIn,
        ajax: options => pluginConfigurationFailure
            ? Promise.reject(new Error('server unavailable'))
            : Promise.resolve(options.url === '/AlphaJump/runtime' ? nextRuntimeResponse() : pluginConfiguration),
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
            hash: shows ? '#/tv?topParentId=' + routeLibraryId + '&collectionType=tvshows' : '#/movies?topParentId=' + routeLibraryId + '&collectionType=movies',
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
        getComputedStyle: () => ({ position: 'static' }),
        scrollY: 0,
        scrollTo: options => scrollCalls.push(options),
        requestAnimationFrame: callback => {
            queueMicrotask(callback);
            return 1;
        },
        cancelAnimationFrame() {},
        setTimeout,
        clearTimeout,
        addEventListener(type, callback) { windowListeners.set(type, callback); },
        removeEventListener(type, callback) { if (windowListeners.get(type) === callback) windowListeners.delete(type); },
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
    const persist = () => storage.set(`${library} - library`, JSON.stringify(settings));
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
        buttons,
        page,
        pickerRoot,
        chip,
        scrollCalls,
        documentListeners,
        setLoading,
        persist,
        notify,
        clickPicker,
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
        get runtimeCalls() { return runtimeCalls; },
        get reloads() { return reloads; }
    };
}

const turn = () => new Promise(resolve => setTimeout(resolve, 0));
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

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
    proven.page.childrenBySelector.set('.card[data-prefix][data-type="Movie"]', proven.test.getContext().cards.slice(0, 2));
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
test('Shows non-main tabs and explicit opt-outs remain native', () => {
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
        contractVersion: 1,
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
        contractVersion: 1,
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
        contractVersion: 1,
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
        contractVersion: 1,
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
    const configuration = { contractVersion: 1, libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
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
    const configuration = { contractVersion: 1, libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
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
    const configuration = { contractVersion: 1, libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
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
        const configuration = { contractVersion: 1, libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
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
    const configuration = { contractVersion: 1, libraryId: '01234567-89ab-cdef-0123-456789abcdef', enabled: true, libraryEnabled: true, autoDisablePagination: false, smoothScroll: false, debug: false };
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
        h.storage.delete(library + ' - library');
        h.storage.set('active-user-libraryPageSize', '0');
        h.init();
        assert.equal(h.clickPicker('K').prevented, true);
        await turn();
        assert.equal(h.settings.Alphabet, null);
        assert.equal(h.storage.has(library + ' - library'), false);
        assert.equal(h.scrollCalls.length, 1);
        assertNoPersistentAlphaJumpMarker(h);
        h.api.destroy();
    });
}
