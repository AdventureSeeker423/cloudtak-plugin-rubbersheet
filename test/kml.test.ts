import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGroundOverlayKml, kmlColor, safeName } from '../lib/kml.ts';
import { buildKmz } from '../lib/kmz.ts';
import { unzipStore } from '../lib/zip.ts';
import type { Quad } from '../lib/geometry.ts';

const quad: Quad = [
    [1, 2],
    [3, 2],
    [3, 0],
    [1, 0],
];

test('names are safe file stems', () => {
    assert.equal(safeName('  Floor / Plan  '), 'Floor _ Plan');
    assert.equal(safeName('   '), 'rubber-sheet');
});

test('full opacity is opaque white in KML order aabbggrr', () => {
    assert.equal(kmlColor(100), 'ffffffff');
    assert.equal(kmlColor(0), '00ffffff');
});

test('KMZ stores the image corners as lower-left, lower-right, upper-right, upper-left', () => {
    const kmz = buildKmz({
        name: 'Tower & A',
        opacity: 100,
        quad,
        image: new Uint8Array([1, 2, 3]),
        ext: 'jpg',
    });
    const entries = unzipStore(kmz);
    const kml = entries.find((entry) => entry.name === 'doc.kml');
    const image = entries.find((entry) => entry.name === 'files/overlay.jpg');
    assert.ok(kml);
    assert.ok(image);
    const text = new TextDecoder().decode(kml.data);
    assert.match(text, /Tower &amp; A/);
    assert.match(
        text,
        /<coordinates>1\.0000000,0\.0000000,0 3\.0000000,0\.0000000,0 3\.0000000,2\.0000000,0 1\.0000000,2\.0000000,0<\/coordinates>/,
    );
    assert.match(text, /<altitudeMode>clampToGround<\/altitudeMode>/);
    assert.equal(buildGroundOverlayKml({
        name: 'Tower & A',
        href: 'files/overlay.jpg',
        opacity: 100,
        quad,
    }).includes('gx:LatLonQuad'), true);
});
