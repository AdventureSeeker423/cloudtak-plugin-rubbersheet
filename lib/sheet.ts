import type { Component } from 'vue';
import { Marker } from 'maplibre-gl';
import type { Map as MapLibreMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl';
import { BOTTOM_KEY, LAYER_ID, SOURCE_ID } from './constants.ts';
import {
    cloneQuad,
    centroid,
    pointInQuad,
    quadForView,
    rotateAroundCenter,
    scaleAboutCenter,
    scaleAboutOpposite,
    translateQuad,
    type CornerIndex,
    type LngLat,
    type Quad,
} from './geometry.ts';
import { canvasFromImageFile, fileBaseName, isImage, isPdf, rasterFromCanvas } from './image-file.ts';
import { makeExport } from './make-export.ts';
import { listWritableMissions, uploadMissionFile } from './missions.ts';
import { opacityState, watchOpacity } from './opacity.ts';
import OpacityBar from './OpacityBar.vue';
import { importAsOverlay } from './overlay.ts';
import { closePdf, openPdf, renderPdfPage, renderPdfThumbnail } from './pdf-render.ts';
import { sheetUi, type MissionChoice } from './ui-state.ts';
import type { Raster } from './warp.ts';

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
let markers: Marker[] = [];
let knob: Marker | null = null;
let barOn = false;
let dragging = false;
let restorePan = false;
let listening = false;
let modListening = false;
let shiftHeld = false;
let altHeld = false;

/** Diagonal resize cursors read as scale handles for each corner. */
const SCALE_CURSOR: Record<CornerIndex, string> = {
    0: 'nwse-resize',
    1: 'nesw-resize',
    2: 'nwse-resize',
    3: 'nesw-resize',
};

function mapOrThrow(): MapLibreMap {
    if (!host) throw new Error('The map is not ready yet');
    return host.map;
}

function pointerToLngLat(event: PointerEvent): LngLat {
    const map = mapOrThrow();
    const rect = map.getCanvas().getBoundingClientRect();
    const projected = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
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
}

function onMapMove(): void {
    const knobAt = knobLngLat();
    if (knob && knobAt) knob.setLngLat(knobAt);
}

function endPan(): void {
    if (!host) return;
    dragging = false;
    if (restorePan) host.map.dragPan.enable();
    restorePan = false;
}

function beginPanLock(): void {
    if (!host) return;
    dragging = true;
    restorePan = host.map.dragPan.isEnabled();
    if (restorePan) host.map.dragPan.disable();
}

function swallowClick(): void {
    host?.map.once('click', (event) => {
        event.preventDefault();
        event.originalEvent.stopPropagation();
    });
}

function beginMove(start: LngLat): void {
    if (!host || !quad) return;
    const origin = cloneQuad(quad);
    beginPanLock();
    const map = host.map;
    const move = (event: { lngLat: { lng: number; lat: number } }) => {
        quad = translateQuad(origin, event.lngLat.lng - start[0], event.lngLat.lat - start[1]);
        sync();
    };
    const up = () => {
        map.off('mousemove', move);
        map.off('touchmove', move);
        map.off('mouseup', up);
        map.off('touchend', up);
        endPan();
        swallowClick();
    };
    map.on('mousemove', move);
    map.on('touchmove', move);
    map.on('mouseup', up);
    map.on('touchend', up);
}

function onMapMouseDown(event: MapMouseEvent): void {
    if (!quad || !source || dragging) return;
    if (event.originalEvent.button !== 0) return;
    const point: LngLat = [event.lngLat.lng, event.lngLat.lat];
    if (!pointInQuad(quad, source.width, source.height, point)) return;
    event.preventDefault();
    beginMove(point);
}

function onTouchStart(event: MapTouchEvent): void {
    if (!quad || !source || dragging) return;
    if (event.originalEvent.touches.length !== 1) return;
    const point: LngLat = [event.lngLat.lng, event.lngLat.lat];
    if (!pointInQuad(quad, source.width, source.height, point)) return;
    event.preventDefault();
    beginMove(point);
}

function trackPointer(event: PointerEvent, onMove: (ev: PointerEvent) => void): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    beginPanLock();
    target.setPointerCapture(event.pointerId);
    const end = () => {
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', end);
        target.removeEventListener('pointercancel', end);
        endPan();
        swallowClick();
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
}

function scaleModeActive(ev?: { shiftKey?: boolean; altKey?: boolean }): boolean {
    return !!(ev?.altKey || ev?.shiftKey || altHeld || shiftHeld);
}

function cornerCursor(index: CornerIndex, scale: boolean): string {
    return scale ? SCALE_CURSOR[index] : 'grab';
}

function refreshCornerCursors(ev?: { shiftKey?: boolean; altKey?: boolean }): void {
    const scale = scaleModeActive(ev);
    markers.forEach((marker, index) => {
        marker.getElement().style.cursor = cornerCursor(index as CornerIndex, scale);
    });
}

function onModifierKey(event: KeyboardEvent): void {
    shiftHeld = event.shiftKey;
    altHeld = event.altKey;
    refreshCornerCursors(event);
}

function onWindowBlur(): void {
    shiftHeld = false;
    altHeld = false;
    refreshCornerCursors();
}

function listenModifiers(): void {
    if (modListening) return;
    window.addEventListener('keydown', onModifierKey);
    window.addEventListener('keyup', onModifierKey);
    window.addEventListener('blur', onWindowBlur);
    modListening = true;
}

function unlistenModifiers(): void {
    if (!modListening) return;
    window.removeEventListener('keydown', onModifierKey);
    window.removeEventListener('keyup', onModifierKey);
    window.removeEventListener('blur', onWindowBlur);
    modListening = false;
    shiftHeld = false;
    altHeld = false;
}

function startCorner(event: PointerEvent, index: CornerIndex): void {
    if (!quad) return;
    const origin = cloneQuad(quad);
    // Lock the mode at pointer-down so a mid-drag Shift/Alt press cannot switch
    // a plain warp into a scale.
    const mode = event.altKey ? 'center' : event.shiftKey ? 'opposite' : 'corner';
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
        target.style.cursor = mode === 'corner' ? 'grabbing' : SCALE_CURSOR[index];
    }
    trackPointer(event, (ev) => {
        const cursor = pointerToLngLat(ev);
        if (mode === 'center') {
            quad = scaleAboutCenter(origin, index, cursor);
        } else if (mode === 'opposite') {
            quad = scaleAboutOpposite(origin, index, cursor);
        } else {
            const next = cloneQuad(origin);
            next[index] = cursor;
            quad = next;
        }
        sync();
    });
}

function startRotate(event: PointerEvent): void {
    if (!quad) return;
    const origin = cloneQuad(quad);
    const center = centroid(origin);
    const startAngle = screenAngle(center, pointerToLngLat(event));
    trackPointer(event, (ev) => {
        const delta = screenAngle(center, pointerToLngLat(ev)) - startAngle;
        quad = rotateAroundCenter(origin, -delta);
        sync();
    });
}

function handleElement(title: string, fill: string): HTMLDivElement {
    const element = document.createElement('div');
    element.title = title;
    element.style.width = '16px';
    element.style.height = '16px';
    element.style.borderRadius = '50%';
    element.style.background = fill;
    element.style.border = '2px solid #111111';
    element.style.boxShadow = '0 0 0 1px #ffffff';
    element.style.cursor = 'grab';
    element.style.touchAction = 'none';
    return element;
}

function rotateHandleElement(): HTMLDivElement {
    const element = document.createElement('div');
    element.title = 'Drag to rotate';
    element.style.width = '28px';
    element.style.height = '28px';
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.borderRadius = '50%';
    element.style.background = '#206bc4';
    element.style.border = '2px solid #ffffff';
    element.style.boxShadow = '0 0 0 1px #111111';
    element.style.cursor = 'grab';
    element.style.touchAction = 'none';
    element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>`;
    return element;
}

function ensureMarkers(): void {
    const mapHost = host;
    if (!mapHost || !quad || markers.length) return;
    const current = quad;
    const corners: CornerIndex[] = [0, 1, 2, 3];
    markers = corners.map((index) => {
        const element = handleElement(
            'Drag to move this corner. Shift-drag to scale about the opposite corner. Alt-drag to scale from the center.',
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
    listenModifiers();
}

function removeMarkers(): void {
    for (const marker of markers) marker.remove();
    markers = [];
    knob?.remove();
    knob = null;
    unlistenModifiers();
}

function ensureBar(): void {
    if (!host || barOn) return;
    host.bottomBar.add({ key: BOTTOM_KEY, component: OpacityBar });
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
    overlayCanvas = canvas;
    attachRasterLayer();
    ensureMarkers();
    sync();
    ensureBar();
    sheetUi.hasSheet = true;
    sheetUi.pageThumbs = null;
}

/** Clone of the current sheet canvas for the image editor. */
export function getEditSnapshot(): HTMLCanvasElement | null {
    if (!overlayCanvas) return null;
    const clone = document.createElement('canvas');
    clone.width = overlayCanvas.width;
    clone.height = overlayCanvas.height;
    const ctx = clone.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(overlayCanvas, 0, 0);
    return clone;
}

/** Push edited pixels to the map without resetting corners. */
export function applyEditedCanvas(canvas: HTMLCanvasElement): void {
    if (!host || !quad) throw new Error('The map is not ready yet');
    source = rasterFromCanvas(canvas);
    overlayCanvas = canvas;
    attachRasterLayer();
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
}

export function detach(): void {
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
    quad = null;
    source = null;
    sheetUi.hasSheet = false;
    sheetUi.page = 1;
    sheetUi.pageCount = 1;
    sheetUi.pageThumbs = null;
    sheetUi.missions = null;
}

export async function clearSheet(): Promise<void> {
    clearMap();
    hideBar();
    sheetUi.name = '';
    sheetUi.error = '';
    sheetUi.status = '';
    await closePdf();
}

export async function loadUserFile(file: File): Promise<void> {
    sheetUi.error = '';
    sheetUi.status = '';
    sheetUi.missions = null;
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
        sheetUi.busy = false;
    }
}

export async function setPdfPage(page: number): Promise<void> {
    if (sheetUi.pageCount < 1) return;
    const next = Math.min(sheetUi.pageCount, Math.max(1, page));
    const resetQuad = !sheetUi.hasSheet;
    sheetUi.busy = true;
    sheetUi.error = '';
    try {
        await showCanvas(await renderPdfPage(next), resetQuad);
        sheetUi.page = next;
    } catch (err) {
        sheetUi.error = message(err);
    } finally {
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

export async function downloadCurrent(): Promise<void> {
    if (!sheetUi.hasSheet || !sheetUi.exportType || sheetUi.busy) return;
    sheetUi.busy = true;
    sheetUi.error = '';
    try {
        const file = await currentFile();
        const blob = new Blob([file.bytes.slice()], { type: file.mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.filename;
        link.click();
        URL.revokeObjectURL(url);
        sheetUi.status = `Downloaded ${file.filename}`;
    } catch (err) {
        sheetUi.status = '';
        sheetUi.error = message(err);
    } finally {
        sheetUi.busy = false;
    }
}

export async function openMissionPicker(): Promise<void> {
    if (!sheetUi.hasSheet || !sheetUi.exportType || sheetUi.busy) return;
    sheetUi.error = '';
    try {
        sheetUi.missions = await listWritableMissions();
    } catch (err) {
        sheetUi.error = message(err);
    }
}

export function closeMissionPicker(): void {
    sheetUi.missions = null;
}

export async function uploadCurrent(mission: MissionChoice): Promise<void> {
    if (!sheetUi.hasSheet || !sheetUi.exportType || sheetUi.busy) return;
    sheetUi.busy = true;
    sheetUi.error = '';
    try {
        const file = await currentFile();
        await uploadMissionFile(mission, file);
        sheetUi.missions = null;
        sheetUi.status = `Uploaded ${file.filename} to ${mission.name}`;
    } catch (err) {
        sheetUi.status = '';
        sheetUi.error = message(err);
    } finally {
        sheetUi.busy = false;
    }
}

/**
 * Bake a north-up GeoTIFF, import it through CloudTAK, and add it as a Files overlay.
 * GeoTIFF is used because CloudTAK's KMZ importer only tiles LatLonBox GroundOverlays,
 * not gx:LatLonQuad sheets.
 */
export async function addCurrentAsOverlay(goToOverlays?: () => void): Promise<void> {
    if (!sheetUi.hasSheet || !source || !quad || sheetUi.busy) return;
    sheetUi.busy = true;
    sheetUi.error = '';
    sheetUi.missions = null;
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
        sheetUi.status = `Added ${file.filename} as a map overlay`;
        goToOverlays?.();
    } catch (err) {
        sheetUi.status = '';
        sheetUi.error = message(err);
    } finally {
        sheetUi.busy = false;
    }
}
