import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasTransparency, warpNorthUp, type Raster } from '../lib/warp.ts';
import type { Quad } from '../lib/geometry.ts';

function solid(width: number, height: number, rgba: [number, number, number, number]): Raster {
    const data = new Uint8Array(width * height * 4);
    for (let index = 0; index < data.length; index += 4) {
        data[index] = rgba[0];
        data[index + 1] = rgba[1];
        data[index + 2] = rgba[2];
        data[index + 3] = rgba[3];
    }
    return { width, height, rgba: data };
}

test('transparency is detected from the alpha channel', () => {
    assert.equal(hasTransparency(Uint8Array.from([0, 0, 0, 255])), false);
    assert.equal(hasTransparency(Uint8Array.from([0, 0, 0, 10])), true);
});

test('an axis-aligned sheet fills its north-up raster', () => {
    const source = solid(8, 8, [200, 10, 10, 255]);
    const quad: Quad = [[0, 1], [1, 1], [1, 0], [0, 0]];
    const warped = warpNorthUp(source, quad);
    const mid = Math.floor(warped.raster.height / 2) * warped.raster.width + Math.floor(warped.raster.width / 2);
    const offset = mid * 4;
    assert.ok(warped.raster.rgba[offset] > 150);
    assert.equal(warped.raster.rgba[offset + 3], 255);
    assert.ok(warped.raster.width <= 8);
    assert.ok(warped.raster.height <= 8);
});

test('pixels outside a warped quad are transparent', () => {
    const source = solid(8, 8, [200, 10, 10, 255]);
    const quad: Quad = [[0, 1], [1, 1], [0.5, 0], [0, 0]];
    const warped = warpNorthUp(source, quad);
    const last = (warped.raster.width * warped.raster.height - 1) * 4;
    assert.equal(warped.raster.rgba[last + 3], 0);
    let opaque = 0;
    for (let index = 3; index < warped.raster.rgba.length; index += 4) {
        if (warped.raster.rgba[index] > 200) opaque += 1;
    }
    assert.ok(opaque > 0);
});
