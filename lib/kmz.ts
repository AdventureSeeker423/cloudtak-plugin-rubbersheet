import type { Quad } from './geometry.ts';
import { buildGroundOverlayKml, safeName } from './kml.ts';
import { zipStore } from './zip.ts';

export function buildKmz(opts: {
    name: string;
    opacity: number;
    quad: Quad;
    image: Uint8Array;
    ext: 'jpg' | 'png';
}): Uint8Array {
    const href = `files/overlay.${opts.ext}`;
    const kml = buildGroundOverlayKml({
        name: opts.name,
        href,
        opacity: opts.opacity,
        quad: opts.quad,
    });
    return zipStore([
        { name: 'doc.kml', data: new TextEncoder().encode(kml) },
        { name: href, data: opts.image },
    ]);
}

export { safeName };
