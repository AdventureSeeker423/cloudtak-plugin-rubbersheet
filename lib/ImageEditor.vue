<template>
    <div
        class='image-editor d-flex flex-column h-100'
        tabindex='0'
    >
        <div class='image-editor-toolbar px-2 py-2 border-bottom border-secondary'>
            <div class='btn-group mb-2 w-100'>
                <button
                    type='button'
                    class='btn btn-sm'
                    :class='tool === "wand" ? "btn-primary" : "btn-outline-secondary"'
                    @click='tool = "wand"'
                >
                    Wand
                </button>
                <button
                    type='button'
                    class='btn btn-sm'
                    :class='tool === "eraser" ? "btn-primary" : "btn-outline-secondary"'
                    @click='tool = "eraser"'
                >
                    Eraser
                </button>
            </div>
            <div class='d-flex gap-1 mb-2'>
                <button
                    type='button'
                    class='btn btn-sm btn-outline-secondary flex-fill'
                    :disabled='!canUndo'
                    title='Undo (Ctrl+Z)'
                    @click='doUndo'
                >
                    Undo
                </button>
                <button
                    type='button'
                    class='btn btn-sm btn-outline-secondary flex-fill'
                    :disabled='!canRedo'
                    title='Redo (Ctrl+Y)'
                    @click='doRedo'
                >
                    Redo
                </button>
            </div>
            <label
                v-if='tool === "wand"'
                class='form-label small mb-1'
                for='rubber-wand-tol'
            >Tolerance {{ tolerance }}</label>
            <input
                v-if='tool === "wand"'
                id='rubber-wand-tol'
                class='form-range mb-2'
                type='range'
                min='0'
                max='80'
                v-model.number='tolerance'
            >
            <label
                v-if='tool === "eraser"'
                class='form-label small mb-1'
                for='rubber-eraser-size'
            >Brush {{ brushSize }}px</label>
            <input
                v-if='tool === "eraser"'
                id='rubber-eraser-size'
                class='form-range mb-2'
                type='range'
                min='2'
                max='80'
                v-model.number='brushSize'
            >
            <div class='d-flex gap-1'>
                <button
                    type='button'
                    class='btn btn-sm btn-primary flex-fill'
                    @click='emitApply'
                >
                    Apply
                </button>
                <button
                    type='button'
                    class='btn btn-sm btn-outline-secondary flex-fill'
                    @click='emit("cancel")'
                >
                    Cancel
                </button>
            </div>
            <p class='text-secondary small mt-2 mb-0'>
                Wand: click connected background to clear. Eraser: paint transparency.
                Space-drag or middle-drag to pan; wheel to zoom.
            </p>
        </div>

        <div
            ref='viewport'
            class='image-editor-view flex-grow-1'
            :class='cursorClass'
            @wheel.prevent='onWheel'
            @pointerdown='onPointerDown'
            @pointermove='onPointerMove'
            @pointerup='onPointerUp'
            @pointercancel='onPointerUp'
            @pointerleave='onPointerUp'
        >
            <canvas ref='canvasEl' />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { EditHistory } from './edit-history.ts';
import { eraseBrush, floodErase } from './image-edit.ts';

const props = defineProps<{
    source: HTMLCanvasElement;
}>();

const emit = defineEmits<{
    apply: [canvas: HTMLCanvasElement];
    cancel: [];
}>();

type Tool = 'wand' | 'eraser';

const tool = ref<Tool>('wand');
const tolerance = ref(28);
const brushSize = ref(12);
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const canUndo = ref(false);
const canRedo = ref(false);

const viewport = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const width = props.source.width;
const height = props.source.height;
const rgba = new Uint8Array(width * height * 4);
const history = new EditHistory();

const working = document.createElement('canvas');
working.width = width;
working.height = height;
const workingCtx = working.getContext('2d', { willReadFrequently: true });
if (!workingCtx) throw new Error('Could not create edit canvas');

const sourceCtx = props.source.getContext('2d', { willReadFrequently: true });
if (!sourceCtx) throw new Error('Could not read the sheet image');
const initial = sourceCtx.getImageData(0, 0, width, height);
rgba.set(initial.data);
workingCtx.putImageData(initial, 0, 0);

let dragging = false;
let panning = false;
let strokeActive = false;
let lastBrushX = 0;
let lastBrushY = 0;
let panStartX = 0;
let panStartY = 0;
let panOriginX = 0;
let panOriginY = 0;
let spaceDown = false;

const cursorClass = computed(() => {
    if (panning || spaceDown) return 'cursor-pan';
    return tool.value === 'wand' ? 'cursor-wand' : 'cursor-eraser';
});

function syncHistoryFlags(): void {
    canUndo.value = history.canUndo;
    canRedo.value = history.canRedo;
}

function writeWorking(): void {
    const image = new ImageData(new Uint8ClampedArray(rgba), width, height);
    workingCtx.putImageData(image, 0, 0);
}

function paint(): void {
    const canvas = canvasEl.value;
    const host = viewport.value;
    if (!canvas || !host) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = host.clientWidth;
    const cssH = host.clientHeight;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const tile = 12;
    for (let y = 0; y < cssH; y += tile) {
        for (let x = 0; x < cssW; x += tile) {
            const odd = ((x / tile) ^ (y / tile)) & 1;
            ctx.fillStyle = odd ? '#3a424a' : '#2b3238';
            ctx.fillRect(x, y, tile, tile);
        }
    }

    ctx.imageSmoothingEnabled = scale.value < 1;
    ctx.save();
    ctx.translate(panX.value, panY.value);
    ctx.scale(scale.value, scale.value);
    ctx.drawImage(working, 0, 0);
    ctx.restore();
}

function fitView(): void {
    const host = viewport.value;
    if (!host) return;
    const pad = 16;
    const sx = (host.clientWidth - pad * 2) / width;
    const sy = (host.clientHeight - pad * 2) / height;
    scale.value = Math.min(1, Math.max(0.05, Math.min(sx, sy)));
    panX.value = (host.clientWidth - width * scale.value) / 2;
    panY.value = (host.clientHeight - height * scale.value) / 2;
    paint();
}

function viewToImage(clientX: number, clientY: number): { x: number; y: number } | null {
    const host = viewport.value;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const x = (vx - panX.value) / scale.value;
    const y = (vy - panY.value) / scale.value;
    return { x, y };
}

function onWheel(event: WheelEvent): void {
    const host = viewport.value;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const vx = event.clientX - rect.left;
    const vy = event.clientY - rect.top;
    const before = 1 / scale.value;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const next = Math.min(8, Math.max(0.05, scale.value * factor));
    const ix = (vx - panX.value) * before;
    const iy = (vy - panY.value) * before;
    scale.value = next;
    panX.value = vx - ix * next;
    panY.value = vy - iy * next;
    paint();
}

function onPointerDown(event: PointerEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;

    if (event.button === 1 || spaceDown || event.button === 2) {
        panning = true;
        panStartX = event.clientX;
        panStartY = event.clientY;
        panOriginX = panX.value;
        panOriginY = panY.value;
        target.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
    }
    if (event.button !== 0) return;

    const point = viewToImage(event.clientX, event.clientY);
    if (!point) return;
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return;

    dragging = true;
    target.setPointerCapture(event.pointerId);
    event.preventDefault();

    if (tool.value === 'wand') {
        history.push(rgba);
        floodErase(rgba, width, height, point.x, point.y, tolerance.value);
        writeWorking();
        syncHistoryFlags();
        paint();
        dragging = false;
        return;
    }

    // Eraser: one history push for the whole stroke
    history.push(rgba);
    strokeActive = true;
    lastBrushX = point.x;
    lastBrushY = point.y;
    eraseBrush(rgba, width, height, point.x, point.y, brushSize.value / 2);
    writeWorking();
    syncHistoryFlags();
    paint();
}

function onPointerMove(event: PointerEvent): void {
    if (panning) {
        panX.value = panOriginX + (event.clientX - panStartX);
        panY.value = panOriginY + (event.clientY - panStartY);
        paint();
        return;
    }
    if (!dragging || !strokeActive || tool.value !== 'eraser') return;
    const point = viewToImage(event.clientX, event.clientY);
    if (!point) return;

    // Interpolate dabs along the stroke for continuous erase
    const dx = point.x - lastBrushX;
    const dy = point.y - lastBrushY;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, brushSize.value / 4);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        eraseBrush(
            rgba,
            width,
            height,
            lastBrushX + dx * t,
            lastBrushY + dy * t,
            brushSize.value / 2,
        );
    }
    lastBrushX = point.x;
    lastBrushY = point.y;
    writeWorking();
    paint();
}

function onPointerUp(): void {
    dragging = false;
    panning = false;
    strokeActive = false;
}

function doUndo(): void {
    if (!history.undo(rgba)) return;
    writeWorking();
    syncHistoryFlags();
    paint();
}

function doRedo(): void {
    if (!history.redo(rgba)) return;
    writeWorking();
    syncHistoryFlags();
    paint();
}

function onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    if (event.code === 'Space') {
        spaceDown = true;
        event.preventDefault();
        return;
    }

    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        doUndo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        doRedo();
    }
}

function onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') spaceDown = false;
}

function emitApply(): void {
    writeWorking();
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(working, 0, 0);
    emit('apply', out);
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    fitView();
    if (viewport.value) {
        resizeObserver = new ResizeObserver(() => paint());
        resizeObserver.observe(viewport.value);
    }
    viewport.value?.focus();
});

onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    resizeObserver?.disconnect();
    history.clear();
});
</script>

<style scoped>
.image-editor {
    min-height: 0;
    outline: none;
    background: #1a1f24;
}

.image-editor-toolbar {
    flex: 0 0 auto;
    background: rgba(0, 0, 0, 0.25);
}

.image-editor-view {
    position: relative;
    overflow: hidden;
    min-height: 240px;
    touch-action: none;
}

.image-editor-view canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.cursor-wand {
    cursor: crosshair;
}

.cursor-eraser {
    cursor: cell;
}

.cursor-pan {
    cursor: grab;
}
</style>
