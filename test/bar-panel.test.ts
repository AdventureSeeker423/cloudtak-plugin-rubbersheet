import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBarPanel } from '../lib/bar-panel.ts';
import { PANEL_CLOSE, PANEL_OPEN } from '../lib/panel-coordinator.ts';
import type { PanelEventDetail } from '../lib/panel-coordinator.ts';

const KEY = 'rubber-sheet-opacity';

function setup(hasSheet = true) {
    const target = new EventTarget();
    const calls: string[] = [];
    /** Panel events sent by the rubber sheet, not the ones the tests inject. */
    const events: string[] = [];
    const ui = { hasSheet, moveMode: false, barHidden: false };
    const bottomBar = {
        add: (item: { key: string }) => { calls.push(`add:${item.key}`); },
        remove: (key: string) => { calls.push(`remove:${key}`); },
    };
    const take = (kind: string) => (e: Event): void => {
        const d = (e as CustomEvent<PanelEventDetail>).detail;
        if (d.id !== 'rubber-sheet') return;
        events.push(`${kind}:${d.id}${d.by ? `>${d.by}` : ''}`);
    };
    target.addEventListener(PANEL_OPEN, take('open'));
    target.addEventListener(PANEL_CLOSE, take('close'));
    let drags = 0;
    const panel = createBarPanel({
        id: 'rubber-sheet',
        key: KEY,
        component: {},
        bottomBar,
        ui,
        cancelDrag: () => { drags++; },
        target,
    });
    const foreignOpen = (id = 'weather'): void => {
        target.dispatchEvent(new CustomEvent(PANEL_OPEN, { detail: { id, area: 'bottom' } }));
    };
    const foreignClose = (id = 'weather'): void => {
        target.dispatchEvent(new CustomEvent(PANEL_CLOSE, { detail: { id, area: 'bottom' } }));
    };
    return { panel, ui, calls, events, foreignOpen, foreignClose, drags: () => drags };
}

test('showBar adds the bar once and announces panel-open once', () => {
    const s = setup();
    s.panel.showBar();
    s.panel.showBar();
    assert.deepEqual(s.calls, [`add:${KEY}`]);
    assert.deepEqual(s.events, ['open:rubber-sheet']);
    assert.equal(s.panel.shown, true);
});

test('ensureBar adds the bar without announcing', () => {
    const s = setup();
    s.panel.ensureBar();
    assert.deepEqual(s.calls, [`add:${KEY}`]);
    assert.deepEqual(s.events, []);
});

test('a foreign panel-open minimizes the bar: it is removed, the flag is raised, Move is off and a drag is cancelled', () => {
    const s = setup();
    s.panel.showBar();
    s.ui.moveMode = true;
    s.foreignOpen();
    assert.deepEqual(s.calls, [`add:${KEY}`, `remove:${KEY}`]);
    assert.equal(s.panel.shown, false);
    assert.equal(s.panel.minimized, true);
    assert.equal(s.ui.barHidden, true);
    assert.equal(s.ui.moveMode, false);
    assert.equal(s.drags(), 1);
    assert.equal(s.ui.hasSheet, true, 'the sheet state stays');
});

test('a silent re-add (style reload) does not bring back a minimized bar', () => {
    const s = setup();
    s.panel.showBar();
    s.foreignOpen();
    s.panel.ensureBar();
    s.panel.showBar();
    assert.deepEqual(s.calls, [`add:${KEY}`, `remove:${KEY}`]);
    assert.equal(s.panel.shown, false);
    assert.equal(s.ui.barHidden, true);
});

test('closing the opener restores the bar without announcing panel-open', () => {
    const s = setup();
    s.panel.showBar();
    s.foreignOpen();
    s.foreignClose();
    assert.deepEqual(s.calls, [`add:${KEY}`, `remove:${KEY}`, `add:${KEY}`]);
    assert.equal(s.panel.shown, true);
    assert.equal(s.ui.barHidden, false);
    assert.deepEqual(s.events, ['open:rubber-sheet']);
});

test('restoreFromSelector brings the bar back and announces panel-open', () => {
    const s = setup();
    s.panel.showBar();
    s.foreignOpen();
    s.panel.restoreFromSelector();
    assert.equal(s.panel.shown, true);
    assert.equal(s.ui.barHidden, false);
    assert.deepEqual(s.events, ['open:rubber-sheet', 'open:rubber-sheet']);
    s.foreignClose();
    assert.deepEqual(s.calls, [`add:${KEY}`, `remove:${KEY}`, `add:${KEY}`], 'it no longer waits for the opener');
});

test('restoreFromSelector does nothing while the bar is shown', () => {
    const s = setup();
    s.panel.showBar();
    s.panel.restoreFromSelector();
    assert.deepEqual(s.calls, [`add:${KEY}`]);
    assert.deepEqual(s.events, ['open:rubber-sheet']);
});

test('without a sheet the bar closes instead of minimizing and announces panel-close with by', () => {
    const s = setup(false);
    s.panel.showBar();
    s.foreignOpen();
    assert.deepEqual(s.calls, [`add:${KEY}`, `remove:${KEY}`]);
    assert.equal(s.panel.minimized, false);
    assert.equal(s.ui.barHidden, false);
    assert.deepEqual(s.events, ['open:rubber-sheet', 'close:rubber-sheet>weather']);
    s.foreignClose();
    assert.deepEqual(s.calls, [`add:${KEY}`, `remove:${KEY}`], 'a plugin that closed never reopens by itself');
});

test('clear while shown announces panel-close without by and removes the bar', () => {
    const s = setup();
    s.panel.showBar();
    s.panel.clear();
    assert.deepEqual(s.events, ['open:rubber-sheet', 'close:rubber-sheet']);
    assert.deepEqual(s.calls, [`add:${KEY}`, `remove:${KEY}`]);
});

test('clear while minimized announces panel-close with by = the opener and clears the dot', () => {
    const s = setup();
    s.panel.showBar();
    s.foreignOpen();
    s.panel.clear();
    assert.deepEqual(s.events, ['open:rubber-sheet', 'close:rubber-sheet>weather']);
    assert.equal(s.panel.minimized, false);
    assert.equal(s.ui.barHidden, false);
    s.foreignClose();
    assert.deepEqual(s.calls, [`add:${KEY}`, `remove:${KEY}`], 'a removed sheet is not brought back');
});

test('clear with no bar announces nothing', () => {
    const s = setup();
    s.panel.clear();
    assert.deepEqual(s.events, []);
    assert.deepEqual(s.calls, []);
});

test('dispose stops reacting to other plugins', () => {
    const s = setup();
    s.panel.showBar();
    s.panel.dispose();
    s.foreignOpen();
    assert.deepEqual(s.calls, [`add:${KEY}`]);
    assert.equal(s.ui.barHidden, false);
});
