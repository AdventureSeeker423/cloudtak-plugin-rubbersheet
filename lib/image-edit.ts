/**
 * Contiguous flood-select, mask erase, and brush erase for rubber-sheet pixels.
 * Mutates buffers in place where noted (caller owns undo snapshots).
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
 * Contiguous flood fill from (x, y) into a mask (1 = selected).
 * Fuzziness is max Euclidean RGB distance from the seed color.
 * Returns number of selected pixels.
 */
export function floodSelect(
    rgba: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    fuzziness: number,
    mask: Uint8Array,
): number {
    mask.fill(0);
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return 0;

    const seed = (py * width + px) * 4;
    if (rgba[seed + 3] === 0) return 0;

    const sr = rgba[seed];
    const sg = rgba[seed + 1];
    const sb = rgba[seed + 2];
    const tol = Math.max(0, fuzziness);

    const seen = new Uint8Array(width * height);
    const stack: number[] = [px, py];
    seen[py * width + px] = 1;
    let count = 0;

    while (stack.length) {
        const cy = stack.pop()!;
        const cx = stack.pop()!;
        const offset = (cy * width + cx) * 4;
        if (rgba[offset + 3] === 0) continue;
        if (colorDistance(rgba, offset, sr, sg, sb) > tol) continue;

        mask[cy * width + cx] = 1;
        count += 1;

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

    return count;
}

/**
 * Select every opaque pixel whose RGB is within fuzziness of (r, g, b),
 * anywhere in the image (not just contiguous).
 */
export function colorSelect(
    rgba: Uint8Array,
    width: number,
    height: number,
    r: number,
    g: number,
    b: number,
    fuzziness: number,
    mask: Uint8Array,
): number {
    mask.fill(0);
    const tol = Math.max(0, fuzziness);
    const n = width * height;
    let count = 0;
    for (let i = 0; i < n; i++) {
        const offset = i * 4;
        if (rgba[offset + 3] === 0) continue;
        if (colorDistance(rgba, offset, r, g, b) > tol) continue;
        mask[i] = 1;
        count += 1;
    }
    return count;
}

/** Sample opaque RGB at image coordinates; null if out of bounds or transparent. */
export function sampleColor(
    rgba: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
): { r: number; g: number; b: number } | null {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return null;
    const offset = (py * width + px) * 4;
    if (rgba[offset + 3] === 0) return null;
    return { r: rgba[offset], g: rgba[offset + 1], b: rgba[offset + 2] };
}

/** Clear every selected pixel in the mask (alpha → 0). */
export function eraseMask(
    rgba: Uint8Array,
    width: number,
    height: number,
    mask: Uint8Array,
): number {
    let erased = 0;
    const n = width * height;
    for (let i = 0; i < n; i++) {
        if (!mask[i]) continue;
        const offset = i * 4;
        if (rgba[offset + 3] === 0) continue;
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 0;
        erased += 1;
    }
    return erased;
}

/**
 * Contiguous flood erase (select + clear). Kept for tests / one-shot use.
 */
export function floodErase(
    rgba: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    tolerance: number,
): number {
    const mask = new Uint8Array(width * height);
    floodSelect(rgba, width, height, x, y, tolerance, mask);
    return eraseMask(rgba, width, height, mask);
}

/**
 * Soft circular brush: set alpha to 0 (and RGB to 0) inside radius.
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

/**
 * Build a Path2D of outer edges of the selection mask for marching ants.
 */
export function selectionOutlinePath(
    mask: Uint8Array,
    width: number,
    height: number,
): Path2D {
    const path = new Path2D();
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!mask[y * width + x]) continue;
            if (y === 0 || !mask[(y - 1) * width + x]) {
                path.moveTo(x, y);
                path.lineTo(x + 1, y);
            }
            if (y === height - 1 || !mask[(y + 1) * width + x]) {
                path.moveTo(x, y + 1);
                path.lineTo(x + 1, y + 1);
            }
            if (x === 0 || !mask[y * width + (x - 1)]) {
                path.moveTo(x, y);
                path.lineTo(x, y + 1);
            }
            if (x === width - 1 || !mask[y * width + (x + 1)]) {
                path.moveTo(x + 1, y);
                path.lineTo(x + 1, y + 1);
            }
        }
    }
    return path;
}
