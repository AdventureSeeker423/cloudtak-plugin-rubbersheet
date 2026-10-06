import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyHorizontalPredictor,
    buildGeoTiff,
    readGeoTiffInfo,
    undoHorizontalPredictor,
} from '../lib/geotiff.ts';
import type { Raster } from '../lib/warp.ts';

test('horizontal predictor round-trips', () => {
    const rgba = Uint8Array.from([10, 20, 30, 40, 15, 25, 35, 45, 1, 2, 3, 4, 8, 9, 10, 11]);
    const predicted = applyHorizontalPredictor(rgba, 2, 2);
    const restored = undoHorizontalPredictor(predicted, 2, 2);
    assert.deepEqual(restored, rgba);
});

test('GeoTIFF is a deflate RGBA WGS84 raster tied to the north-west corner', async () => {
    const raster: Raster = {
        width: 2,
        height: 2,
        rgba: new Uint8Array(16).fill(255),
    };
    const file = await buildGeoTiff(raster, {
        west: -10,
        south: 20,
        east: -8,
        north: 24,
    });
    const info = readGeoTiffInfo(file);
    assert.equal(info.width, 2);
    assert.equal(info.height, 2);
    assert.equal(info.compression, 8);
    assert.equal(info.samples, 4);
    assert.equal(info.predictor, 2);
    assert.equal(info.extraSamples, 2);
    assert.equal(info.geographicType, 4326);
    assert.equal(info.tieX, -10);
    assert.equal(info.tieY, 24);
    assert.equal(info.scaleX, 1);
    assert.equal(info.scaleY, 2);
});
