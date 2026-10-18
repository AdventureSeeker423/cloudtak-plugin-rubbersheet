import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadExportType, parseExportType, saveExportType } from '../lib/export-type.ts';

const KEY = 'format-key';

function memory(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => {
            data[key] = value;
        },
    };
}

test('the format defaults to KMZ when nothing valid is stored', () => {
    assert.equal(loadExportType(memory(), KEY), 'kmz');
    assert.equal(loadExportType(memory({ [KEY]: 'docx' }), KEY), 'kmz');
    assert.equal(loadExportType(memory({ [KEY]: '' }), KEY), 'kmz');
    assert.equal(loadExportType(undefined, KEY), 'kmz');
});

test('the last chosen format is restored', () => {
    for (const type of ['kmz', 'geotiff', 'geopdf', 'zip'] as const) {
        const storage = memory();
        saveExportType(storage, KEY, type);
        assert.equal(loadExportType(storage, KEY), type);
    }
});

test('storage errors fall back to KMZ and never throw', () => {
    const broken = {
        getItem: () => {
            throw new Error('denied');
        },
        setItem: () => {
            throw new Error('denied');
        },
    };
    assert.equal(loadExportType(broken, KEY), 'kmz');
    assert.doesNotThrow(() => saveExportType(broken, KEY, 'zip'));
});

test('only real formats parse, and the empty type is never stored', () => {
    assert.equal(parseExportType('geopdf'), 'geopdf');
    assert.equal(parseExportType(''), null);
    assert.equal(parseExportType(null), null);
    const storage = memory();
    saveExportType(storage, KEY, '');
    assert.deepEqual(storage.data, {});
});
