import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorSelect, eraseBrush, eraseMask, floodErase, floodSelect, rectSelect } from '../lib/image-edit.ts';

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

test('flood select marks contiguous white border but not an enclosed color block', () => {
    const w = 5;
    const h = 5;
    const rgba = solid(w, h, 255, 255, 255);
    for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
            setPixel(rgba, w, x, y, 80, 180, 160);
        }
    }
    const mask = new Uint8Array(w * h);
    const count = floodSelect(rgba, w, h, 0, 0, 10, mask);
    assert.ok(count >= 8);
    assert.equal(mask[0], 1);
    assert.equal(mask[2 * w + 2], 0);
    assert.equal(alpha(rgba, w, 0, 0), 255);
});

test('flood select add unions regions; subtract removes them', () => {
    const w = 5;
    const h = 1;
    const rgba = solid(w, h, 255, 255, 255);
    setPixel(rgba, w, 2, 0, 80, 180, 160);
    setPixel(rgba, w, 3, 0, 80, 180, 160);
    setPixel(rgba, w, 4, 0, 80, 180, 160);
    const mask = new Uint8Array(w);
    const scratch = new Uint8Array(w);

    floodSelect(rgba, w, h, 0, 0, 0, mask, 'replace', scratch);
    assert.equal(mask[0], 1);
    assert.equal(mask[1], 1);
    assert.equal(mask[2], 0);

    floodSelect(rgba, w, h, 4, 0, 0, mask, 'add', scratch);
    assert.equal(mask[0], 1);
    assert.equal(mask[4], 1);
    assert.equal(mask[2], 1);

    floodSelect(rgba, w, h, 0, 0, 0, mask, 'subtract', scratch);
    assert.equal(mask[0], 0);
    assert.equal(mask[1], 0);
    assert.equal(mask[2], 1);
    assert.equal(mask[4], 1);
});

test('erase mask clears selected pixels', () => {
    const w = 3;
    const h = 1;
    const rgba = solid(w, h, 255, 255, 255);
    const mask = new Uint8Array([1, 1, 0]);
    eraseMask(rgba, w, h, mask);
    assert.equal(alpha(rgba, w, 0, 0), 0);
    assert.equal(alpha(rgba, w, 1, 0), 0);
    assert.equal(alpha(rgba, w, 2, 0), 255);
});

test('flood erase clears contiguous white border but not an enclosed color block', () => {
    const w = 5;
    const h = 5;
    const rgba = solid(w, h, 255, 255, 255);
    for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
            setPixel(rgba, w, x, y, 80, 180, 160);
        }
    }

    const erased = floodErase(rgba, w, h, 0, 0, 10);
    assert.ok(erased >= 8);
    assert.equal(alpha(rgba, w, 0, 0), 0);
    assert.equal(alpha(rgba, w, 4, 4), 0);
    assert.equal(alpha(rgba, w, 2, 2), 255);
    assert.equal(rgba[(2 * w + 2) * 4], 80);
});

test('flood erase respects fuzziness', () => {
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

test('rect select replace/add/subtract', () => {
    const w = 4;
    const h = 4;
    const mask = new Uint8Array(w * h);
    rectSelect(w, h, 0, 0, 1.9, 1.9, mask, 'replace');
    assert.equal(mask[0], 1);
    assert.equal(mask[1], 1);
    assert.equal(mask[w], 1);
    assert.equal(mask[w + 1], 1);
    assert.equal(mask[2], 0);

    rectSelect(w, h, 2, 2, 3, 3, mask, 'add');
    assert.equal(mask[0], 1);
    assert.equal(mask[2 * w + 2], 1);

    rectSelect(w, h, 0, 0, 1, 1, mask, 'subtract');
    assert.equal(mask[0], 0);
    assert.equal(mask[2 * w + 2], 1);
});

test('color select finds matching pixels everywhere, not just contiguous', () => {
    const w = 5;
    const h = 5;
    const rgba = solid(w, h, 80, 180, 160);
    setPixel(rgba, w, 0, 0, 255, 255, 255);
    setPixel(rgba, w, 4, 4, 255, 255, 255);
    setPixel(rgba, w, 2, 2, 250, 250, 250);
    const mask = new Uint8Array(w * h);
    const count = colorSelect(rgba, w, h, 255, 255, 255, 20, mask);
    assert.equal(count, 3);
    assert.equal(mask[0], 1);
    assert.equal(mask[4 * w + 4], 1);
    assert.equal(mask[2 * w + 2], 1);
    assert.equal(mask[1], 0);
});

test('erase brush punches a hole', () => {
    const w = 9;
    const h = 9;
    const rgba = solid(w, h, 200, 50, 50);
    eraseBrush(rgba, w, h, 4.5, 4.5, 2);
    assert.equal(alpha(rgba, w, 4, 4), 0);
    assert.equal(alpha(rgba, w, 0, 0), 255);
});
