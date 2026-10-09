import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    FACILITY_STAMP_CATALOG,
    NUMBER_STAMP_CATALOG,
    cloneStamps,
    hitTestStamp,
    isNumberStamp,
    numberFromStamp,
    type PlacedStamp,
} from '../lib/stamp-icons.ts';

test('catalog covers the requested facility icons', () => {
    const kinds = new Set(FACILITY_STAMP_CATALOG.map((entry) => entry.kind));
    for (const kind of [
        'first-aid',
        'aed',
        'master-key',
        'extinguisher',
        'hose-cabinet',
        'standpipe',
        'hydrant',
        'electric-shutoff',
        'gas-shutoff',
        'water-shutoff',
        'electrical-room',
        'hazmat',
    ]) {
        assert.ok(kinds.has(kind as PlacedStamp['kind']), kind);
    }
});

test('numbered placards cover 0 through 20', () => {
    assert.equal(NUMBER_STAMP_CATALOG.length, 21);
    for (let n = 0; n <= 20; n++) {
        const entry = NUMBER_STAMP_CATALOG[n];
        assert.equal(entry.kind, `number-${n}`);
        assert.equal(entry.short, String(n));
        assert.ok(isNumberStamp(entry.kind));
        assert.equal(numberFromStamp(entry.kind), n);
    }
});

test('hit test finds the nearest stamp inside its radius', () => {
    const stamps: PlacedStamp[] = [
        { id: 1, kind: 'hydrant', x: 100, y: 100, size: 40 },
        { id: 2, kind: 'aed', x: 200, y: 100, size: 40 },
    ];
    assert.equal(hitTestStamp(stamps, 105, 100)?.id, 1);
    assert.equal(hitTestStamp(stamps, 200, 110)?.id, 2);
    assert.equal(hitTestStamp(stamps, 150, 100), null);
});

test('cloneStamps deep-copies entries', () => {
    const stamps: PlacedStamp[] = [
        { id: 1, kind: 'first-aid', x: 10, y: 20, size: 32 },
    ];
    const copy = cloneStamps(stamps);
    copy[0].x = 99;
    assert.equal(stamps[0].x, 10);
});
