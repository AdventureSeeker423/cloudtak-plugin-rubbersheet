import { JPEG_QUALITY, MAX_IMAGE_SIDE } from './constants.ts';
import { buildGeoPdf } from './geopdf.ts';
import { buildGeoTiff } from './geotiff.ts';
import { buildKmz, safeName } from './kmz.ts';
import type { Quad } from './geometry.ts';
import { hasTransparency, warpNorthUp, type Raster } from './warp.ts';
import { zipStore } from './zip.ts';
import type { ExportType } from './ui-state.ts';

export interface ExportFile {
    filename: string;
    bytes: Uint8Array;
    mime: string;
}

function canvasFromRaster(raster: Raster): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not draw the export');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(raster.rgba), raster.width, raster.height), 0, 0);
    return canvas;
}

function canvasToBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Could not encode the image'));
                return;
            }
            blob.arrayBuffer().then((buffer) => {
                resolve(new Uint8Array(buffer));
            }).catch(reject);
        }, type, quality);
    });
}

async function kmzBytes(name: string, opacity: number, quad: Quad, source: Raster): Promise<Uint8Array> {
    const transparent = hasTransparency(source.rgba);
    const encoded = await canvasToBytes(
        canvasFromRaster(source),
        transparent ? 'image/png' : 'image/jpeg',
        transparent ? undefined : JPEG_QUALITY,
    );
    return buildKmz({
        name,
        opacity,
        quad,
        image: encoded,
        ext: transparent ? 'png' : 'jpg',
    });
}

async function geotiffBytes(warped: ReturnType<typeof warpNorthUp>): Promise<Uint8Array> {
    return buildGeoTiff(warped.raster, warped);
}

async function geopdfBytes(name: string, warped: ReturnType<typeof warpNorthUp>): Promise<Uint8Array> {
    const jpeg = await canvasToBytes(canvasFromRaster(warped.raster), 'image/jpeg', JPEG_QUALITY);
    const alpha = new Uint8Array(warped.raster.width * warped.raster.height);
    for (let index = 0; index < alpha.length; index++) {
        alpha[index] = warped.raster.rgba[index * 4 + 3];
    }
    return buildGeoPdf({
        name,
        jpeg,
        alpha,
        width: warped.raster.width,
        height: warped.raster.height,
        west: warped.west,
        south: warped.south,
        east: warped.east,
        north: warped.north,
    });
}

export async function makeExport(kind: Exclude<ExportType, ''>, input: {
    name: string;
    opacity: number;
    quad: Quad;
    source: Raster;
}): Promise<ExportFile> {
    const name = safeName(input.name);
    if (kind === 'kmz') {
        return {
            filename: `${name}.kmz`,
            bytes: await kmzBytes(name, input.opacity, input.quad, input.source),
            mime: 'application/vnd.google-earth.kmz',
        };
    }
    const warped = warpNorthUp(input.source, input.quad, MAX_IMAGE_SIDE);
    if (kind === 'geotiff') {
        return {
            filename: `${name}.tif`,
            bytes: await geotiffBytes(warped),
            mime: 'image/tiff',
        };
    }
    if (kind === 'geopdf') {
        return {
            filename: `${name}.pdf`,
            bytes: await geopdfBytes(name, warped),
            mime: 'application/pdf',
        };
    }

    const [kmz, tif, pdf] = await Promise.all([
        kmzBytes(name, input.opacity, input.quad, input.source),
        geotiffBytes(warped),
        geopdfBytes(name, warped),
    ]);
    return {
        filename: `${name}.zip`,
        bytes: zipStore([
            { name: `${name}.kmz`, data: kmz },
            { name: `${name}.tif`, data: tif },
            { name: `${name}.pdf`, data: pdf },
        ]),
        mime: 'application/zip',
    };
}
