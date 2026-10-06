import { bboxOf, homography, applyHomography, type Quad } from './geometry.ts';

export interface Raster {
    width: number;
    height: number;
    rgba: Uint8Array;
}

export function hasTransparency(rgba: Uint8Array): boolean {
    for (let index = 3; index < rgba.length; index += 4) {
        if (rgba[index] < 250) return true;
    }
    return false;
}

export function outputSize(
    source: Raster,
    west: number,
    south: number,
    east: number,
    north: number,
    maxSide = 4096,
): { width: number; height: number } {
    const midLat = (south + north) / 2;
    const metersPerDegLng = 111320 * Math.cos((midLat * Math.PI) / 180);
    const widthM = Math.max(1e-6, Math.abs(east - west) * Math.abs(metersPerDegLng));
    const heightM = Math.max(1e-6, Math.abs(north - south) * 111320);
    const longSide = Math.max(1, Math.min(maxSide, Math.max(source.width, source.height)));
    if (widthM >= heightM) {
        return {
            width: longSide,
            height: Math.max(1, Math.round(longSide * (heightM / widthM))),
        };
    }
    return {
        height: longSide,
        width: Math.max(1, Math.round(longSide * (widthM / heightM))),
    };
}

function sample(source: Raster, u: number, v: number): [number, number, number, number] {
    if (u < 0 || v < 0 || u > source.width || v > source.height) return [0, 0, 0, 0];
    const x = Math.min(source.width - 1, Math.max(0, u - 0.5));
    const y = Math.min(source.height - 1, Math.max(0, v - 0.5));
    const x1 = Math.min(source.width - 1, Math.floor(x));
    const y1 = Math.min(source.height - 1, Math.floor(y));
    const x2 = Math.min(source.width - 1, x1 + 1);
    const y2 = Math.min(source.height - 1, y1 + 1);
    const tx = x - x1;
    const ty = y - y1;
    const p11 = (y1 * source.width + x1) * 4;
    const p21 = (y1 * source.width + x2) * 4;
    const p12 = (y2 * source.width + x1) * 4;
    const p22 = (y2 * source.width + x2) * 4;
    const rgba = source.rgba;
    const channels: [number, number, number, number] = [0, 0, 0, 0];
    for (let channel = 0; channel < 4; channel++) {
        const top = rgba[p11 + channel] * (1 - tx) + rgba[p21 + channel] * tx;
        const bottom = rgba[p12 + channel] * (1 - tx) + rgba[p22 + channel] * tx;
        channels[channel] = Math.round(top * (1 - ty) + bottom * ty);
    }
    return channels;
}

/**
 * Bake the four-corner warp into a north-up WGS84 raster.
 * Pixels outside the quad are transparent. The long side is never larger than the source.
 */
export function warpNorthUp(source: Raster, quad: Quad, maxSide = 4096): {
    raster: Raster;
    west: number;
    south: number;
    east: number;
    north: number;
} {
    const bounds = bboxOf(quad);
    if (bounds.east - bounds.west < 1e-12 || bounds.north - bounds.south < 1e-12) {
        throw new Error('The sheet is too small to export');
    }
    const size = outputSize(source, bounds.west, bounds.south, bounds.east, bounds.north, maxSide);
    const matrix = homography(
        quad.map((corner) => [corner[0], corner[1]]),
        [[0, 0], [source.width, 0], [source.width, source.height], [0, source.height]],
    );
    const rgba = new Uint8Array(size.width * size.height * 4);
    const spanLng = bounds.east - bounds.west;
    const spanLat = bounds.north - bounds.south;

    for (let y = 0; y < size.height; y++) {
        const lat = bounds.north - ((y + 0.5) / size.height) * spanLat;
        for (let x = 0; x < size.width; x++) {
            const lng = bounds.west + ((x + 0.5) / size.width) * spanLng;
            const [u, v] = applyHomography(matrix, lng, lat);
            const pixel = sample(source, u, v);
            const offset = (y * size.width + x) * 4;
            rgba[offset] = pixel[0];
            rgba[offset + 1] = pixel[1];
            rgba[offset + 2] = pixel[2];
            rgba[offset + 3] = pixel[3];
        }
    }

    return {
        raster: { width: size.width, height: size.height, rgba },
        west: bounds.west,
        south: bounds.south,
        east: bounds.east,
        north: bounds.north,
    };
}
