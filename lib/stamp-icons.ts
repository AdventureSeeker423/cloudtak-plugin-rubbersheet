/**
 * Facility / life-safety stamp icons for the image editor.
 * Drawn as simplified ISO/NFPA-style symbols (not official certified glyphs),
 * plus numbered placards 0–20.
 */

export type FacilityStampKind =
    | 'first-aid'
    | 'aed'
    | 'master-key'
    | 'extinguisher'
    | 'hose-cabinet'
    | 'standpipe'
    | 'hydrant'
    | 'electric-shutoff'
    | 'gas-shutoff'
    | 'water-shutoff'
    | 'electrical-room'
    | 'hazmat';

export type NumberStampKind =
    | 'number-0' | 'number-1' | 'number-2' | 'number-3' | 'number-4'
    | 'number-5' | 'number-6' | 'number-7' | 'number-8' | 'number-9'
    | 'number-10' | 'number-11' | 'number-12' | 'number-13' | 'number-14'
    | 'number-15' | 'number-16' | 'number-17' | 'number-18' | 'number-19'
    | 'number-20';

export type StampKind = FacilityStampKind | NumberStampKind;

export type StampDef = {
    kind: StampKind;
    label: string;
    short: string;
};

export const FACILITY_STAMP_CATALOG: StampDef[] = [
    { kind: 'first-aid', label: 'First Aid Kit', short: 'First Aid' },
    { kind: 'aed', label: 'AED', short: 'AED' },
    { kind: 'master-key', label: 'Master Key Box', short: 'Key Box' },
    { kind: 'extinguisher', label: 'Fire Extinguisher', short: 'Extinguisher' },
    { kind: 'hose-cabinet', label: 'Fire Hose Cabinet', short: 'Hose' },
    { kind: 'standpipe', label: 'Standpipe', short: 'Standpipe' },
    { kind: 'hydrant', label: 'Fire Hydrant', short: 'Hydrant' },
    { kind: 'electric-shutoff', label: 'Electric Shutoff', short: 'Electric' },
    { kind: 'gas-shutoff', label: 'Gas Shutoff', short: 'Gas' },
    { kind: 'water-shutoff', label: 'Water Shutoff', short: 'Water' },
    { kind: 'electrical-room', label: 'Electrical Room', short: 'Elec. Room' },
    { kind: 'hazmat', label: 'Hazardous Material', short: 'Hazmat' },
];

export const NUMBER_STAMP_CATALOG: StampDef[] = Array.from({ length: 21 }, (_, n) => ({
    kind: `number-${n}` as NumberStampKind,
    label: `Placard ${n}`,
    short: String(n),
}));

/** @deprecated use FACILITY_STAMP_CATALOG + NUMBER_STAMP_CATALOG */
export const STAMP_CATALOG: StampDef[] = [
    ...FACILITY_STAMP_CATALOG,
    ...NUMBER_STAMP_CATALOG,
];

export function isNumberStamp(kind: StampKind): kind is NumberStampKind {
    return kind.startsWith('number-');
}

export function numberFromStamp(kind: NumberStampKind): number {
    return Number(kind.slice('number-'.length));
}

const GREEN = '#009B4C';
const RED = '#C8102E';
const BLUE = '#0055A5';
const YELLOW = '#F0C400';
const ORANGE = '#E87722';
const WHITE = '#FFFFFF';
const BLACK = '#1A1A1A';

export type PlacedStamp = {
    id: number;
    kind: StampKind;
    x: number;
    y: number;
    size: number;
};

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function fillBadge(
    ctx: CanvasRenderingContext2D,
    color: string,
    shape: 'square' | 'circle' | 'diamond' = 'square',
): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 0.08;
    if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, 0.46, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -0.48);
        ctx.lineTo(0.48, 0);
        ctx.lineTo(0, 0.48);
        ctx.lineTo(-0.48, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else {
        roundRect(ctx, -0.46, -0.46, 0.92, 0.92, 0.08);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

function drawFirstAid(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, GREEN);
    ctx.fillStyle = WHITE;
    ctx.fillRect(-0.1, -0.32, 0.2, 0.64);
    ctx.fillRect(-0.32, -0.1, 0.64, 0.2);
}

function drawAed(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, GREEN);
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(0, 0.28);
    ctx.bezierCurveTo(-0.34, 0.05, -0.34, -0.22, -0.12, -0.3);
    ctx.bezierCurveTo(-0.02, -0.34, 0.02, -0.22, 0, -0.12);
    ctx.bezierCurveTo(-0.02, -0.22, 0.02, -0.34, 0.12, -0.3);
    ctx.bezierCurveTo(0.34, -0.22, 0.34, 0.05, 0, 0.28);
    ctx.fill();
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.moveTo(0.02, -0.18);
    ctx.lineTo(-0.08, 0.02);
    ctx.lineTo(0.02, 0.02);
    ctx.lineTo(-0.04, 0.2);
    ctx.lineTo(0.14, -0.02);
    ctx.lineTo(0.02, -0.02);
    ctx.closePath();
    ctx.fill();
}

function drawMasterKey(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, BLUE);
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(-0.12, -0.08, 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.arc(-0.12, -0.08, 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, -0.12, 0.3, 0.1);
    ctx.fillRect(0.18, -0.02, 0.08, 0.12);
    ctx.fillRect(0.28, -0.02, 0.08, 0.16);
}

function drawExtinguisher(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, RED);
    ctx.fillStyle = WHITE;
    ctx.fillRect(-0.12, -0.1, 0.24, 0.38);
    ctx.beginPath();
    ctx.arc(0, -0.1, 0.12, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-0.04, -0.28, 0.08, 0.1);
    ctx.fillRect(0.04, -0.32, 0.2, 0.06);
    ctx.fillRect(-0.18, 0.02, 0.08, 0.16);
}

function drawHoseCabinet(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, RED);
    ctx.fillStyle = WHITE;
    roundRect(ctx, -0.28, -0.3, 0.56, 0.6, 0.04);
    ctx.fill();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.16, 0);
    ctx.lineTo(0.28, 0.12);
    ctx.stroke();
}

function drawStandpipe(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, RED);
    ctx.fillStyle = WHITE;
    ctx.fillRect(-0.08, -0.3, 0.16, 0.6);
    ctx.fillRect(-0.22, -0.22, 0.44, 0.1);
    ctx.fillRect(-0.22, 0.08, 0.44, 0.1);
    ctx.beginPath();
    ctx.arc(0, -0.32, 0.1, Math.PI, 0);
    ctx.fill();
}

function drawHydrant(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, RED);
    ctx.fillStyle = WHITE;
    ctx.fillRect(-0.12, -0.05, 0.24, 0.32);
    ctx.fillRect(-0.2, -0.18, 0.4, 0.14);
    ctx.fillRect(-0.06, -0.32, 0.12, 0.16);
    ctx.fillRect(-0.28, -0.12, 0.1, 0.08);
    ctx.fillRect(0.18, -0.12, 0.1, 0.08);
    ctx.fillRect(-0.18, 0.26, 0.36, 0.08);
}

function drawElectricShutoff(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, YELLOW);
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(0.02, -0.3);
    ctx.lineTo(-0.14, 0.02);
    ctx.lineTo(0.02, 0.02);
    ctx.lineTo(-0.06, 0.3);
    ctx.lineTo(0.18, -0.04);
    ctx.lineTo(0.02, -0.04);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(-0.28, 0.2);
    ctx.lineTo(0.28, 0.2);
    ctx.moveTo(0.18, 0.12);
    ctx.lineTo(0.28, 0.2);
    ctx.lineTo(0.18, 0.28);
    ctx.stroke();
}

function drawGasShutoff(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, YELLOW);
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(0, 0.28);
    ctx.quadraticCurveTo(-0.22, 0.05, -0.1, -0.12);
    ctx.quadraticCurveTo(0, -0.28, 0.02, -0.08);
    ctx.quadraticCurveTo(0.06, -0.28, 0.14, -0.1);
    ctx.quadraticCurveTo(0.26, 0.05, 0, 0.28);
    ctx.fill();
    ctx.fillRect(-0.28, -0.02, 0.16, 0.08);
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.arc(-0.28, 0.02, 0.07, 0, Math.PI * 2);
    ctx.stroke();
}

function drawWaterShutoff(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, BLUE);
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(0, -0.08);
    ctx.bezierCurveTo(0.18, 0.02, 0.18, 0.22, 0, 0.3);
    ctx.bezierCurveTo(-0.18, 0.22, -0.18, 0.02, 0, -0.08);
    ctx.fill();
    ctx.fillRect(-0.05, -0.3, 0.1, 0.22);
    ctx.fillRect(-0.18, -0.3, 0.36, 0.08);
}

function drawElectricalRoom(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, YELLOW);
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.07;
    roundRect(ctx, -0.3, -0.32, 0.6, 0.64, 0.04);
    ctx.stroke();
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(0.04, -0.18);
    ctx.lineTo(-0.1, 0.04);
    ctx.lineTo(0.02, 0.04);
    ctx.lineTo(-0.04, 0.22);
    ctx.lineTo(0.14, 0);
    ctx.lineTo(0.02, 0);
    ctx.closePath();
    ctx.fill();
}

function drawHazmat(ctx: CanvasRenderingContext2D): void {
    fillBadge(ctx, ORANGE, 'diamond');
    ctx.fillStyle = WHITE;
    ctx.fillRect(-0.05, -0.22, 0.1, 0.28);
    ctx.beginPath();
    ctx.arc(0, 0.18, 0.06, 0, Math.PI * 2);
    ctx.fill();
}

function drawNumberPlacard(ctx: CanvasRenderingContext2D, value: number): void {
    ctx.save();
    ctx.fillStyle = WHITE;
    roundRect(ctx, -0.46, -0.46, 0.92, 0.92, 0.06);
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.08;
    ctx.stroke();
    ctx.fillStyle = BLACK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Unit-space font: two-digit values need a slightly smaller face.
    ctx.font = value >= 10
        ? '700 0.5px "Segoe UI", "Arial Black", Arial, sans-serif'
        : '700 0.62px "Segoe UI", "Arial Black", Arial, sans-serif';
    ctx.fillText(String(value), 0, 0.04);
    ctx.restore();
}

const FACILITY_DRAWERS: Record<FacilityStampKind, (ctx: CanvasRenderingContext2D) => void> = {
    'first-aid': drawFirstAid,
    aed: drawAed,
    'master-key': drawMasterKey,
    extinguisher: drawExtinguisher,
    'hose-cabinet': drawHoseCabinet,
    standpipe: drawStandpipe,
    hydrant: drawHydrant,
    'electric-shutoff': drawElectricShutoff,
    'gas-shutoff': drawGasShutoff,
    'water-shutoff': drawWaterShutoff,
    'electrical-room': drawElectricalRoom,
    hazmat: drawHazmat,
};

/** Draw icon in unit space centered on the current transform origin. */
export function paintStamp(ctx: CanvasRenderingContext2D, kind: StampKind): void {
    if (isNumberStamp(kind)) {
        drawNumberPlacard(ctx, numberFromStamp(kind));
        return;
    }
    FACILITY_DRAWERS[kind](ctx);
}

/** Draw icon centered in a square canvas (for palette previews). */
export function drawStampPreview(ctx: CanvasRenderingContext2D, kind: StampKind, size: number): void {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(size, size);
    paintStamp(ctx, kind);
    ctx.restore();
}

/** Draw a stamp onto an existing context at image-pixel center/size. */
export function drawStampAt(
    ctx: CanvasRenderingContext2D,
    kind: StampKind,
    cx: number,
    cy: number,
    size: number,
    alpha = 1,
): void {
    const px = Math.max(8, size);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(px, px);
    paintStamp(ctx, kind);
    ctx.restore();
}

/**
 * Alpha-composite a stamp into an RGBA buffer. (cx, cy) is the center in image pixels.
 */
export function stampIntoRgba(
    rgba: Uint8Array,
    width: number,
    height: number,
    kind: StampKind,
    cx: number,
    cy: number,
    size: number,
): void {
    const px = Math.max(8, Math.round(size));
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(px / 2, px / 2);
    ctx.scale(px, px);
    paintStamp(ctx, kind);
    const stamped = ctx.getImageData(0, 0, px, px).data;
    const left = Math.round(cx - px / 2);
    const top = Math.round(cy - px / 2);
    for (let y = 0; y < px; y++) {
        const dy = top + y;
        if (dy < 0 || dy >= height) continue;
        for (let x = 0; x < px; x++) {
            const dx = left + x;
            if (dx < 0 || dx >= width) continue;
            const si = (y * px + x) * 4;
            const sa = stamped[si + 3] / 255;
            if (sa <= 0) continue;
            const di = (dy * width + dx) * 4;
            const da = rgba[di + 3] / 255;
            const outA = sa + da * (1 - sa);
            if (outA <= 0) {
                rgba[di] = 0;
                rgba[di + 1] = 0;
                rgba[di + 2] = 0;
                rgba[di + 3] = 0;
                continue;
            }
            rgba[di] = Math.round((stamped[si] * sa + rgba[di] * da * (1 - sa)) / outA);
            rgba[di + 1] = Math.round((stamped[si + 1] * sa + rgba[di + 1] * da * (1 - sa)) / outA);
            rgba[di + 2] = Math.round((stamped[si + 2] * sa + rgba[di + 2] * da * (1 - sa)) / outA);
            rgba[di + 3] = Math.round(outA * 255);
        }
    }
}

/** Nearest placed stamp within hit radius, or null. */
export function hitTestStamp(
    stamps: PlacedStamp[],
    x: number,
    y: number,
): PlacedStamp | null {
    let best: PlacedStamp | null = null;
    let bestDist = Infinity;
    for (const stamp of stamps) {
        const dist = Math.hypot(x - stamp.x, y - stamp.y);
        const radius = stamp.size * 0.55;
        if (dist <= radius && dist < bestDist) {
            best = stamp;
            bestDist = dist;
        }
    }
    return best;
}

export function cloneStamps(stamps: PlacedStamp[]): PlacedStamp[] {
    return stamps.map((stamp) => ({ ...stamp }));
}
