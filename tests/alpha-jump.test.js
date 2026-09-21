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

function createHarness({ alphabet = null, loading = false, prefixes = ['AL', 'ZM'], pageSize = '0', settingsPatch = {}, renderedCount = 101 } = {}) {
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
    const page = new FakeElement({ selectors: ['#moviesPage'] });
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
    const cards = allPrefixes.map(prefix => new FakeElement({
        dataset: { prefix },
        selectors: ['.card[data-prefix][data-type="Movie"]']
    }));
    pickerRoot.childrenBySelector.set('[role="group"].MuiToggleButtonGroup-vertical', [group]);
    group.childrenBySelector.set('button[type="button"][value]', buttons);
    group.contains = node => buttons.includes(node);
    page.childrenBySelector.set('.alphaPicker-fixed-right', [pickerRoot]);
    page.childrenBySelector.set('.card[data-prefix][data-type="Movie"]', cards);
    page.childrenBySelector.set('.noItemsMessage.centerMessage', []);

    const body = new FakeElement();
    const head = new FakeElement();
    const document = {
        body,
        head,
        querySelectorAll: selector => {
            if (selector === '#moviesPage') return [page];
            if (selector === '.MuiToolbar-root') return [toolbar];
            if (selector === '[role="banner"], .MuiAppBar-root') return [];
            return [];
        },
        querySelector: selector => selector === '.docspinner.mdlSpinnerActive' ? null : null,
        createElement: () => new FakeElement(),
        createTextNode: text => ({ nodeType: 3, textContent: text }),
        addEventListener() {},
        removeEventListener() {}
    };
    const storage = new Map([
        ['movies - library', JSON.stringify(settings)],
        ['libraryPageSize', pageSize]
    ]);
    const root = {
        document,
        location: { hash: '#/movies?topParentId=library&collectionType=movies' },
        localStorage: { getItem: key => storage.get(key) || null },
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
        addEventListener() {},
        removeEventListener() {},
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
    const persist = () => storage.set('movies - library', JSON.stringify(settings));
    const setLoading = value => {
        chip.textContent = value ? '∙' : String(allPrefixes.length);
        notify(chip);
    };
    const clearNative = () => {
        settings.Alphabet = null;
        buttons.find(button => button.value === alphabet)?.setAttribute('aria-pressed', 'false');
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
            if (button.value === alphabet) clearNative();
        };
    });
    const instance = createAlphaJump(root);
    return { ...instance, settings, buttons, page, pickerRoot, chip, scrollCalls, setLoading, persist, notify, clickPicker };
}

const turn = () => new Promise(resolve => setTimeout(resolve, 0));

test('production context requires complete rendered results and explicit StartIndex zero', () => {
    const paged = createHarness({ pageSize: '100' });
    assert.equal(paged.test.getContext().pageSize, 100);
    assert.equal(paged.test.hasCompleteUnpaginatedResult(paged.test.getContext()), true);
    const incomplete = createHarness({ renderedCount: 100 });
    assert.equal(incomplete.test.hasCompleteUnpaginatedResult(incomplete.test.getContext()), false);
    const offset = createHarness({ settingsPatch: { StartIndex: 100 } });
    const context = offset.test.getContext();
    assert.equal(offset.test.hasInitialIndex(context.settings), false);
});

test('# goes through the production native-clear and readiness path before scrolling top', async () => {
    const harness = createHarness({ alphabet: 'M', prefixes: ['MM', 'MN'] });
    harness.test.attachSurface(harness.test.getContext());
    const event = harness.clickPicker('#');
    await turn();
    assert.equal(event.prevented, true);
    assert.equal(harness.settings.Alphabet, null);
    assert.equal(harness.buttons.find(button => button.value === 'M').getAttribute('aria-pressed'), 'false');
    assert.equal(harness.scrollCalls.at(-1).top, 0);
    assert.equal(harness.test.getState().run, null);
});

test('production waiter remains pending for the toolbar bullet and resolves from its observed removal', async () => {
    const harness = createHarness({ loading: true, prefixes: ['AL'] });
    const pending = harness.test.execute(harness.test.getContext(), 'A');
    await turn();
    assert.notEqual(harness.test.getState().run, null);
    harness.setLoading(false);
    await pending;
    assert.equal(harness.test.getState().selected, 'A');
});

test('a real second execute cancels the first waiter and only the latest request selects', async () => {
    const harness = createHarness({ loading: true, prefixes: ['AL', 'ZM'] });
    const first = harness.test.execute(harness.test.getContext(), 'A');
    await turn();
    const latest = harness.test.execute(harness.test.getContext(), 'Z');
    harness.setLoading(false);
    await Promise.all([first, latest]);
    assert.equal(harness.test.getState().selected, 'Z');
});

test('a production waiter cancels when the persisted query identity changes', async () => {
    const harness = createHarness({ loading: true, prefixes: ['AL'] });
    const pending = harness.test.execute(harness.test.getContext(), 'A');
    await turn();
    harness.settings.Filters = { Genres: ['Drama'] };
    harness.persist();
    harness.notify(harness.chip);
    await pending;
    assert.equal(harness.test.getState().selected, null);
    assert.equal(harness.scrollCalls.length, 0);
});

test('production detach removes its listener and only its selection markers', () => {
    const harness = createHarness();
    const context = harness.test.getContext();
    harness.test.attachSurface(context);
    const button = harness.buttons[1];
    button.classList.add('alpha-jump-selected');
    button.setAttribute('data-alpha-jump-selected', 'true');
    button.setAttribute('aria-current', 'true');
    button.setAttribute('aria-pressed', 'false');
    harness.test.detachSurface(true);
    assert.equal(harness.pickerRoot.listeners.has('click'), false);
    assert.equal(button.getAttribute('data-alpha-jump-selected'), null);
    assert.equal(button.getAttribute('aria-current'), null);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
});
