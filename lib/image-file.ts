import { MAX_IMAGE_SIDE } from './constants.ts';
import type { Raster } from './warp.ts';

export function fitCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not read the image');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
}

export async function canvasFromImageFile(file: File): Promise<HTMLCanvasElement> {
    const bitmap = await createImageBitmap(file);
    try {
        return fitCanvas(bitmap, bitmap.width, bitmap.height);
    } finally {
        bitmap.close();
    }
}

export function rasterFromCanvas(canvas: HTMLCanvasElement): Raster {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not read the image');
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
        width: canvas.width,
        height: canvas.height,
        rgba: new Uint8Array(image.data),
    };
}

export function fileBaseName(filename: string): string {
    const slash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
    const base = slash >= 0 ? filename.slice(slash + 1) : filename;
    return base.replace(/\.[^.]+$/, '') || 'rubber-sheet';
}

export function isPdf(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function isImage(file: File): boolean {
    if (file.type.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}
