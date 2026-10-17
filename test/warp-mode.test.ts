import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCornerDragMode } from '../lib/warp-mode.ts';

test('the warp mode decides when no modifier is held', () => {
    assert.equal(resolveCornerDragMode('free', false, false), 'corner');
    assert.equal(resolveCornerDragMode('scale-corner', false, false), 'opposite');
    assert.equal(resolveCornerDragMode('scale-center', false, false), 'center');
});

test('Shift and Alt override the warp mode', () => {
    for (const mode of ['free', 'scale-corner', 'scale-center'] as const) {
        assert.equal(resolveCornerDragMode(mode, false, true), 'opposite');
        assert.equal(resolveCornerDragMode(mode, true, false), 'center');
        assert.equal(resolveCornerDragMode(mode, true, true), 'center');
    }
});
