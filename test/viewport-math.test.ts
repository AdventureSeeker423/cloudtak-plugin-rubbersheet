import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitView, isTap, MAX_SCALE, MIN_SCALE, pinchView, zoomAbout } from '../lib/viewport-math.ts';

function near(actual: number, expected: number, eps = 1e-9): void {
    assert.ok(Math.abs(actual - expected) < eps, `${actual} != ${expected}`);
}

test('zoomAbout keeps the image point under the anchor fixed', () => {
    const view = { scale: 1, panX: 30, panY: -20 };
    const next = zoomAbout(view, 1.5, 200, 120);
    near((200 - view.panX) / view.scale, (200 - next.panX) / next.scale);
    near((120 - view.panY) / view.scale, (120 - next.panY) / next.scale);
    near(next.scale, 1.5);
});

test('zoomAbout clamps the scale', () => {
    assert.equal(zoomAbout({ scale: 7, panX: 0, panY: 0 }, 10, 0, 0).scale, MAX_SCALE);
    assert.equal(zoomAbout({ scale: 0.06, panX: 0, panY: 0 }, 0.1, 0, 0).scale, MIN_SCALE);
});

const start = { d0: 100, m0: { x: 150, y: 200 }, scale0: 2, panX0: 40, panY0: 60 };

test('pinchView with an identity gesture returns the starting view', () => {
    const next = pinchView(start, { d: 100, m: { x: 150, y: 200 } });
    near(next.scale, 2);
    near(next.panX, 40);
    near(next.panY, 60);
});

test('pinchView with a pure translation pans by the midpoint delta', () => {
    const next = pinchView(start, { d: 100, m: { x: 180, y: 170 } });
    near(next.scale, 2);
    near(next.panX, 70);
    near(next.panY, 30);
});

test('pinchView zooms by the distance ratio around the midpoint', () => {
    const next = pinchView(start, { d: 150, m: { x: 150, y: 200 } });
    near(next.scale, 3);
    near((150 - start.panX0) / start.scale0, (150 - next.panX) / next.scale);
    near((200 - start.panY0) / start.scale0, (200 - next.panY) / next.scale);
});

test('pinchView clamps the scale and ignores a zero start distance', () => {
    assert.equal(pinchView(start, { d: 10000, m: start.m0 }).scale, MAX_SCALE);
    assert.equal(pinchView(start, { d: 0.001, m: start.m0 }).scale, MIN_SCALE);
    assert.equal(pinchView({ ...start, d0: 0 }, { d: 50, m: start.m0 }).scale, 2);
});

test('isTap needs a small move and a short press', () => {
    const down = { x: 10, y: 10, t: 0 };
    assert.equal(isTap(down, { x: 14, y: 13, t: 200 }), true);
    assert.equal(isTap(down, { x: 30, y: 10, t: 200 }), false);
    assert.equal(isTap(down, { x: 10, y: 10, t: 600 }), false);
});

test('fitView centres the image and never scales above 1', () => {
    const small = fitView(800, 600, 100, 50, 40);
    assert.equal(small.scale, 1);
    near(small.panX, 350);
    near(small.panY, 275);
    const large = fitView(400, 800, 1600, 1000, 12);
    near(large.scale, (400 - 24) / 1600);
    near(large.panX, 12);
    near(large.panY, (800 - 1000 * large.scale) / 2);
});
