import { deflateZlib } from './deflate.ts';
import type { Raster } from './warp.ts';

/**
 * JPEG-in-TIFF plus a separate mask band is not reliable to hand-write, and a wrong
 * JPEG TIFF is worse than a larger file. This writer stores unassociated RGBA with
 * zlib deflate (TIFF compression 8) and horizontal predictor 2, which is the fallback
 * the export plan allows. The raster is already capped at 4096 px.
 */
export function applyHorizontalPredictor(rgba: Uint8Array, width: number, height: number): Uint8Array {
    const out = rgba.slice();
    const samples = 4;
    for (let y = 0; y < height; y++) {
        const row = y * width * samples;
        for (let x = width - 1; x >= 1; x--) {
            const pixel = row + x * samples;
            const previous = pixel - samples;
            for (let sample = 0; sample < samples; sample++) {
                out[pixel + sample] = (out[pixel + sample] - out[previous + sample]) & 0xff;
            }
        }
    }
    return out;
}

export function undoHorizontalPredictor(rgba: Uint8Array, width: number, height: number): Uint8Array {
    const out = rgba.slice();
    const samples = 4;
    for (let y = 0; y < height; y++) {
        const row = y * width * samples;
        for (let x = 1; x < width; x++) {
            const pixel = row + x * samples;
            const previous = pixel - samples;
            for (let sample = 0; sample < samples; sample++) {
                out[pixel + sample] = (out[pixel + sample] + out[previous + sample]) & 0xff;
            }
        }
    }
    return out;
}

class TiffBuffer {
    private readonly parts: Uint8Array[] = [];
    length = 0;

    bytes(data: Uint8Array): void {
        this.parts.push(data);
        this.length += data.length;
    }

    u8(value: number): void {
        this.bytes(Uint8Array.of(value & 0xff));
    }

    u16(value: number): void {
        const data = new Uint8Array(2);
        new DataView(data.buffer).setUint16(0, value, true);
        this.bytes(data);
    }

    u32(value: number): void {
        const data = new Uint8Array(4);
        new DataView(data.buffer).setUint32(0, value >>> 0, true);
        this.bytes(data);
    }

    f64(value: number): void {
        const data = new Uint8Array(8);
        new DataView(data.buffer).setFloat64(0, value, true);
        this.bytes(data);
    }

    align(boundary = 2): void {
        while (this.length % boundary !== 0) this.u8(0);
    }

    concat(): Uint8Array {
        const out = new Uint8Array(this.length);
        let offset = 0;
        for (const part of this.parts) {
            out.set(part, offset);
            offset += part.length;
        }
        return out;
    }
}

const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_DOUBLE = 12;

interface TiffTag {
    id: number;
    type: number;
    count: number;
    value?: number;
    offset?: number;
}

function tagEntry(tag: TiffTag): Uint8Array {
    const entry = new Uint8Array(12);
    const view = new DataView(entry.buffer);
    view.setUint16(0, tag.id, true);
    view.setUint16(2, tag.type, true);
    view.setUint32(4, tag.count, true);
    if (tag.offset !== undefined) {
        view.setUint32(8, tag.offset, true);
    } else {
        const value = tag.value ?? 0;
        if (tag.type === TYPE_SHORT) view.setUint16(8, value, true);
        else view.setUint32(8, value >>> 0, true);
    }
    return entry;
}

export async function buildGeoTiff(raster: Raster, bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
}): Promise<Uint8Array> {
    const predicted = applyHorizontalPredictor(raster.rgba, raster.width, raster.height);
    const compressed = await deflateZlib(predicted);
    const scaleX = (bounds.east - bounds.west) / raster.width;
    const scaleY = (bounds.north - bounds.south) / raster.height;

    const geoKeys = [
        1, 1, 0, 4,
        1024, 0, 1, 2,
        1025, 0, 1, 1,
        2048, 0, 1, 4326,
        2054, 0, 1, 9102,
    ];

    const body = new TiffBuffer();
    body.u8(0x49);
    body.u8(0x49);
    body.u16(42);
    body.u32(0);

    body.align(2);
    const stripOffset = body.length;
    body.bytes(compressed);

    body.align(2);
    const bitsOffset = body.length;
    body.u16(8);
    body.u16(8);
    body.u16(8);
    body.u16(8);

    body.align(8);
    const scaleOffset = body.length;
    body.f64(scaleX);
    body.f64(scaleY);
    body.f64(0);

    body.align(8);
    const tieOffset = body.length;
    body.f64(0);
    body.f64(0);
    body.f64(0);
    body.f64(bounds.west);
    body.f64(bounds.north);
    body.f64(0);

    body.align(2);
    const geoOffset = body.length;
    for (const key of geoKeys) body.u16(key);

    body.align(2);
    const ifdOffset = body.length;
    const tags: TiffTag[] = [
        { id: 256, type: TYPE_LONG, count: 1, value: raster.width },
        { id: 257, type: TYPE_LONG, count: 1, value: raster.height },
        { id: 258, type: TYPE_SHORT, count: 4, offset: bitsOffset },
        { id: 259, type: TYPE_SHORT, count: 1, value: 8 },
        { id: 262, type: TYPE_SHORT, count: 1, value: 2 },
        { id: 273, type: TYPE_LONG, count: 1, value: stripOffset },
        { id: 277, type: TYPE_SHORT, count: 1, value: 4 },
        { id: 278, type: TYPE_LONG, count: 1, value: raster.height },
        { id: 279, type: TYPE_LONG, count: 1, value: compressed.length },
        { id: 284, type: TYPE_SHORT, count: 1, value: 1 },
        { id: 317, type: TYPE_SHORT, count: 1, value: 2 },
        { id: 338, type: TYPE_SHORT, count: 1, value: 2 },
        { id: 33550, type: TYPE_DOUBLE, count: 3, offset: scaleOffset },
        { id: 33922, type: TYPE_DOUBLE, count: 6, offset: tieOffset },
        { id: 34735, type: TYPE_SHORT, count: geoKeys.length, offset: geoOffset },
    ];

    body.u16(tags.length);
    for (const tag of tags) body.bytes(tagEntry(tag));
    body.u32(0);

    const file = body.concat();
    new DataView(file.buffer).setUint32(4, ifdOffset, true);
    return file;
}

export interface GeoTiffInfo {
    width: number;
    height: number;
    compression: number;
    samples: number;
    predictor: number;
    extraSamples: number;
    tieX: number;
    tieY: number;
    scaleX: number;
    scaleY: number;
    geographicType: number;
}

export function readGeoTiffInfo(file: Uint8Array): GeoTiffInfo {
    const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
    if (view.getUint16(0, true) !== 0x4949) throw new Error('Expected a little-endian TIFF');
    const ifd = view.getUint32(4, true);
    const count = view.getUint16(ifd, true);
    const tags = new Map<number, { type: number; count: number; value: number }>();

    for (let index = 0; index < count; index++) {
        const entry = ifd + 2 + index * 12;
        tags.set(view.getUint16(entry, true), {
            type: view.getUint16(entry + 2, true),
            count: view.getUint32(entry + 4, true),
            value: view.getUint32(entry + 8, true),
        });
    }

    function inlineShort(id: number): number {
        const tag = tags.get(id);
        if (!tag) throw new Error(`Missing TIFF tag ${id}`);
        return tag.value & 0xffff;
    }

    function inlineLong(id: number): number {
        const tag = tags.get(id);
        if (!tag) throw new Error(`Missing TIFF tag ${id}`);
        return tag.value >>> 0;
    }

    function doubles(id: number, count: number): number[] {
        const tag = tags.get(id);
        if (!tag) throw new Error(`Missing TIFF tag ${id}`);
        const values: number[] = [];
        for (let index = 0; index < count; index++) {
            values.push(view.getFloat64(tag.value + index * 8, true));
        }
        return values;
    }

    const scale = doubles(33550, 3);
    const tie = doubles(33922, 6);
    const geo = tags.get(34735);
    if (!geo) throw new Error('Missing GeoKey directory');
    let geographicType = 0;
    const keyCount = view.getUint16(geo.value + 6, true);
    for (let index = 0; index < keyCount; index++) {
        const key = geo.value + 8 + index * 8;
        if (view.getUint16(key, true) === 2048) {
            geographicType = view.getUint16(key + 6, true);
        }
    }

    return {
        width: inlineLong(256),
        height: inlineLong(257),
        compression: inlineShort(259),
        samples: inlineShort(277),
        predictor: inlineShort(317),
        extraSamples: inlineShort(338),
        scaleX: scale[0],
        scaleY: scale[1],
        tieX: tie[3],
        tieY: tie[4],
        geographicType,
    };
}
