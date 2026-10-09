/** Geographic point as longitude, latitude in degrees. */
export type LngLat = [number, number];

/**
 * Image corners in MapLibre order: top-left, top-right, bottom-right, bottom-left.
 */
export type Quad = [LngLat, LngLat, LngLat, LngLat];

export type CornerIndex = 0 | 1 | 2 | 3;

const METERS_PER_DEG_LAT = 111320;

export function oppositeCorner(index: CornerIndex): CornerIndex {
    return ((index + 2) % 4) as CornerIndex;
}

export function cloneQuad(quad: Quad): Quad {
    return [
        [quad[0][0], quad[0][1]],
        [quad[1][0], quad[1][1]],
        [quad[2][0], quad[2][1]],
        [quad[3][0], quad[3][1]],
    ];
}

export function centroid(quad: Quad): LngLat {
    let lng = 0;
    let lat = 0;
    for (const point of quad) {
        lng += point[0];
        lat += point[1];
    }
    return [lng / quad.length, lat / quad.length];
}

export function translateQuad(quad: Quad, dLng: number, dLat: number): Quad {
    return quad.map((point) => [point[0] + dLng, point[1] + dLat]) as Quad;
}

function metersPerDegLng(lat: number): number {
    return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function toMeters(point: LngLat, origin: LngLat): [number, number] {
    return [
        (point[0] - origin[0]) * metersPerDegLng(origin[1]),
        (point[1] - origin[1]) * METERS_PER_DEG_LAT,
    ];
}

function fromMeters(east: number, north: number, origin: LngLat): LngLat {
    const lngScale = metersPerDegLng(origin[1]);
    return [
        origin[0] + east / (Math.abs(lngScale) < 1e-9 ? 1e-9 : lngScale),
        origin[1] + north / METERS_PER_DEG_LAT,
    ];
}

/**
 * Uniform scale of the whole quad about an anchor point.
 * The dragged corner stays on its original ray from that anchor.
 * Scale is clamped so the sheet cannot flip or collapse.
 */
function scaleAboutAnchor(quad: Quad, corner: CornerIndex, cursor: LngLat, anchor: LngLat): Quad {
    const old = toMeters(quad[corner], anchor);
    const next = toMeters(cursor, anchor);
    const denom = old[0] * old[0] + old[1] * old[1];
    if (denom < 1e-8) return cloneQuad(quad);

    let scale = (next[0] * old[0] + next[1] * old[1]) / denom;
    if (scale < 0.02) scale = 0.02;

    return quad.map((point) => {
        const meters = toMeters(point, anchor);
        return fromMeters(meters[0] * scale, meters[1] * scale, anchor);
    }) as Quad;
}

/** Uniform scale of the whole quad about the opposite corner. */
export function scaleAboutOpposite(quad: Quad, corner: CornerIndex, cursor: LngLat): Quad {
    return scaleAboutAnchor(quad, corner, cursor, quad[oppositeCorner(corner)]);
}

/** Uniform scale of the whole quad about its centroid. */
export function scaleAboutCenter(quad: Quad, corner: CornerIndex, cursor: LngLat): Quad {
    return scaleAboutAnchor(quad, corner, cursor, centroid(quad));
}

/** Rotate every corner around the quad centroid. Positive radians are counter-clockwise in east/north space. */
export function rotateAroundCenter(quad: Quad, radians: number): Quad {
    const center = centroid(quad);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return quad.map((point) => {
        const [east, north] = toMeters(point, center);
        return fromMeters(east * cos - north * sin, east * sin + north * cos, center);
    }) as Quad;
}

/**
 * North-up sheet centered on the view, covering about a quarter of the view area,
 * with the image aspect ratio preserved in local meters.
 */
export function quadForView(
    centerLng: number,
    centerLat: number,
    west: number,
    south: number,
    east: number,
    north: number,
    imageWidth: number,
    imageHeight: number,
): Quad {
    const lngScale = Math.abs(metersPerDegLng(centerLat));
    const viewWidthM = Math.max(1, Math.abs(east - west) * (lngScale < 1e-9 ? 1e-9 : lngScale));
    const viewHeightM = Math.max(1, Math.abs(north - south) * METERS_PER_DEG_LAT);
    const aspect = Math.max(1e-6, imageWidth) / Math.max(1e-6, imageHeight);
    const sheetArea = viewWidthM * viewHeightM * 0.25;
    const sheetHeightM = Math.sqrt(sheetArea / aspect);
    const sheetWidthM = aspect * sheetHeightM;
    const halfLng = sheetWidthM / (lngScale < 1e-9 ? 1e-9 : lngScale) / 2;
    const halfLat = sheetHeightM / METERS_PER_DEG_LAT / 2;

    return [
        [centerLng - halfLng, centerLat + halfLat],
        [centerLng + halfLng, centerLat + halfLat],
        [centerLng + halfLng, centerLat - halfLat],
        [centerLng - halfLng, centerLat - halfLat],
    ];
}

export function bboxOf(quad: Quad): { west: number; south: number; east: number; north: number } {
    const lngs = quad.map((point) => point[0]);
    const lats = quad.map((point) => point[1]);
    return {
        west: Math.min(...lngs),
        east: Math.max(...lngs),
        south: Math.min(...lats),
        north: Math.max(...lats),
    };
}

function multiply(a: number[], b: number[]): number[] {
    const out = new Array<number>(9).fill(0);
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            out[row * 3 + col] = a[row * 3] * b[col]
                + a[row * 3 + 1] * b[3 + col]
                + a[row * 3 + 2] * b[6 + col];
        }
    }
    return out;
}

function normalizingTransform(points: Array<[number, number]>): { points: Array<[number, number]>; matrix: number[] } {
    let cx = 0;
    let cy = 0;
    for (const point of points) {
        cx += point[0];
        cy += point[1];
    }
    cx /= points.length;
    cy /= points.length;

    let dist = 0;
    for (const point of points) dist += Math.hypot(point[0] - cx, point[1] - cy);
    dist /= points.length;
    const scale = dist < 1e-12 ? 1 : Math.SQRT2 / dist;

    return {
        points: points.map((point) => [(point[0] - cx) * scale, (point[1] - cy) * scale]),
        matrix: [scale, 0, -scale * cx, 0, scale, -scale * cy, 0, 0, 1],
    };
}

function invertSimilarity(matrix: number[]): number[] {
    const scale = matrix[0];
    const tx = matrix[2];
    const ty = matrix[5];
    const inv = Math.abs(scale) < 1e-18 ? 1 : 1 / scale;
    return [inv, 0, -tx * inv, 0, inv, -ty * inv, 0, 0, 1];
}

function solveLinear(rows: number[][], values: number[]): number[] {
    const size = values.length;
    const matrix = rows.map((row, index) => [...row, values[index]]);

    for (let col = 0; col < size; col++) {
        let pivot = col;
        for (let row = col + 1; row < size; row++) {
            if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
        }
        if (Math.abs(matrix[pivot][col]) < 1e-12) {
            throw new Error('Could not fit a transform to these corners');
        }
        const swap = matrix[col];
        matrix[col] = matrix[pivot];
        matrix[pivot] = swap;

        const divisor = matrix[col][col];
        for (let colIndex = col; colIndex <= size; colIndex++) matrix[col][colIndex] /= divisor;

        for (let row = 0; row < size; row++) {
            if (row === col) continue;
            const factor = matrix[row][col];
            if (factor === 0) continue;
            for (let colIndex = col; colIndex <= size; colIndex++) {
                matrix[row][colIndex] -= factor * matrix[col][colIndex];
            }
        }
    }

    return matrix.map((row) => row[size]);
}

/** 3x3 row-major homography mapping src points onto dst points. */
export function homography(src: Array<[number, number]>, dst: Array<[number, number]>): number[] {
    if (src.length !== 4 || dst.length !== 4) {
        throw new Error('A rubber sheet needs four corners');
    }

    const normSrc = normalizingTransform(src);
    const normDst = normalizingTransform(dst);
    const coefficients: number[][] = [];
    const values: number[] = [];

    for (let index = 0; index < 4; index++) {
        const [x, y] = normSrc.points[index];
        const [u, v] = normDst.points[index];
        coefficients.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
        values.push(u);
        coefficients.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
        values.push(v);
    }

    const solved = solveLinear(coefficients, values);
    const normalized = [
        solved[0], solved[1], solved[2],
        solved[3], solved[4], solved[5],
        solved[6], solved[7], 1,
    ];
    const mapped = multiply(invertSimilarity(normDst.matrix), multiply(normalized, normSrc.matrix));
    const scale = mapped[8];
    if (Math.abs(scale) < 1e-18) return mapped;
    return mapped.map((value) => value / scale);
}

export function applyHomography(matrix: number[], x: number, y: number): [number, number] {
    const weight = matrix[6] * x + matrix[7] * y + matrix[8];
    if (Math.abs(weight) < 1e-18) return [Number.NaN, Number.NaN];
    return [
        (matrix[0] * x + matrix[1] * y + matrix[2]) / weight,
        (matrix[3] * x + matrix[4] * y + matrix[5]) / weight,
    ];
}

/** Map a geographic point into image pixels. (0, 0) is the top-left edge of the image. */
export function geoToPixel(quad: Quad, width: number, height: number, point: LngLat): [number, number] {
    const matrix = homography(
        quad.map((corner) => [corner[0], corner[1]]),
        [[0, 0], [width, 0], [width, height], [0, height]],
    );
    return applyHomography(matrix, point[0], point[1]);
}

export function pointInQuad(quad: Quad, width: number, height: number, point: LngLat, epsilon = 1): boolean {
    const [u, v] = geoToPixel(quad, width, height, point);
    return u >= -epsilon && v >= -epsilon && u <= width + epsilon && v <= height + epsilon;
}

/**
 * True when the geographic point maps to an opaque source pixel.
 * Transparent / erased areas should let the map pan instead of moving the sheet.
 */
export function opaqueAtPoint(
    rgba: Uint8Array,
    width: number,
    height: number,
    quad: Quad,
    point: LngLat,
    minAlpha = 16,
): boolean {
    const [u, v] = geoToPixel(quad, width, height, point);
    const x = Math.floor(u);
    const y = Math.floor(v);
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return rgba[(y * width + x) * 4 + 3] >= minAlpha;
}
