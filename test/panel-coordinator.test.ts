import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPanelCoordinator, PANEL_CLOSE, PANEL_OPEN } from '../lib/panel-coordinator.ts';
import type { PanelCoordinator, PanelEventDetail } from '../lib/panel-coordinator.ts';

interface Fake {
    id: string;
    calls: string[];
    coordinator: PanelCoordinator;
    shown: boolean;
    state: boolean;
    dots: boolean[];
}

/** A plugin built on the helper. It is shown while `shown` is true; minimizing and closing hide it. */
function plugin(target: EventTarget, id: string, state = false): Fake {
    const fake: Fake = { id, calls: [], coordinator: null as unknown as PanelCoordinator, shown: true, state, dots: [] };
    fake.coordinator = createPanelCoordinator({
        id,
        target,
        isShown: () => fake.shown,
        hasState: () => fake.state,
        close: () => { fake.calls.push('close'); fake.shown = false; },
        minimize: () => { fake.calls.push('minimize'); fake.shown = false; },
        restore: () => { fake.calls.push('restore'); fake.shown = true; },
        onMinimizedChange: (v) => { fake.dots.push(v); },
    });
    return fake;
}

/** Records the panel events sent by plugin `from`, in order, as `open:id` or `close:id` or `close:id>by`. */
function record(target: EventTarget, from = 'a'): string[] {
    const log: string[] = [];
    const take = (kind: string) => (e: Event): void => {
        const d = (e as CustomEvent<PanelEventDetail>).detail;
        if (d.id !== from) return;
        log.push(`${kind}:${d.id}${d.by ? `>${d.by}` : ''}`);
    };
    target.addEventListener(PANEL_OPEN, take('open'));
    target.addEventListener(PANEL_CLOSE, take('close'));
    return log;
}

function fire(target: EventTarget, type: string, detail: unknown): void {
    target.dispatchEvent(new CustomEvent(type, { detail }));
}

test('a foreign open while shown with state minimizes once and raises the flag', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    const log = record(t);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize']);
    assert.equal(a.coordinator.minimized, true);
    assert.deepEqual(a.dots, [true]);
    assert.deepEqual(log, []);
});

test('a foreign open while shown without state closes once and announces panel-close with by', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', false);
    const log = record(t);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['close']);
    assert.equal(a.coordinator.minimized, false);
    assert.deepEqual(log, ['close:a>b']);
});

test('a foreign open while not shown does nothing', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    a.shown = false;
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, []);
    assert.equal(a.coordinator.minimized, false);
});

test('its own events are ignored', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'a', area: 'bottom' });
    assert.deepEqual(a.calls, []);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    fire(t, PANEL_CLOSE, { id: 'a', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize']);
    assert.equal(a.coordinator.minimized, true);
});

test('malformed details are ignored', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    for (const detail of [undefined, null, 'b', 7, {}, { id: '' , area: 'bottom' }, { id: 7, area: 'bottom' }, { id: 'b' }, { id: 'b', area: 'top' }]) {
        fire(t, PANEL_OPEN, detail);
    }
    assert.deepEqual(a.calls, []);
    t.dispatchEvent(new Event(PANEL_OPEN));
    assert.deepEqual(a.calls, []);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    for (const detail of [undefined, null, {}, { id: 'b' }, { id: 'b', area: 'top' }]) {
        fire(t, PANEL_CLOSE, detail);
    }
    assert.deepEqual(a.calls, ['minimize']);
    assert.equal(a.coordinator.minimized, true);
});

test('a close from the opener restores without announcing panel-open', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    const log = record(t);
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize', 'restore']);
    assert.equal(a.coordinator.minimized, false);
    assert.deepEqual(a.dots, [true, false]);
    assert.deepEqual(log, []);
});

test('a close from another id is ignored', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    fire(t, PANEL_CLOSE, { id: 'c', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize']);
    assert.equal(a.coordinator.minimized, true);
});

test('a close with by retargets without restoring, and a later close from by restores', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom', by: 'c' });
    assert.deepEqual(a.calls, ['minimize']);
    assert.equal(a.coordinator.minimized, true);
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize'], 'b is no longer the one it waits for');
    fire(t, PANEL_CLOSE, { id: 'c', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize', 'restore']);
    assert.equal(a.coordinator.minimized, false);
});

test('a close whose by names the waiting plugin restores it', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom', by: 'a' });
    assert.deepEqual(a.calls, ['minimize', 'restore']);
});

test('restoreFromSelector restores, announces panel-open once and stops waiting', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    const log = record(t);
    a.coordinator.restoreFromSelector();
    assert.deepEqual(a.calls, ['minimize', 'restore']);
    assert.equal(a.coordinator.minimized, false);
    assert.deepEqual(log, ['open:a']);
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize', 'restore'], 'it no longer waits for b');
});

test('restoreFromSelector does nothing when not minimized', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    const log = record(t);
    a.coordinator.restoreFromSelector();
    assert.deepEqual(a.calls, []);
    assert.deepEqual(log, []);
});

test('closed() announces panel-close without by when shown', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    const log = record(t);
    a.coordinator.closed();
    assert.deepEqual(log, ['close:a']);
});

test('closed() while minimized announces panel-close with by = the plugin it waits for, and clears the flag', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    const log = record(t);
    a.coordinator.closed();
    assert.deepEqual(log, ['close:a>b']);
    assert.equal(a.coordinator.minimized, false);
    assert.deepEqual(a.dots, [true, false]);
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize'], 'a plugin that closed never reopens by itself');
});

test('opened() announces panel-open and clears a pending wait', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    const log = record(t);
    a.coordinator.opened();
    assert.deepEqual(log, ['open:a']);
    assert.equal(a.coordinator.minimized, false);
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize']);
});

test('a second foreign open while minimized does not minimize twice', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    fire(t, PANEL_OPEN, { id: 'c', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize']);
    // Even a plugin that wrongly reports itself shown while minimized does not yield twice.
    a.shown = true;
    fire(t, PANEL_OPEN, { id: 'd', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize']);
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize', 'restore'], 'it still waits for the first opener');
});

test('dispose removes both listeners and clears the flag', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    fire(t, PANEL_OPEN, { id: 'b', area: 'bottom' });
    a.coordinator.dispose();
    assert.equal(a.coordinator.minimized, false);
    assert.deepEqual(a.dots, [true, false]);
    a.shown = true;
    fire(t, PANEL_OPEN, { id: 'c', area: 'bottom' });
    fire(t, PANEL_CLOSE, { id: 'b', area: 'bottom' });
    assert.deepEqual(a.calls, ['minimize']);
});

test('three plugins: each restores in reverse order', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    const b = plugin(t, 'b', true);
    const c = plugin(t, 'c', true);
    a.shown = true;
    b.shown = false;
    c.shown = false;
    // b opens: a yields.
    b.shown = true;
    b.coordinator.opened();
    assert.deepEqual(a.calls, ['minimize']);
    // c opens: b yields, a stays hidden (not shown).
    c.shown = true;
    c.coordinator.opened();
    assert.deepEqual(b.calls, ['minimize']);
    assert.deepEqual(a.calls, ['minimize']);
    // c closes: b restores, a stays hidden.
    c.shown = false;
    c.coordinator.closed();
    assert.deepEqual(b.calls, ['minimize', 'restore']);
    assert.deepEqual(a.calls, ['minimize']);
    // b closes: a restores.
    b.shown = false;
    b.coordinator.closed();
    assert.deepEqual(a.calls, ['minimize', 'restore']);
    assert.equal(a.coordinator.minimized, false);
    assert.equal(b.coordinator.minimized, false);
});

test('middle plugin closes (no state): the first plugin restores only after the last one closes', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    const b = plugin(t, 'b', false);
    const c = plugin(t, 'c', false);
    b.shown = false;
    c.shown = false;
    // b opens: a minimizes for b.
    b.shown = true;
    b.coordinator.opened();
    assert.equal(a.coordinator.minimized, true);
    // c opens: b has no state and closes, announcing panel-close with by = c.
    c.shown = true;
    c.coordinator.opened();
    assert.deepEqual(b.calls, ['close']);
    assert.equal(b.shown, false);
    assert.deepEqual(a.calls, ['minimize'], 'a keeps waiting: it now waits for c');
    assert.equal(a.coordinator.minimized, true);
    // c closes: a restores.
    c.shown = false;
    c.coordinator.closed();
    assert.deepEqual(a.calls, ['minimize', 'restore']);
    assert.equal(a.coordinator.minimized, false);
    assert.equal(b.shown, false, 'b never reopens by itself');
});

test('a minimized plugin that goes away while waiting hands the wait to the one waiting for it', () => {
    const t = new EventTarget();
    const a = plugin(t, 'a', true);
    const b = plugin(t, 'b', true);
    a.shown = true;
    b.shown = false;
    b.shown = true;
    b.coordinator.opened();
    const c = plugin(t, 'c', true);
    c.coordinator.opened();
    assert.equal(b.coordinator.minimized, true);
    assert.equal(a.coordinator.minimized, true);
    // b is removed while minimized for c: a retargets to c.
    b.coordinator.closed();
    assert.deepEqual(a.calls, ['minimize']);
    c.shown = false;
    c.coordinator.closed();
    assert.deepEqual(a.calls, ['minimize', 'restore']);
});
