/**
 * Pure pan/zoom maths for the image editor viewport.
 * A view maps image space to screen space: screen = pan + image * scale.
 */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 8;

export type View = { scale: number; panX: number; panY: number };

/** Two-finger gesture at the moment the second finger landed. */
export type PinchStart = {
    /** Distance between the fingers. */
    d0: number;
    /** Midpoint of the fingers. */
    m0: { x: number; y: number };
    scale0: number;
    panX0: number;
    panY0: number;
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** Scale by `factor`, keeping the image point under (px, py) where it is on screen. */
export function zoomAbout(
    view: View,
    factor: number,
    px: number,
    py: number,
    min = MIN_SCALE,
    max = MAX_SCALE,
): View {
    const scale = clamp(view.scale * factor, min, max);
    const ix = (px - view.panX) / view.scale;
    const iy = (py - view.panY) / view.scale;
    return { scale, panX: px - ix * scale, panY: py - iy * scale };
}

/**
 * Pan by the midpoint delta and zoom by the distance ratio around the midpoint.
 * The image point that was under the starting midpoint ends under the current one.
 */
export function pinchView(
    start: PinchStart,
    current: { d: number; m: { x: number; y: number } },
    min = MIN_SCALE,
    max = MAX_SCALE,
): View {
    const ratio = start.d0 > 0 ? current.d / start.d0 : 1;
    const scale = clamp(start.scale0 * ratio, min, max);
    const ix = (start.m0.x - start.panX0) / start.scale0;
    const iy = (start.m0.y - start.panY0) / start.scale0;
    return {
        scale,
        panX: current.m.x - ix * scale,
        panY: current.m.y - iy * scale,
    };
}

/** True when the pointer stayed within `slopPx` and was released within `maxMs`. */
export function isTap(
    down: { x: number; y: number; t: number },
    up: { x: number; y: number; t: number },
    slopPx = 8,
    maxMs = 500,
): boolean {
    return Math.hypot(up.x - down.x, up.y - down.y) <= slopPx && up.t - down.t <= maxMs;
}

/** Centre the image in the viewport at the largest scale that fits (never above 1). */
export function fitView(
    viewW: number,
    viewH: number,
    imgW: number,
    imgH: number,
    pad: number,
): View {
    const sx = (viewW - pad * 2) / imgW;
    const sy = (viewH - pad * 2) / imgH;
    const scale = Math.min(1, Math.max(MIN_SCALE, Math.min(sx, sy)));
    return {
        scale,
        panX: (viewW - imgW * scale) / 2,
        panY: (viewH - imgH * scale) / 2,
    };
}
