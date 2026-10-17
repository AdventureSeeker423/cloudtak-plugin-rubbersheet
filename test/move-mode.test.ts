import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ignoreCompatMouse, shouldStartTouchMove } from '../lib/move-mode.ts';

test('a touch moves the sheet only in Move mode while adjusting, with one finger, on the sheet', () => {
    const on = { moveMode: true, adjusting: true, touches: 1, hit: true };
    assert.equal(shouldStartTouchMove(on), true);
    assert.equal(shouldStartTouchMove({ ...on, moveMode: false }), false);
    assert.equal(shouldStartTouchMove({ ...on, adjusting: false }), false);
    assert.equal(shouldStartTouchMove({ ...on, touches: 2 }), false);
    assert.equal(shouldStartTouchMove({ ...on, touches: 0 }), false);
    assert.equal(shouldStartTouchMove({ ...on, hit: false }), false);
});

test('compatibility mouse events are ignored for a short time after a touch', () => {
    assert.equal(ignoreCompatMouse(1000, 900), true);
    assert.equal(ignoreCompatMouse(1000, 301), true);
    assert.equal(ignoreCompatMouse(1000, 300), false);
    assert.equal(ignoreCompatMouse(1000, 0), false);
    assert.equal(ignoreCompatMouse(1000, 900, 50), false);
});

test('without a previous touch the mouse is never ignored', () => {
    assert.equal(ignoreCompatMouse(0, -Infinity), false);
    assert.equal(ignoreCompatMouse(5, -Infinity), false);
});
