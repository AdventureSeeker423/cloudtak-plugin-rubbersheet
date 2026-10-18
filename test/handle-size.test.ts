import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleBoxSizes, MIN_HANDLE_BOX_PX, type HandlePoint } from '../lib/handle-size.ts';

const DOTS = [24, 24, 24, 24, 36];

function sheetPoints(scale: number): HandlePoint[] {
    // Four corners of a 4:3 sheet and the rotate knob above the top edge.
    return [
        { x: 0, y: 0 },
        { x: 400 * scale, y: 0 },
        { x: 400 * scale, y: 300 * scale },
        { x: 0, y: 300 * scale },
        { x: 200 * scale, y: -36 },
    ];
}

function overlapping(points: HandlePoint[], box: number[]): number {
    let n = 0;
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const reach = (box[i] + box[j]) / 2;
            if (Math.abs(points[i].x - points[j].x) < reach && Math.abs(points[i].y - points[j].y) < reach) n++;
        }
    }
    return n;
}

test('a large sheet keeps full 44 px hit boxes', () => {
    const { box } = handleBoxSizes(sheetPoints(1), DOTS, 44);
    assert.deepEqual(box, [44, 44, 44, 44, 44]);
});

test('small sheets get smaller hit boxes that never overlap', () => {
    for (const scale of [0.4, 0.2, 0.12, 0.1]) {
        const points = sheetPoints(scale);
        const { box } = handleBoxSizes(points, DOTS, 44);
        assert.equal(overlapping(points, box), 0, `scale ${scale}`);
        assert.ok(box.every((size) => size <= 44));
    }
});

test('a diagonal neighbour closer than 44 px on both axes still gets separate boxes', () => {
    const points = [{ x: 0, y: 0 }, { x: 42, y: 42 }, { x: 400, y: 400 }];
    const { box } = handleBoxSizes(points, [24, 24, 24], 44);
    assert.equal(overlapping(points, box), 0);
    assert.equal(box[2], 44);
});

test('coincident handles fall back to the minimum box', () => {
    const points = [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 300, y: 300 }];
    const { box } = handleBoxSizes(points, [24, 24, 24], 44);
    assert.deepEqual(box, [MIN_HANDLE_BOX_PX, MIN_HANDLE_BOX_PX, 44]);
});

test('dots never exceed their box and boxes never grow as the sheet shrinks', () => {
    let previous = handleBoxSizes(sheetPoints(1), DOTS, 44);
    for (const scale of [0.5, 0.25, 0.1, 0.05]) {
        const next = handleBoxSizes(sheetPoints(scale), DOTS, 44);
        next.box.forEach((size, i) => {
            assert.ok(size <= previous.box[i]);
            assert.ok(next.dot[i] <= size);
        });
        previous = next;
    }
});
