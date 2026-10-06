import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGeoPdf } from '../lib/geopdf.ts';

test('GeoPDF records the warped raster bounds and a soft mask', async () => {
    const pdf = await buildGeoPdf({
        name: 'Floor (A)',
        jpeg: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
        alpha: Uint8Array.from([255, 0, 0, 128]),
        width: 2,
        height: 2,
        west: -104.99,
        south: 39.7,
        east: -104.98,
        north: 39.75,
    });
    const text = new TextDecoder('latin1').decode(pdf);
    assert.match(text, /%PDF-1\.4/);
    assert.match(text, /\/Type \/LGIDict/);
    assert.match(text, /\/Filter \/DCTDecode/);
    assert.match(text, /\/SMask 6 0 R/);
    assert.match(text, /\/Subtype \/GEO/);
    assert.match(text, /-104\.99/);
    assert.match(text, /39\.7/);
    assert.match(text, /Floor \\\(A\\\)/);
    assert.match(text, /%%EOF/);
});
