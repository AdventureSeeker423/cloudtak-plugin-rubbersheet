import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EDIT_HISTORY_CAP, EditHistory } from '../lib/edit-history.ts';

function buf(fill: number, length = 8): Uint8Array {
    return new Uint8Array(length).fill(fill);
}

test('undo restores the pre-edit snapshot and redo restores the edit', () => {
    const history = new EditHistory();
    const pixels = buf(1);
    history.push(pixels);
    pixels.fill(2);
    assert.equal(history.undo(pixels), true);
    assert.deepEqual(pixels, buf(1));
    assert.equal(history.redo(pixels), true);
    assert.deepEqual(pixels, buf(2));
});

test('a new push after undo clears redo', () => {
    const history = new EditHistory();
    const pixels = buf(1);
    history.push(pixels);
    pixels.fill(2);
    history.undo(pixels);
    history.push(pixels);
    pixels.fill(3);
    assert.equal(history.canRedo, false);
    assert.equal(history.redo(pixels), false);
    assert.deepEqual(pixels, buf(3));
});

test('history cap drops the oldest snapshot', () => {
    const history = new EditHistory();
    const pixels = buf(0);
    for (let i = 0; i < EDIT_HISTORY_CAP + 5; i++) {
        history.push(pixels);
        pixels[0] = i + 1;
    }
    assert.equal(history.undoCount, EDIT_HISTORY_CAP);
});

test('snapshots are deep copies so later mutation does not corrupt history', () => {
    const history = new EditHistory();
    const pixels = buf(9);
    history.push(pixels);
    pixels.fill(0);
    history.undo(pixels);
    assert.deepEqual(pixels, buf(9));
});

test('eraser stroke contract: one push before stroke undoes the whole stroke', () => {
    // Documented contract for ImageEditor: push once at pointerdown, then dab.
    const history = new EditHistory();
    const pixels = buf(255);
    history.push(pixels);
    pixels.fill(0);
    pixels[0] = 0;
    pixels[4] = 0;
    assert.equal(history.undo(pixels), true);
    assert.deepEqual(pixels, buf(255));
});

test('export/import restores undo and redo across sessions', () => {
    const history = new EditHistory();
    const pixels = buf(1);
    history.push(pixels);
    pixels.fill(2);
    history.push(pixels);
    pixels.fill(3);
    history.undo(pixels);
    const snap = history.exportSnapshot();

    const restored = new EditHistory();
    restored.importSnapshot(snap);
    assert.equal(restored.canUndo, true);
    assert.equal(restored.canRedo, true);
    assert.equal(restored.undo(pixels), true);
    assert.deepEqual(pixels, buf(1));
    assert.equal(restored.redo(pixels), true);
    assert.deepEqual(pixels, buf(2));
    assert.equal(restored.redo(pixels), true);
    assert.deepEqual(pixels, buf(3));
});
