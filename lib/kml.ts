import type { Quad } from './geometry.ts';

export function safeName(name: string): string {
    const trimmed = name.trim() || 'rubber-sheet';
    const cleaned = trimmed.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim();
    return (cleaned || 'rubber-sheet').slice(0, 80);
}

export function xmlEscape(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function formatCoord(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return value.toFixed(7);
}

/** KML color is aabbggrr. The sheet color stays white; only alpha follows the slider. */
export function kmlColor(opacityPercent: number): string {
    const clamped = Math.min(100, Math.max(0, opacityPercent));
    const alpha = Math.round((clamped / 100) * 255);
    return alpha.toString(16).padStart(2, '0') + 'ffffff';
}

/**
 * gx:LatLonQuad coordinates are the image's lower-left, lower-right, upper-right, upper-left.
 * Our quad is stored as top-left, top-right, bottom-right, bottom-left.
 */
export function latLonQuadCoordinates(quad: Quad): string {
    const order = [quad[3], quad[2], quad[1], quad[0]];
    return order
        .map((point) => `${formatCoord(point[0])},${formatCoord(point[1])},0`)
        .join(' ');
}

export function buildGroundOverlayKml(opts: {
    name: string;
    href: string;
    opacity: number;
    quad: Quad;
}): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <GroundOverlay>
    <name>${xmlEscape(opts.name)}</name>
    <color>${kmlColor(opts.opacity)}</color>
    <Icon>
      <href>${xmlEscape(opts.href)}</href>
    </Icon>
    <gx:LatLonQuad>
      <coordinates>${latLonQuadCoordinates(opts.quad)}</coordinates>
    </gx:LatLonQuad>
    <altitudeMode>clampToGround</altitudeMode>
  </GroundOverlay>
</kml>
`;
}
