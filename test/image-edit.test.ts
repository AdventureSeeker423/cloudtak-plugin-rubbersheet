import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eraseBrush, floodErase } from '../lib/image-edit.ts';

function solid(width: number, height: number, r: number, g: number, b: number, a = 255): Uint8Array {
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const o = i * 4;
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = a;
    }
    return rgba;
}

function setPixel(rgba: Uint8Array, width: number, x: number, y: number, r: number, g: number, b: number, a = 255): void {
    const o = (y * width + x) * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = a;
}

function alpha(rgba: Uint8Array, width: number, x: number, y: number): number {
    return rgba[(y * width + x) * 4 + 3];
}

test('flood erase clears contiguous white border but not an enclosed color block', () => {
    const w = 5;
    const h = 5;
    const rgba = solid(w, h, 255, 255, 255);
    // Center 3x3 teal block
    for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
            setPixel(rgba, w, x, y, 80, 180, 160);
        }
    }

    const erased = floodErase(rgba, w, h, 0, 0, 10);
    assert.ok(erased >= 8);
    assert.equal(alpha(rgba, w, 0, 0), 0);
    assert.equal(alpha(rgba, w, 4, 4), 0);
    // Interior teal remains
    assert.equal(alpha(rgba, w, 2, 2), 255);
    assert.equal(rgba[(2 * w + 2) * 4], 80);
});

test('flood erase respects tolerance', () => {
    const w = 3;
    const h = 1;
    const rgba = solid(w, h, 255, 255, 255);
    setPixel(rgba, w, 1, 0, 240, 240, 240);
    setPixel(rgba, w, 2, 0, 100, 100, 100);

    floodErase(rgba, w, h, 0, 0, 30);
    assert.equal(alpha(rgba, w, 0, 0), 0);
    assert.equal(alpha(rgba, w, 1, 0), 0);
    assert.equal(alpha(rgba, w, 2, 0), 255);
});

test('erase brush punches a hole', () => {
    const w = 9;
    const h = 9;
    const rgba = solid(w, h, 200, 50, 50);
    eraseBrush(rgba, w, h, 4.5, 4.5, 2);
    assert.equal(alpha(rgba, w, 4, 4), 0);
    assert.equal(alpha(rgba, w, 0, 0), 255);
});
