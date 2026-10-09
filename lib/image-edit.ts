/**
 * Contiguous flood-erase and brush erase for rubber-sheet source pixels.
 * Mutates the RGBA buffer in place (caller owns undo snapshots).
 */

function colorDistance(
    rgba: Uint8Array,
    offset: number,
    r: number,
    g: number,
    b: number,
): number {
    const dr = rgba[offset] - r;
    const dg = rgba[offset + 1] - g;
    const db = rgba[offset + 2] - b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Contiguous flood fill from (x, y): set matching pixels to fully transparent.
 * Tolerance is max Euclidean RGB distance from the seed color.
 */
export function floodErase(
    rgba: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    tolerance: number,
): number {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return 0;

    const seed = (py * width + px) * 4;
    if (rgba[seed + 3] === 0) return 0;

    const sr = rgba[seed];
    const sg = rgba[seed + 1];
    const sb = rgba[seed + 2];
    const tol = Math.max(0, tolerance);

    const seen = new Uint8Array(width * height);
    const stack: number[] = [px, py];
    seen[py * width + px] = 1;
    let erased = 0;

    while (stack.length) {
        const cy = stack.pop()!;
        const cx = stack.pop()!;
        const offset = (cy * width + cx) * 4;
        if (rgba[offset + 3] === 0) continue;
        if (colorDistance(rgba, offset, sr, sg, sb) > tol) continue;

        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 0;
        erased += 1;

        const neighbors = [
            cx - 1, cy,
            cx + 1, cy,
            cx, cy - 1,
            cx, cy + 1,
        ];
        for (let i = 0; i < neighbors.length; i += 2) {
            const nx = neighbors[i];
            const ny = neighbors[i + 1];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (seen[ni]) continue;
            seen[ni] = 1;
            stack.push(nx, ny);
        }
    }

    return erased;
}

/**
 * Soft circular brush: set alpha to 0 (and RGB to 0) inside radius.
 * Soft edge: alpha fades near the rim for a slightly softer punch.
 */
export function eraseBrush(
    rgba: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    radius: number,
): number {
    const r = Math.max(0.5, radius);
    const hard = r * 0.65;
    const minX = Math.max(0, Math.floor(x - r));
    const maxX = Math.min(width - 1, Math.ceil(x + r));
    const minY = Math.max(0, Math.floor(y - r));
    const maxY = Math.min(height - 1, Math.ceil(y + r));
    let erased = 0;

    for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
            const dx = px + 0.5 - x;
            const dy = py + 0.5 - y;
            const dist = Math.hypot(dx, dy);
            if (dist > r) continue;
            const offset = (py * width + px) * 4;
            const prev = rgba[offset + 3];
            if (prev === 0) continue;

            let nextAlpha = 0;
            if (dist > hard) {
                const t = (dist - hard) / (r - hard);
                nextAlpha = Math.round(prev * t);
            }
            if (nextAlpha === 0) {
                rgba[offset] = 0;
                rgba[offset + 1] = 0;
                rgba[offset + 2] = 0;
                rgba[offset + 3] = 0;
            } else {
                rgba[offset + 3] = nextAlpha;
            }
            erased += 1;
        }
    }

    return erased;
}
