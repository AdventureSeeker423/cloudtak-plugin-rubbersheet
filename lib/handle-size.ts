export interface HandlePoint {
    x: number;
    y: number;
}

export interface HandleSizes {
    /** Edge of the transparent square hit box centred on each handle. */
    box: number[];
    /** Edge of the visible dot, never larger than its hit box. */
    dot: number[];
}

/** Smallest hit box we still draw when handles nearly coincide. */
export const MIN_HANDLE_BOX_PX = 12;

/**
 * Size one square hit box per handle. A box is capped at `maxHit` and at the
 * Chebyshev distance to the nearest other handle, so two axis-aligned boxes
 * centred on their handles never overlap (down to the minimum box size).
 */
export function handleBoxSizes(points: HandlePoint[], dotSizes: number[], maxHit: number): HandleSizes {
    const box = points.map((point, i) => {
        let nearest = Infinity;
        for (let j = 0; j < points.length; j++) {
            if (j === i) continue;
            nearest = Math.min(nearest, Math.max(Math.abs(point.x - points[j].x), Math.abs(point.y - points[j].y)));
        }
        return Math.max(MIN_HANDLE_BOX_PX, Math.min(maxHit, Math.floor(nearest)));
    });
    const dot = box.map((size, i) => Math.min(dotSizes[i], size));
    return { box, dot };
}
