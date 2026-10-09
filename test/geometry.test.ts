import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyHomography,
    centroid,
    homography,
    opaqueAtPoint,
    oppositeCorner,
    pointInQuad,
    quadForView,
    rotateAroundCenter,
    scaleAboutCenter,
    scaleAboutOpposite,
    type Quad,
} from '../lib/geometry.ts';

const square: Quad = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
];

test('opposite corners stay opposite', () => {
    assert.equal(oppositeCorner(0), 2);
    assert.equal(oppositeCorner(1), 3);
    assert.equal(oppositeCorner(2), 0);
    assert.equal(oppositeCorner(3), 1);
});

test('shift-scale grows the quad about the opposite corner', () => {
    const quad: Quad = [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
    ];
    const scaled = scaleAboutOpposite(quad, 1, [2, 2]);
    assert.deepEqual(scaled[3], [0, 0]);
    assert.ok(Math.abs(scaled[1][0] - 2) < 1e-9);
    assert.ok(Math.abs(scaled[1][1] - 2) < 1e-9);
    assert.ok(Math.abs(scaled[0][0] - 0) < 1e-9);
    assert.ok(Math.abs(scaled[0][1] - 2) < 1e-9);
    assert.ok(Math.abs(scaled[2][0] - 2) < 1e-9);
    assert.ok(Math.abs(scaled[2][1] - 0) < 1e-9);
});

test('alt-scale grows the quad about the centroid', () => {
    const quad: Quad = [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
    ];
    const centerBefore = centroid(quad);
    const scaled = scaleAboutCenter(quad, 1, [1.5, 1.5]);
    const centerAfter = centroid(scaled);
    assert.ok(Math.abs(centerBefore[0] - centerAfter[0]) < 1e-9);
    assert.ok(Math.abs(centerBefore[1] - centerAfter[1]) < 1e-9);
    assert.ok(Math.abs(scaled[1][0] - 1.5) < 1e-9);
    assert.ok(Math.abs(scaled[1][1] - 1.5) < 1e-9);
    assert.ok(Math.abs(scaled[3][0] - -0.5) < 1e-9);
    assert.ok(Math.abs(scaled[3][1] - -0.5) < 1e-9);
});

test('rotation is about the centroid', () => {
    const before = centroid(square);
    const turned = rotateAroundCenter(square, Math.PI / 2);
    const after = centroid(turned);
    assert.ok(Math.abs(before[0] - after[0]) < 1e-9);
    assert.ok(Math.abs(before[1] - after[1]) < 1e-9);
    assert.ok(Math.abs(turned[1][0] - -1) < 1e-6);
    assert.ok(Math.abs(turned[1][1] - 1) < 1e-6);
});

test('homography round-trips the four corners', () => {
    const src: Array<[number, number]> = [[0, 0], [10, 0], [10, 5], [0, 5]];
    const dst: Array<[number, number]> = [[0, 0], [20, 1], [19, 10], [1, 8]];
    const matrix = homography(src, dst);
    for (let index = 0; index < 4; index++) {
        const [x, y] = applyHomography(matrix, src[index][0], src[index][1]);
        assert.ok(Math.abs(x - dst[index][0]) < 1e-6, `x ${x} != ${dst[index][0]}`);
        assert.ok(Math.abs(y - dst[index][1]) < 1e-6, `y ${y} != ${dst[index][1]}`);
    }
});

test('a corner is inside the sheet', () => {
    const quad: Quad = [[0, 1], [1, 1], [1, 0], [0, 0]];
    assert.equal(pointInQuad(quad, 100, 50, [0, 1]), true);
    assert.equal(pointInQuad(quad, 100, 50, [2, 2], 0), false);
});

test('opaque hit test ignores transparent pixels inside the quad', () => {
    const w = 4;
    const h = 4;
    const rgba = new Uint8Array(w * h * 4);
    // Left half opaque white, right half cleared
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (x < 2) {
                rgba[o] = 255;
                rgba[o + 1] = 255;
                rgba[o + 2] = 255;
                rgba[o + 3] = 255;
            }
        }
    }
    const quad: Quad = [[0, 1], [1, 1], [1, 0], [0, 0]];
    assert.equal(opaqueAtPoint(rgba, w, h, quad, [0.25, 0.5]), true);
    assert.equal(opaqueAtPoint(rgba, w, h, quad, [0.75, 0.5]), false);
    assert.equal(opaqueAtPoint(rgba, w, h, quad, [2, 2]), false);
});

test('the starting sheet is north-up and centered', () => {
    const quad = quadForView(0, 0, -2, -1, 2, 1, 200, 100);
    assert.ok(Math.abs(centroid(quad)[0]) < 1e-9);
    assert.ok(Math.abs(centroid(quad)[1]) < 1e-9);
    assert.equal(quad[0][1], quad[1][1]);
    assert.equal(quad[3][1], quad[2][1]);
    assert.ok(quad[0][1] > quad[3][1]);
    const width = quad[1][0] - quad[0][0];
    const height = quad[0][1] - quad[3][1];
    assert.ok(Math.abs(width / height - 2) < 1e-6);
});
