import { watch, type Component } from 'vue';
import { Marker } from 'maplibre-gl';
import type { Map as MapLibreMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl';
import { BOTTOM_KEY, LAYER_ID, SOURCE_ID } from './constants.ts';
import {
    cloneQuad,
    centroid,
    opaqueAtPoint,
    quadForView,
    rotateAroundCenter,
    scaleAboutCenter,
    scaleAboutOpposite,
    translateQuad,
    type CornerIndex,
    type LngLat,
    type Quad,
} from './geometry.ts';
import type { EditHistorySnapshot } from './edit-history.ts';
import { isCoarsePointer } from './device.ts';
import { handleBoxSizes } from './handle-size.ts';
import { canvasFromImageFile, fileBaseName, isImage, isPdf, rasterFromCanvas } from './image-file.ts';
import { makeExport } from './make-export.ts';
import { uploadMissionFile } from './missions.ts';
import { ignoreCompatMouse, shouldStartTouchMove } from './move-mode.ts';
import { opacityState, watchOpacity } from './opacity.ts';
import AdjustBar from './AdjustBar.vue';
import { importAsOverlay } from './overlay.ts';
import { closePdf, openPdf, renderPdfPage, renderPdfThumbnail } from './pdf-render.ts';
import { sheetUi, type MissionChoice } from './ui-state.ts';
import { downloadBlob } from '../../../src/std.ts';
import { isNativePlatform } from '../../../src/utils/capacitor.ts';
import type { Raster } from './warp.ts';
import { resolveCornerDragMode, type CornerDragMode } from './warp-mode.ts';

export interface SheetHost {
    map: MapLibreMap;
    bottomBar: {
        add: (item: { key: string; component: Component }) => void;
        remove: (key: string) => void;
    };
}

let host: SheetHost | null = null;
let quad: Quad | null = null;
let source: Raster | null = null;
/** Canvas fed to a MapLibre canvas source (no URL fetch — CSP blocks data:/blob: connect-src). */
let overlayCanvas: HTMLCanvasElement | null = null;
/** Pixels from the first load of this sheet — Revert target across edit sessions. */
let pristineRgba: Uint8Array | null = null;
/** Undo/redo stacks persisted when the image editor saves. */
let savedEditHistory: EditHistorySnapshot | null = null;
let markers: Marker[] = [];
let knob: Marker | null = null;
let barOn = false;
let dragging = false;
/** Map gestures that the active drag switched off and must switch back on. */
const gestureLocks = { pan: false, zoomRotate: false, pitch: false };
/** Ends the active handle or sheet drag without side effects on the quad (cleanup paths). */
let cancelActiveDrag: (() => void) | null = null;
let stopAdjustWatch: (() => void) | null = null;
/** Time of the latest touchstart on the map, to ignore the compatibility mouse events after it. */
let lastTouchAt = -Infinity;
let listening = false;
let modListening = false;
let shiftHeld = false;
let altHeld = false;
/** Active corner drag — mode follows Shift/Alt even after pointer-down. */
let cornerDrag: {
    index: CornerIndex;
    origin: Quad;
    target: HTMLElement;
    lastCursor: LngLat;
} | null = null;

/** Undo/redo for map transforms (move, corner, scale, rotate). */
const TRANSFORM_HISTORY_CAP = 40;
let transformPast: Quad[] = [];
let transformFuture: Quad[] = [];

/** Diagonal resize cursors read as scale handles for each corner. */
const SCALE_CURSOR: Record<CornerIndex, string> = {
    0: 'nwse-resize',
    1: 'nesw-resize',
    2: 'nwse-resize',
    3: 'nesw-resize',
};

function quadsEqual(a: Quad, b: Quad): boolean {
    for (let i = 0; i < 4; i++) {
        if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
    }
    return true;
}

function syncTransformFlags(): void {
    sheetUi.canUndoTransform = transformPast.length > 0 && !dragging;
    sheetUi.canRedoTransform = transformFuture.length > 0 && !dragging;
}

function clearTransformHistory(): void {
    transformPast = [];
    transformFuture = [];
    syncTransformFlags();
}

function pushTransformHistory(): void {
    if (!quad) return;
    transformPast.push(cloneQuad(quad));
    if (transformPast.length > TRANSFORM_HISTORY_CAP) transformPast.shift();
    transformFuture = [];
    syncTransformFlags();
}

/** Drop the pre-gesture snapshot when the drag did not change the quad. */
function discardTransformPushIfUnchanged(origin: Quad): void {
    if (!quad || !transformPast.length) return;
    if (quadsEqual(quad, origin)) transformPast.pop();
    syncTransformFlags();
}

export function undoSheetTransform(): boolean {
    if (!quad || dragging || !transformPast.length) return false;
    transformFuture.push(cloneQuad(quad));
    quad = transformPast.pop()!;
    sync();
    syncTransformFlags();
    return true;
}

export function redoSheetTransform(): boolean {
    if (!quad || dragging || !transformFuture.length) return false;
    transformPast.push(cloneQuad(quad));
    if (transformPast.length > TRANSFORM_HISTORY_CAP) transformPast.shift();
    quad = transformFuture.pop()!;
    sync();
    syncTransformFlags();
    return true;
}

function mapOrThrow(): MapLibreMap {
    if (!host) throw new Error('The map is not ready yet');
    return host.map;
}

function pointerToLngLat(event: PointerEvent, liftPx = 0): LngLat {
    const map = mapOrThrow();
    const rect = map.getCanvas().getBoundingClientRect();
    const projected = map.unproject([event.clientX - rect.left, event.clientY - rect.top - liftPx]);
    return [projected.lng, projected.lat];
}

function screenAngle(origin: LngLat, point: LngLat): number {
    const map = mapOrThrow();
    const start = map.project(origin);
    const end = map.project(point);
    return Math.atan2(end.y - start.y, end.x - start.x);
}

function knobLngLat(): LngLat | null {
    if (!host || !quad) return null;
    const mid: LngLat = [
        (quad[0][0] + quad[1][0]) / 2,
        (quad[0][1] + quad[1][1]) / 2,
    ];
    const center = centroid(quad);
    const midPx = host.map.project(mid);
    const centerPx = host.map.project(center);
    let dx = midPx.x - centerPx.x;
    let dy = midPx.y - centerPx.y;
    const length = Math.hypot(dx, dy) || 1;
    dx = (dx / length) * 36;
    dy = (dy / length) * 36;
    const projected = host.map.unproject([midPx.x + dx, midPx.y + dy]);
    return [projected.lng, projected.lat];
}

function sync(): void {
    if (!host || !quad) return;
    const current = quad;
    const overlay = host.map.getSource(SOURCE_ID) as { type?: string; setCoordinates?: (coords: Quad) => void } | undefined;
    if ((overlay?.type === 'canvas' || overlay?.type === 'image') && overlay.setCoordinates) {
        overlay.setCoordinates(current);
    }
    markers.forEach((marker, index) => {
        marker.setLngLat(current[index]);
    });
    const knobAt = knobLngLat();
    if (knob && knobAt) knob.setLngLat(knobAt);
    applyHandleSizes();
}

function onMapMove(): void {
    const knobAt = knobLngLat();
    if (knob && knobAt) knob.setLngLat(knobAt);
    applyHandleSizes();
}

/**
 * Re-enable the map gestures that the drag switched off. Safe to call twice.
 * The locks are a record, not one flag, so a second drag can never overwrite
 * what the first one has to restore.
 */
function endGestureLock(): void {
    dragging = false;
    cornerDrag = null;
    if (host) {
        if (gestureLocks.pan) host.map.dragPan.enable();
        if (gestureLocks.zoomRotate) host.map.touchZoomRotate.enable();
        if (gestureLocks.pitch) host.map.touchPitch.enable();
    }
    gestureLocks.pan = false;
    gestureLocks.zoomRotate = false;
    gestureLocks.pitch = false;
    syncTransformFlags();
}

/**
 * Take the map gestures away from MapLibre while a handle or the sheet is dragged.
 * A second finger then cannot pan, zoom, rotate or tilt the map under the drag.
 * `keepMultiTouch` leaves pinch and rotate on, so a second finger can take over a touch move.
 */
function beginGestureLock(options: { keepMultiTouch?: boolean } = {}): boolean {
    if (!host || dragging) return false;
    dragging = true;
    syncTransformFlags();
    const map = host.map;
    gestureLocks.pan = map.dragPan.isEnabled();
    if (gestureLocks.pan) map.dragPan.disable();
    if (!options.keepMultiTouch) {
        gestureLocks.zoomRotate = map.touchZoomRotate.isEnabled();
        if (gestureLocks.zoomRotate) map.touchZoomRotate.disable();
        gestureLocks.pitch = map.touchPitch.isEnabled();
        if (gestureLocks.pitch) map.touchPitch.disable();
    }
    return true;
}

/** Stop a drag that is still running (sheet removed, plugin disabled, tab hidden, handles hidden). */
function cancelDrag(): void {
    const cancel = cancelActiveDrag;
    cancelActiveDrag = null;
    cancel?.();
    // Nothing owns the locks any more; restore anything left over.
    endGestureLock();
}

/** The click that follows a mouse drag must not select anything on the map. */
function swallowClick(): void {
    host?.map.once('click', (event) => {
        event.preventDefault();
        event.originalEvent.stopPropagation();
    });
}

function beginMove(start: LngLat, via: 'mouse' | 'touch'): void {
    if (!host || !quad) return;
    const map = host.map;
    if (!beginGestureLock({ keepMultiTouch: via === 'touch' })) return;
    const origin = cloneQuad(quad);
    pushTransformHistory();
    // On touch only the first finger counts: MapLibre reports the centroid of all
    // fingers as `lngLat`, which would make the sheet jump when a second one lands.
    const move = (event: MapMouseEvent | MapTouchEvent) => {
        const at = 'lngLats' in event && event.lngLats.length ? event.lngLats[0] : event.lngLat;
        quad = translateQuad(origin, at.lng - start[0], at.lat - start[1]);
        sync();
    };
    let finished = false;
    const finish = (swallow: boolean) => {
        if (finished) return;
        finished = true;
        map.off('mousemove', move);
        map.off('touchmove', move);
        map.off('mouseup', up);
        map.off('touchend', up);
        map.off('touchcancel', up);
        map.off('touchstart', secondTouch);
        cancelActiveDrag = null;
        discardTransformPushIfUnchanged(origin);
        endGestureLock();
        if (swallow) swallowClick();
    };
    const up = () => finish(via === 'mouse');
    // A second finger hands the gesture to the map (pinch, rotate, pan).
    // The sheet stays where it got to.
    const secondTouch = (event: MapTouchEvent) => {
        if (event.originalEvent.touches.length > 1) finish(false);
    };
    cancelActiveDrag = () => finish(false);
    map.on('mousemove', move);
    map.on('touchmove', move);
    map.on('mouseup', up);
    map.on('touchend', up);
    map.on('touchcancel', up);
    if (via === 'touch') map.on('touchstart', secondTouch);
}

function hitSheet(point: LngLat): boolean {
    if (!quad || !source) return false;
    return opaqueAtPoint(source.rgba, source.width, source.height, quad, point);
}

function onMapMouseDown(event: MapMouseEvent): void {
    // Compatibility mouse events after a touch the map handled must not start a move.
    if (ignoreCompatMouse(performance.now(), lastTouchAt)) return;
    if (!quad || !source || dragging || !sheetUi.adjusting) return;
    if (event.originalEvent.button !== 0) return;
    const point: LngLat = [event.lngLat.lng, event.lngLat.lat];
    if (!hitSheet(point)) return;
    event.preventDefault();
    beginMove(point, 'mouse');
}

function onTouchStart(event: MapTouchEvent): void {
    lastTouchAt = performance.now();
    if (!quad || !source || dragging) return;
    const touches = event.originalEvent.touches.length;
    // Move mode off: leave the touch alone so MapLibre pans and zooms, even over a large sheet.
    if (!shouldStartTouchMove({ moveMode: sheetUi.moveMode, adjusting: sheetUi.adjusting, touches, hit: true })) return;
    const first = event.lngLats[0] ?? event.lngLat;
    const point: LngLat = [first.lng, first.lat];
    if (!hitSheet(point)) return;
    event.preventDefault();
    beginMove(point, 'touch');
}

/**
 * Follow one pointer for a handle drag. Other pointers (a second finger) are ignored,
 * and the map keeps no gesture of its own until the drag ends, is cancelled, loses
 * pointer capture, or the sheet goes away.
 * @returns false when another drag is running or the pointer cannot be tracked
 */
function trackPointer(
    event: PointerEvent,
    onMove: (ev: PointerEvent) => void,
    onEnd?: () => void,
): boolean {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return false;
    event.preventDefault();
    event.stopPropagation();
    if (!beginGestureLock()) return false;
    const id = event.pointerId;
    try {
        target.setPointerCapture(id);
    } catch {
        // The pointer is already gone; the drag ends on the first event below.
    }
    let finished = false;
    const move = (ev: PointerEvent) => {
        if (ev.pointerId === id) onMove(ev);
    };
    const finish = (swallow: boolean) => {
        if (finished) return;
        finished = true;
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', end);
        target.removeEventListener('pointercancel', end);
        target.removeEventListener('lostpointercapture', end);
        try {
            target.releasePointerCapture(id);
        } catch {
            // Already released.
        }
        cancelActiveDrag = null;
        onEnd?.();
        endGestureLock();
        if (swallow) swallowClick();
    };
    const end = (ev: Event) => {
        if (ev instanceof PointerEvent && ev.pointerId !== id) return;
        // Only a mouse drag is followed by a click that must not reach the map; a touch drag is not.
        finish(ev.type === 'pointerup' && ev instanceof PointerEvent && ev.pointerType === 'mouse');
    };
    cancelActiveDrag = () => finish(false);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
    target.addEventListener('lostpointercapture', end);
    return true;
}

function scaleModeActive(ev?: { shiftKey?: boolean; altKey?: boolean }): boolean {
    return cornerDragMode(ev) !== 'corner';
}

function cornerDragMode(ev?: { shiftKey?: boolean; altKey?: boolean }): CornerDragMode {
    return resolveCornerDragMode(sheetUi.warpMode, !!(ev?.altKey || altHeld), !!(ev?.shiftKey || shiftHeld));
}

function applyCornerDrag(mode: CornerDragMode, origin: Quad, index: CornerIndex, cursor: LngLat): Quad {
    if (mode === 'center') return scaleAboutCenter(origin, index, cursor);
    if (mode === 'opposite') return scaleAboutOpposite(origin, index, cursor);
    const next = cloneQuad(origin);
    next[index] = cursor;
    return next;
}

function cornerCursor(index: CornerIndex, scale: boolean): string {
    return scale ? SCALE_CURSOR[index] : 'grab';
}

function refreshCornerCursors(ev?: { shiftKey?: boolean; altKey?: boolean }): void {
    const scale = scaleModeActive(ev);
    markers.forEach((marker, index) => {
        const el = marker.getElement();
        if (cornerDrag && cornerDrag.index === index) {
            el.style.cursor = scale ? SCALE_CURSOR[index] : 'grabbing';
            return;
        }
        el.style.cursor = cornerCursor(index as CornerIndex, scale);
    });
}

function onModifierKey(event: KeyboardEvent): void {
    shiftHeld = event.shiftKey;
    altHeld = event.altKey;
    if (cornerDrag) {
        const mode = cornerDragMode(event);
        quad = applyCornerDrag(mode, cornerDrag.origin, cornerDrag.index, cornerDrag.lastCursor);
        sync();
    }
    refreshCornerCursors(event);
}

function onWindowBlur(): void {
    shiftHeld = false;
    altHeld = false;
    if (cornerDrag) {
        quad = applyCornerDrag(cornerDragMode(), cornerDrag.origin, cornerDrag.index, cornerDrag.lastCursor);
        sync();
    }
    // The pointer-up may never arrive once the window lost focus.
    cancelDrag();
    refreshCornerCursors();
}

function onVisibilityChange(): void {
    if (document.hidden) cancelDrag();
}

function onSheetKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return;
    }
    // Image editor owns Ctrl+Z while open.
    if (document.body.classList.contains('rubber-ie-open')) return;
    if (!sheetUi.hasSheet || !quad) return;

    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
        if (undoSheetTransform()) event.preventDefault();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        if (redoSheetTransform()) event.preventDefault();
    }
}

function listenModifiers(): void {
    if (modListening) return;
    window.addEventListener('keydown', onModifierKey);
    window.addEventListener('keyup', onModifierKey);
    window.addEventListener('keydown', onSheetKeyDown);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    modListening = true;
}

function unlistenModifiers(): void {
    if (!modListening) return;
    window.removeEventListener('keydown', onModifierKey);
    window.removeEventListener('keyup', onModifierKey);
    window.removeEventListener('keydown', onSheetKeyDown);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    modListening = false;
    shiftHeld = false;
    altHeld = false;
}

/** How far above the fingertip a corner is held while dragging on touch. */
const CORNER_LIFT_PX = 56;

/** Crosshair ring drawn on the dragged corner so the exact spot is visible above the finger. */
function aimRing(): HTMLDivElement {
    const ring = document.createElement('div');
    ring.style.position = 'absolute';
    ring.style.left = '50%';
    ring.style.top = '50%';
    ring.style.width = '48px';
    ring.style.height = '48px';
    ring.style.transform = 'translate(-50%, -50%)';
    ring.style.boxSizing = 'border-box';
    ring.style.borderRadius = '50%';
    ring.style.border = '2px solid #ffffff';
    ring.style.boxShadow = '0 0 0 1px #111111, inset 0 0 0 1px #111111';
    ring.style.background = 'linear-gradient(#ffffff, #ffffff) center / 1px 100% no-repeat, linear-gradient(#ffffff, #ffffff) center / 100% 1px no-repeat';
    ring.style.pointerEvents = 'none';
    return ring;
}

function startCorner(event: PointerEvent, index: CornerIndex): void {
    // A second finger on another handle must not start a second drag.
    if (!quad || dragging) return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const origin = cloneQuad(quad);
    pushTransformHistory();
    // A finger covers the corner it drags, so on touch the corner rides above the fingertip.
    const lift = event.pointerType === 'touch' && isCoarsePointer() ? CORNER_LIFT_PX : 0;
    const startCursor = lift ? origin[index] : pointerToLngLat(event);
    const mode = cornerDragMode(event);
    const ring = lift ? aimRing() : null;
    if (ring) target.appendChild(ring);
    const tracking = trackPointer(event, (ev) => {
        if (!cornerDrag) return;
        cornerDrag.lastCursor = pointerToLngLat(ev, lift);
        const nextMode = cornerDragMode(ev);
        target.style.cursor = nextMode === 'corner' ? 'grabbing' : SCALE_CURSOR[index];
        quad = applyCornerDrag(nextMode, cornerDrag.origin, index, cornerDrag.lastCursor);
        sync();
    }, () => {
        ring?.remove();
        discardTransformPushIfUnchanged(origin);
    });
    if (!tracking) {
        ring?.remove();
        discardTransformPushIfUnchanged(origin);
        return;
    }
    cornerDrag = { index, origin, target, lastCursor: startCursor };
    target.style.cursor = mode === 'corner' ? 'grabbing' : SCALE_CURSOR[index];
}

function startRotate(event: PointerEvent): void {
    if (!quad || dragging) return;
    const origin = cloneQuad(quad);
    pushTransformHistory();
    const center = centroid(origin);
    const startAngle = screenAngle(center, pointerToLngLat(event));
    const tracking = trackPointer(event, (ev) => {
        const delta = screenAngle(center, pointerToLngLat(ev)) - startAngle;
        quad = rotateAroundCenter(origin, -delta);
        sync();
    }, () => {
        discardTransformPushIfUnchanged(origin);
    });
    if (!tracking) discardTransformPushIfUnchanged(origin);
}

/** Minimum touch target edge for the transparent hit area around each handle. */
const HANDLE_HIT_PX = 44;
/** Visible dot edge (border included) on fine and coarse pointers. */
const CORNER_DOT_FINE_PX = 20;
const CORNER_DOT_COARSE_PX = 24;
const KNOB_DOT_FINE_PX = 32;
const KNOB_DOT_COARSE_PX = 36;

/**
 * The marker element is a transparent hit box (44 px) that owns the pointer
 * handlers and cursor; the visible dot is a non-interactive child.
 */
function hitBoxElement(title: string): HTMLDivElement {
    const element = document.createElement('div');
    element.title = title;
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.width = `${HANDLE_HIT_PX}px`;
    element.style.height = `${HANDLE_HIT_PX}px`;
    element.style.cursor = 'grab';
    element.style.touchAction = 'none';
    // Touches that start on a handle never reach MapLibre's container listeners,
    // so a handle drag cannot start a map pan, zoom or tap-to-zoom.
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        element.addEventListener(type, (event) => event.stopPropagation(), { passive: false });
    }
    return element;
}

function handleElement(title: string, fill: string): HTMLDivElement {
    const element = hitBoxElement(title);
    const dot = document.createElement('div');
    dot.style.boxSizing = 'border-box';
    dot.style.borderRadius = '50%';
    dot.style.background = fill;
    dot.style.border = '2px solid #111111';
    dot.style.boxShadow = '0 0 0 1px #ffffff';
    dot.style.pointerEvents = 'none';
    element.appendChild(dot);
    return element;
}

function rotateHandleElement(): HTMLDivElement {
    const element = hitBoxElement('Drag to rotate');
    const dot = document.createElement('div');
    dot.style.boxSizing = 'border-box';
    dot.style.display = 'flex';
    dot.style.alignItems = 'center';
    dot.style.justifyContent = 'center';
    dot.style.borderRadius = '50%';
    dot.style.background = '#206bc4';
    dot.style.border = '2px solid #ffffff';
    dot.style.boxShadow = '0 0 0 1px #111111';
    dot.style.pointerEvents = 'none';
    dot.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>`;
    element.appendChild(dot);
    return element;
}

/**
 * Size the dots for the pointer type and shrink the hit boxes on small sheets
 * so neighbouring boxes never overlap (the dots shrink only if their box does).
 */
function applyHandleSizes(): void {
    if (!host || !markers.length) return;
    const map = host.map;
    const coarse = isCoarsePointer();
    const cornerDot = coarse ? CORNER_DOT_COARSE_PX : CORNER_DOT_FINE_PX;
    const knobDot = coarse ? KNOB_DOT_COARSE_PX : KNOB_DOT_FINE_PX;
    const elements = markers.map((marker) => marker.getElement());
    const points = markers.map((marker) => map.project(marker.getLngLat()));
    const dots: number[] = markers.map(() => cornerDot);
    if (knob) {
        elements.push(knob.getElement());
        points.push(map.project(knob.getLngLat()));
        dots.push(knobDot);
    }
    const sizes = handleBoxSizes(points, dots, HANDLE_HIT_PX);
    elements.forEach((element, i) => {
        element.style.width = `${sizes.box[i]}px`;
        element.style.height = `${sizes.box[i]}px`;
        const dot = element.firstElementChild;
        if (dot instanceof HTMLElement) {
            dot.style.width = `${sizes.dot[i]}px`;
            dot.style.height = `${sizes.dot[i]}px`;
        }
    });
}

/** Handles are hidden while the sheet is locked (after Done on the Adjust bar). */
function applyHandleVisibility(): void {
    const visibility = sheetUi.adjusting ? '' : 'hidden';
    for (const marker of markers) marker.getElement().style.visibility = visibility;
    if (knob) knob.getElement().style.visibility = visibility;
}

function ensureMarkers(): void {
    const mapHost = host;
    if (!mapHost || !quad || markers.length) return;
    const current = quad;
    const corners: CornerIndex[] = [0, 1, 2, 3];
    markers = corners.map((index) => {
        const element = handleElement(
            'Drag to move this corner. Hold Shift to scale about the opposite corner, or Alt to scale from the center (works mid-drag).',
            '#ffffff',
        );
        element.style.cursor = cornerCursor(index, scaleModeActive());
        element.addEventListener('pointerenter', (event) => {
            element.style.cursor = cornerCursor(index, scaleModeActive(event));
        });
        element.addEventListener('pointermove', (event) => {
            if (dragging) return;
            element.style.cursor = cornerCursor(index, scaleModeActive(event));
        });
        element.addEventListener('pointerdown', (event) => startCorner(event, index));
        element.addEventListener('pointerup', (event) => {
            element.style.cursor = cornerCursor(index, scaleModeActive(event));
        });
        return new Marker({ element, anchor: 'center' }).setLngLat(current[index]).addTo(mapHost.map);
    });
    const knobElement = rotateHandleElement();
    knobElement.addEventListener('pointerdown', startRotate);
    const knobAt = knobLngLat() ?? current[0];
    knob = new Marker({ element: knobElement, anchor: 'center' }).setLngLat(knobAt).addTo(mapHost.map);
    applyHandleSizes();
    applyHandleVisibility();
    listenModifiers();
}

function removeMarkers(): void {
    cancelDrag();
    for (const marker of markers) marker.remove();
    markers = [];
    knob?.remove();
    knob = null;
    unlistenModifiers();
}

function ensureBar(): void {
    if (!host || barOn) return;
    host.bottomBar.add({ key: BOTTOM_KEY, component: AdjustBar });
    barOn = true;
}

function hideBar(): void {
    if (!host || !barOn) return;
    try {
        host.bottomBar.remove(BOTTOM_KEY);
    } catch {
        // The bar may already be gone if the plugin is shutting down.
    }
    barOn = false;
}

function applyOpacity(value: number): void {
    if (host?.map.getLayer(LAYER_ID)) {
        host.map.setPaintProperty(LAYER_ID, 'raster-opacity', value / 100);
    }
}

function applyFlatWarp(): void {
    const overlay = host?.map.getSource(SOURCE_ID) as { setWarp?: (mode: string) => void } | undefined;
    // Flat = bilinear rubber-sheet. Default "auto"/"perspective" foreshortens the
    // whole image when one corner moves, which feels like unwanted scaling.
    overlay?.setWarp?.('flat');
}

function attachRasterLayer(): void {
    if (!host || !quad || !overlayCanvas) return;
    const map = host.map;
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    // Canvas source reads pixels in-process. Image/data/blob URLs are blocked by
    // CloudTAK's connect-src CSP when MapLibre tries to fetch them.
    map.addSource(SOURCE_ID, {
        type: 'canvas',
        canvas: overlayCanvas,
        animate: false,
        coordinates: quad,
    });
    applyFlatWarp();
    map.addLayer({
        id: LAYER_ID,
        type: 'raster',
        source: SOURCE_ID,
        paint: {
            'raster-opacity': opacityState.value / 100,
            'raster-fade-duration': 0,
        },
    });
}

function onStyleLoad(): void {
    if (!overlayCanvas || !quad || !source) return;
    attachRasterLayer();
    ensureBar();
    sync();
}

async function showCanvas(canvas: HTMLCanvasElement, resetQuad: boolean): Promise<void> {
    const map = mapOrThrow();
    source = rasterFromCanvas(canvas);
    // New file / PDF page — reset pristine original and edit history.
    pristineRgba = source.rgba.slice();
    savedEditHistory = null;
    clearTransformHistory();
    const bounds = map.getBounds();
    const center = map.getCenter();
    if (resetQuad || !quad) {
        quad = quadForView(
            center.lng,
            center.lat,
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
            source.width,
            source.height,
        );
    }
    const replaced = overlayCanvas;
    overlayCanvas = canvas;
    attachRasterLayer();
    freeCanvas(replaced, canvas);
    ensureMarkers();
    sync();
    ensureBar();
    sheetUi.hasSheet = true;
    sheetUi.adjusting = true;
    sheetUi.pageThumbs = null;
}

/** Release the backing store of a canvas the map no longer uses (phones have little memory). */
function freeCanvas(old: HTMLCanvasElement | null, keep: HTMLCanvasElement | null): void {
    if (!old || old === keep) return;
    old.width = 0;
    old.height = 0;
}

export type EditSession = {
    source: HTMLCanvasElement;
    pristine: Uint8Array;
    history: EditHistorySnapshot | null;
};

/** Current sheet canvas plus pristine original / undo stacks for the image editor. */
export function getEditSession(): EditSession | null {
    if (!overlayCanvas || !source) return null;
    const clone = document.createElement('canvas');
    clone.width = overlayCanvas.width;
    clone.height = overlayCanvas.height;
    const ctx = clone.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(overlayCanvas, 0, 0);
    const pristine = pristineRgba && pristineRgba.length === source.rgba.length
        ? pristineRgba.slice()
        : source.rgba.slice();
    return {
        source: clone,
        pristine,
        history: savedEditHistory
            ? {
                past: savedEditHistory.past.map((entry) => entry.slice()),
                future: savedEditHistory.future.map((entry) => entry.slice()),
            }
            : null,
    };
}

/** @deprecated use getEditSession */
export function getEditSnapshot(): HTMLCanvasElement | null {
    return getEditSession()?.source ?? null;
}

/** Push edited pixels to the map without resetting corners; keep pristine + undo. */
export function applyEditedCanvas(
    canvas: HTMLCanvasElement,
    history?: EditHistorySnapshot | null,
): void {
    if (!host || !quad) throw new Error('The map is not ready yet');
    source = rasterFromCanvas(canvas);
    const replaced = overlayCanvas;
    overlayCanvas = canvas;
    if (!pristineRgba || pristineRgba.length !== source.rgba.length) {
        pristineRgba = source.rgba.slice();
    }
    // The editor hands over its undo frames when it saves, so they are kept as they are.
    savedEditHistory = history ?? null;
    attachRasterLayer();
    freeCanvas(replaced, canvas);
    sync();
    sheetUi.hasSheet = true;
}

function message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

async function loadPageThumbs(count: number): Promise<void> {
    sheetUi.pageThumbs = Array.from({ length: count }, () => null);
    for (let page = 1; page <= count; page++) {
        if (sheetUi.pageThumbs === null) return;
        try {
            const thumb = await renderPdfThumbnail(page);
            if (sheetUi.pageThumbs === null) return;
            sheetUi.pageThumbs[page - 1] = thumb;
        } catch {
            if (sheetUi.pageThumbs === null) return;
            sheetUi.pageThumbs[page - 1] = '';
        }
    }
}

export function bind(next: SheetHost): void {
    if (host === next) return;
    if (host) detach();
    host = next;
    watchOpacity(applyOpacity);
    host.map.on('mousedown', onMapMouseDown);
    host.map.on('touchstart', onTouchStart);
    host.map.on('move', onMapMove);
    host.map.on('style.load', onStyleLoad);
    listening = true;
    stopAdjustWatch = watch(() => sheetUi.adjusting, (on) => {
        if (!on) {
            cancelDrag();
            sheetUi.moveMode = false;
        }
        applyHandleVisibility();
    }, { flush: 'sync' });
}

export function detach(): void {
    stopAdjustWatch?.();
    stopAdjustWatch = null;
    if (host && listening) {
        host.map.off('mousedown', onMapMouseDown);
        host.map.off('touchstart', onTouchStart);
        host.map.off('move', onMapMove);
        host.map.off('style.load', onStyleLoad);
        listening = false;
    }
    clearMap();
    hideBar();
    host = null;
    void closePdf();
}

function clearMap(): void {
    if (host) {
        const map = host.map;
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    }
    removeMarkers();
    overlayCanvas = null;
    pristineRgba = null;
    savedEditHistory = null;
    clearTransformHistory();
    quad = null;
    source = null;
    sheetUi.hasSheet = false;
    sheetUi.adjusting = true;
    sheetUi.moveMode = false;
    sheetUi.page = 1;
    sheetUi.pageCount = 1;
    sheetUi.pageThumbs = null;
    sheetUi.pickerOpen = false;
}

export async function clearSheet(): Promise<void> {
    clearMap();
    hideBar();
    sheetUi.name = '';
    sheetUi.error = '';
    sheetUi.success = '';
    sheetUi.status = '';
    await closePdf();
}

export async function loadUserFile(file: File): Promise<void> {
    sheetUi.error = '';
    sheetUi.success = '';
    sheetUi.status = isPdf(file) ? 'Reading the PDF…' : 'Loading the image…';
    sheetUi.pickerOpen = false;
    sheetUi.pageThumbs = null;
    sheetUi.busy = true;
    try {
        sheetUi.name = fileBaseName(file.name);
        if (isPdf(file)) {
            const pages = await openPdf(await file.arrayBuffer());
            sheetUi.pageCount = pages;
            sheetUi.page = 1;
            if (pages > 1) {
                sheetUi.busy = false;
                void loadPageThumbs(pages);
                return;
            }
            await showCanvas(await renderPdfPage(1), true);
            return;
        }
        if (!isImage(file)) throw new Error('Use a PNG, JPEG, WebP, GIF, or PDF');
        await closePdf();
        sheetUi.pageCount = 1;
        sheetUi.page = 1;
        await showCanvas(await canvasFromImageFile(file), true);
    } catch (err) {
        sheetUi.error = message(err);
    } finally {
        sheetUi.status = '';
        sheetUi.busy = false;
    }
}

export async function setPdfPage(page: number): Promise<void> {
    if (sheetUi.pageCount < 1) return;
    const next = Math.min(sheetUi.pageCount, Math.max(1, page));
    const resetQuad = !sheetUi.hasSheet;
    sheetUi.busy = true;
    sheetUi.error = '';
    sheetUi.success = '';
    sheetUi.status = `Rendering page ${next}…`;
    try {
        await showCanvas(await renderPdfPage(next), resetQuad);
        sheetUi.page = next;
    } catch (err) {
        sheetUi.error = message(err);
    } finally {
        sheetUi.status = '';
        sheetUi.busy = false;
    }
}

export function openPagePicker(): void {
    if (sheetUi.pageCount < 2 || sheetUi.busy) return;
    void loadPageThumbs(sheetUi.pageCount);
}

export function closePagePicker(): void {
    sheetUi.pageThumbs = null;
}

async function currentFile(): Promise<{ filename: string; bytes: Uint8Array; mime: string }> {
    if (!source || !quad || !sheetUi.exportType) throw new Error('Choose an export file type');
    sheetUi.status = 'Building the export…';
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
    return makeExport(sheetUi.exportType, {
        name: sheetUi.name,
        opacity: opacityState.value,
        quad,
        source,
    });
}

/** @returns true when the download finished successfully */
export async function downloadCurrent(): Promise<boolean> {
    if (!sheetUi.hasSheet || !sheetUi.exportType || sheetUi.busy) return false;
    sheetUi.busy = true;
    sheetUi.error = '';
    sheetUi.success = '';
    try {
        const file = await currentFile();
        const blob = new Blob([file.bytes.slice()], { type: file.mime });
        // In the native apps an anchor download goes nowhere useful, so offer the share sheet
        // (Save to Files, AirDrop, ...) when the WebView supports sharing files.
        if (isNativePlatform()) {
            const shareable = new File([blob], file.filename, { type: file.mime });
            if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareable] })) {
                try {
                    await navigator.share({ files: [shareable], title: file.filename });
                } catch (err) {
                    // Closing the share sheet is not an error.
                    if (err instanceof DOMException && err.name === 'AbortError') return false;
                    throw err;
                }
                sheetUi.success = `Shared ${file.filename}`;
                return true;
            }
        }
        // Web: a plain file download through the host helper (an empty Response has no Content-Disposition).
        downloadBlob(blob, new Response(null), file.filename);
        sheetUi.success = `Downloaded ${file.filename}`;
        return true;
    } catch (err) {
        sheetUi.error = message(err);
        return false;
    } finally {
        sheetUi.status = '';
        sheetUi.busy = false;
    }
}

/** Opens the Add to Data Sync picker; the picker loads the list itself. */
export function openMissionPicker(): void {
    if (!sheetUi.hasSheet || !sheetUi.exportType || sheetUi.busy) return;
    sheetUi.error = '';
    sheetUi.pickerOpen = true;
}

export function closeMissionPicker(): void {
    sheetUi.pickerOpen = false;
}

/**
 * Builds the export once and adds it to each chosen data sync in turn.
 * Stops at the first failure and names that data sync in the error.
 * @returns true when every upload finished successfully
 */
export async function uploadCurrent(missions: MissionChoice[]): Promise<boolean> {
    if (!sheetUi.hasSheet || !sheetUi.exportType || sheetUi.busy || missions.length === 0) return false;
    sheetUi.busy = true;
    sheetUi.error = '';
    sheetUi.success = '';
    sheetUi.pickerOpen = false;
    let done = 0;
    try {
        const file = await currentFile();
        for (const mission of missions) {
            sheetUi.status = `Adding ${file.filename} to ${mission.name}…`;
            try {
                await uploadMissionFile(mission, file);
            } catch (err) {
                throw new Error(`Could not add to "${mission.name}": ${message(err)}`, { cause: err });
            }
            done++;
        }
        sheetUi.success = missions.length === 1
            ? `Added ${file.filename} to Data Sync "${missions[0].name}"`
            : `Added ${file.filename} to ${missions.length} Data Syncs`;
        return true;
    } catch (err) {
        const added = done > 0 ? ` (${done} of ${missions.length} done)` : '';
        sheetUi.error = `${message(err)}${added}`;
        return false;
    } finally {
        sheetUi.status = '';
        sheetUi.busy = false;
    }
}

/**
 * Bake a north-up GeoTIFF, import it through CloudTAK, and add it as a Files overlay
 * (same path as Files → Add to Map as Overlay).
 * @returns true when the overlay was added successfully
 */
export async function addCurrentAsOverlay(): Promise<boolean> {
    if (!sheetUi.hasSheet || !source || !quad || sheetUi.busy) return false;
    sheetUi.busy = true;
    sheetUi.error = '';
    sheetUi.success = '';
    sheetUi.pickerOpen = false;
    try {
        sheetUi.status = 'Building GeoTIFF for overlay…';
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        const file = await makeExport('geotiff', {
            name: sheetUi.name,
            opacity: opacityState.value,
            quad,
            source,
        });
        await importAsOverlay(file, sheetUi.name, (text) => {
            sheetUi.status = text;
        });
        sheetUi.success = `Added ${file.filename} as a map overlay`;
        return true;
    } catch (err) {
        sheetUi.error = message(err);
        return false;
    } finally {
        sheetUi.status = '';
        sheetUi.busy = false;
    }
}
