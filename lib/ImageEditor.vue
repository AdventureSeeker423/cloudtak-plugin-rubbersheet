<template>
    <Teleport to='body'>
        <div
            ref='rootEl'
            class='ie-root'
            tabindex='0'
            role='dialog'
            aria-label='Image editor'
            @contextmenu.prevent
        >
            <header class='ie-topbar'>
                <div class='ie-brand'>
                    <span class='ie-brand-mark' />
                    <span>Edit Image</span>
                </div>
                <div class='ie-top-actions'>
                    <button
                        type='button'
                        class='ie-btn'
                        :disabled='!canUndo'
                        title='Undo (Ctrl+Z)'
                        @click='doUndo'
                    >
                        Undo
                    </button>
                    <button
                        type='button'
                        class='ie-btn'
                        :disabled='!canRedo'
                        title='Redo (Ctrl+Y)'
                        @click='doRedo'
                    >
                        Redo
                    </button>
                    <button
                        type='button'
                        class='ie-btn'
                        :disabled='!canRevert'
                        title='Discard all edits in this session'
                        @click='confirmRevert = true'
                    >
                        Revert
                    </button>
                    <span class='ie-sep' />
                    <button
                        type='button'
                        class='ie-btn ie-btn-danger'
                        :disabled='!hasSelection'
                        title='Delete selection (Del)'
                        @click='deleteSelection'
                    >
                        Delete
                    </button>
                    <button
                        type='button'
                        class='ie-btn'
                        :disabled='!hasSelection'
                        title='Deselect (Esc)'
                        @click='clearSelection'
                    >
                        Deselect
                    </button>
                    <span class='ie-sep' />
                    <button
                        type='button'
                        class='ie-btn'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </button>
                    <button
                        type='button'
                        class='ie-btn ie-btn-primary'
                        @click='emitApply'
                    >
                        Apply
                    </button>
                </div>
            </header>

            <div class='ie-body'>
                <aside class='ie-tools'>
                    <button
                        type='button'
                        class='ie-tool'
                        :class='{ active: tool === "wand" }'
                        title='Magic Wand — select connected color'
                        @click='setTool("wand")'
                    >
                        <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                            <path
                                fill='currentColor'
                                d='M7.5 21.5 3 17l9.5-9.5 4.5 4.5L7.5 21.5zm11.2-14.4-1.8-1.8 1.4-1.4a1 1 0 0 1 1.4 0l1.8 1.8a1 1 0 0 1 0 1.4l-1.4 1.4-1.4-1.4zM14 4l1-3 1 3 3 1-3 1-1 3-1-3-3-1 3-1z'
                            />
                        </svg>
                        <span>Wand</span>
                    </button>
                    <button
                        type='button'
                        class='ie-tool'
                        :class='{ active: tool === "color" }'
                        title='Color Key — select every matching color'
                        @click='setTool("color")'
                    >
                        <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                            <path
                                fill='currentColor'
                                d='M3 17.2 12.8 7.4l3.8 3.8L6.8 21H3v-3.8zm14.6-9.2 2.1-2.1a1.5 1.5 0 0 0 0-2.1l-1.5-1.5a1.5 1.5 0 0 0-2.1 0l-2.1 2.1 3.6 3.6zM14 19h7v2h-7v-2z'
                            />
                        </svg>
                        <span>Color</span>
                    </button>
                    <button
                        type='button'
                        class='ie-tool'
                        :class='{ active: tool === "eraser" }'
                        title='Eraser — paint transparency'
                        @click='setTool("eraser")'
                    >
                        <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                            <path
                                fill='currentColor'
                                d='M16.2 3.2a2 2 0 0 1 2.8 0l1.8 1.8a2 2 0 0 1 0 2.8L10.5 18.1 5 19.5l1.4-5.5L16.2 3.2zM4 20.5h16v2H4v-2z'
                            />
                        </svg>
                        <span>Eraser</span>
                    </button>
                </aside>

                <div
                    ref='viewport'
                    class='ie-view'
                    :class='cursorClass'
                    @wheel.prevent='onWheel'
                    @pointerdown='onPointerDown'
                    @pointermove='onPointerMove'
                    @pointerup='onPointerUp'
                    @pointercancel='onPointerUp'
                    @pointerleave='onPointerLeave'
                >
                    <canvas ref='canvasEl' />
                </div>

                <aside class='ie-options'>
                    <template v-if='tool === "wand"'>
                        <div class='ie-opt-label'>Fuzziness</div>
                        <div class='ie-range-labels'>
                            <span>Exact</span>
                            <span>Loose</span>
                        </div>
                        <input
                            class='ie-range'
                            type='range'
                            min='0'
                            max='80'
                            v-model.number='fuzziness'
                            title='How similar colors get selected with the wand'
                        >
                        <p class='ie-hint'>
                            Click a connected color. Then Delete.
                        </p>
                    </template>
                    <template v-else-if='tool === "color"'>
                        <div class='ie-opt-label'>Target color</div>
                        <div class='ie-swatch-row'>
                            <span
                                class='ie-swatch'
                                :style='{ background: targetColorCss }'
                                title='Current target'
                            />
                            <button
                                type='button'
                                class='ie-btn ie-btn-compact'
                                title='Reset to white'
                                @click='resetTargetWhite'
                            >
                                White
                            </button>
                        </div>
                        <div class='ie-opt-label'>Fuzziness</div>
                        <div class='ie-range-labels'>
                            <span>Exact</span>
                            <span>Loose</span>
                        </div>
                        <input
                            class='ie-range'
                            type='range'
                            min='0'
                            max='80'
                            v-model.number='fuzziness'
                            title='How close a pixel must be to the target color'
                        >
                        <p class='ie-hint'>
                            Click to pick a color. Selects every match. Then Delete.
                        </p>
                    </template>
                    <template v-else>
                        <div class='ie-opt-label'>Brush size</div>
                        <div class='ie-brush-preview' :style='brushPreviewStyle' />
                        <input
                            class='ie-range'
                            type='range'
                            min='2'
                            max='80'
                            v-model.number='brushSize'
                        >
                        <div class='ie-brush-value'>{{ brushSize }}px</div>
                        <p class='ie-hint'>
                            Drag to erase. Circle shows brush size.
                        </p>
                    </template>
                    <p class='ie-hint ie-hint-muted'>
                        Space-drag to pan · Wheel to zoom
                    </p>
                </aside>
            </div>

            <div
                v-if='confirmRevert'
                class='ie-modal-backdrop'
                @click.self='confirmRevert = false'
            >
                <div
                    class='ie-modal'
                    role='alertdialog'
                    aria-labelledby='ie-revert-title'
                    aria-describedby='ie-revert-desc'
                >
                    <h2
                        id='ie-revert-title'
                        class='ie-modal-title'
                    >
                        Revert to original?
                    </h2>
                    <p
                        id='ie-revert-desc'
                        class='ie-modal-body'
                    >
                        This throws away every edit in this session. You can’t undo it.
                    </p>
                    <div class='ie-modal-actions'>
                        <button
                            type='button'
                            class='ie-btn'
                            @click='confirmRevert = false'
                        >
                            Keep editing
                        </button>
                        <button
                            type='button'
                            class='ie-btn ie-btn-danger'
                            @click='revertToOriginal'
                        >
                            Revert
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang='ts'>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { EditHistory } from './edit-history.ts';
import {
    colorSelect,
    eraseBrush,
    eraseMask,
    floodSelect,
    sampleColor,
    selectionOutlinePath,
} from './image-edit.ts';

const props = defineProps<{
    source: HTMLCanvasElement;
}>();

const emit = defineEmits<{
    apply: [canvas: HTMLCanvasElement];
    cancel: [];
}>();

type Tool = 'wand' | 'color' | 'eraser';

const tool = ref<Tool>('wand');
const fuzziness = ref(28);
const brushSize = ref(12);
const targetR = ref(255);
const targetG = ref(255);
const targetB = ref(255);
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const canUndo = ref(false);
const canRedo = ref(false);
const canRevert = ref(false);
const hasSelection = ref(false);
const confirmRevert = ref(false);

const rootEl = ref<HTMLElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const width = props.source.width;
const height = props.source.height;
const rgba = new Uint8Array(width * height * 4);
const selectionMask = new Uint8Array(width * height);
const history = new EditHistory();

const working = document.createElement('canvas');
working.width = width;
working.height = height;
const workingCtx = working.getContext('2d', { willReadFrequently: true });
if (!workingCtx) throw new Error('Could not create edit canvas');

const tintCanvas = document.createElement('canvas');
tintCanvas.width = width;
tintCanvas.height = height;
const tintCtx = tintCanvas.getContext('2d');
if (!tintCtx) throw new Error('Could not create selection overlay');

const sourceCtx = props.source.getContext('2d', { willReadFrequently: true });
if (!sourceCtx) throw new Error('Could not read the sheet image');
const initial = sourceCtx.getImageData(0, 0, width, height);
const original = new Uint8Array(initial.data);
rgba.set(original);
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
let pointerInView = false;
let hoverClientX = 0;
let hoverClientY = 0;
let selectionPath: Path2D | null = null;
let antsPhase = 0;
let antsRaf = 0;

const brushPreviewStyle = computed(() => {
    const d = Math.max(8, Math.min(48, brushSize.value));
    return {
        width: `${d}px`,
        height: `${d}px`,
    };
});

const targetColorCss = computed(
    () => `rgb(${targetR.value}, ${targetG.value}, ${targetB.value})`,
);

const cursorClass = computed(() => {
    if (panning || spaceDown) return 'cursor-pan';
    if (tool.value === 'eraser') return 'cursor-none';
    if (tool.value === 'color') return 'cursor-eyedrop';
    return 'cursor-wand';
});

function syncHistoryFlags(): void {
    canUndo.value = history.canUndo;
    canRedo.value = history.canRedo;
    canRevert.value = !buffersMatch(rgba, original);
}

function buffersMatch(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function writeWorking(): void {
    const image = new ImageData(new Uint8ClampedArray(rgba), width, height);
    workingCtx.putImageData(image, 0, 0);
}

function rebuildSelectionVisuals(): void {
    const tint = tintCtx.createImageData(width, height);
    const data = tint.data;
    let count = 0;
    for (let i = 0; i < selectionMask.length; i++) {
        if (!selectionMask[i]) continue;
        count += 1;
        const o = i * 4;
        data[o] = 56;
        data[o + 1] = 139;
        data[o + 2] = 253;
        data[o + 3] = 70;
    }
    tintCtx.putImageData(tint, 0, 0);
    hasSelection.value = count > 0;
    selectionPath = count > 0 ? selectionOutlinePath(selectionMask, width, height) : null;
}

function clearSelection(): void {
    selectionMask.fill(0);
    rebuildSelectionVisuals();
    paint();
}

function applyColorSelection(): void {
    colorSelect(
        rgba,
        width,
        height,
        targetR.value,
        targetG.value,
        targetB.value,
        fuzziness.value,
        selectionMask,
    );
    rebuildSelectionVisuals();
    paint();
}

function setTool(next: Tool): void {
    tool.value = next;
    if (next === 'color') {
        applyColorSelection();
    } else if (next !== 'wand') {
        clearSelection();
    }
}

function resetTargetWhite(): void {
    targetR.value = 255;
    targetG.value = 255;
    targetB.value = 255;
    if (tool.value === 'color') applyColorSelection();
}

function deleteSelection(): void {
    if (!hasSelection.value) return;
    history.push(rgba);
    eraseMask(rgba, width, height, selectionMask);
    writeWorking();
    clearSelection();
    syncHistoryFlags();
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

    const tile = 14;
    for (let y = 0; y < cssH; y += tile) {
        for (let x = 0; x < cssW; x += tile) {
            const odd = ((x / tile) ^ (y / tile)) & 1;
            ctx.fillStyle = odd ? '#3d4450' : '#2c313a';
            ctx.fillRect(x, y, tile, tile);
        }
    }

    ctx.imageSmoothingEnabled = scale.value < 1;
    ctx.save();
    ctx.translate(panX.value, panY.value);
    ctx.scale(scale.value, scale.value);
    ctx.drawImage(working, 0, 0);

    if (hasSelection.value) {
        ctx.drawImage(tintCanvas, 0, 0);
        if (selectionPath) {
            const dash = Math.max(2, 5 / scale.value);
            ctx.lineWidth = Math.max(1 / scale.value, 1 / scale.value);
            ctx.setLineDash([dash, dash]);
            ctx.lineDashOffset = -antsPhase / scale.value;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke(selectionPath);
            ctx.lineDashOffset = -(antsPhase / scale.value) + dash;
            ctx.strokeStyle = '#111827';
            ctx.stroke(selectionPath);
            ctx.setLineDash([]);
        }
    }
    ctx.restore();

    // Brush size cursor in screen space
    if (tool.value === 'eraser' && pointerInView && !panning && !spaceDown) {
        const rect = host.getBoundingClientRect();
        const cx = hoverClientX - rect.left;
        const cy = hoverClientY - rect.top;
        const r = (brushSize.value / 2) * scale.value;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function fitView(): void {
    const host = viewport.value;
    if (!host) return;
    const pad = 40;
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
        paint();
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
        floodSelect(rgba, width, height, point.x, point.y, fuzziness.value, selectionMask);
        rebuildSelectionVisuals();
        paint();
        dragging = false;
        return;
    }

    if (tool.value === 'color') {
        const sampled = sampleColor(rgba, width, height, point.x, point.y);
        if (sampled) {
            targetR.value = sampled.r;
            targetG.value = sampled.g;
            targetB.value = sampled.b;
            applyColorSelection();
        }
        dragging = false;
        return;
    }

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
    pointerInView = true;
    hoverClientX = event.clientX;
    hoverClientY = event.clientY;

    if (panning) {
        panX.value = panOriginX + (event.clientX - panStartX);
        panY.value = panOriginY + (event.clientY - panStartY);
        paint();
        return;
    }

    if (tool.value === 'eraser' && (!dragging || !strokeActive)) {
        paint();
        return;
    }

    if (!dragging || !strokeActive || tool.value !== 'eraser') return;
    const point = viewToImage(event.clientX, event.clientY);
    if (!point) return;

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
    paint();
}

function onPointerLeave(): void {
    pointerInView = false;
    if (!dragging && !panning) paint();
}

function doUndo(): void {
    if (!history.undo(rgba)) return;
    writeWorking();
    clearSelection();
    syncHistoryFlags();
    if (tool.value === 'color') applyColorSelection();
}

function doRedo(): void {
    if (!history.redo(rgba)) return;
    writeWorking();
    clearSelection();
    syncHistoryFlags();
    if (tool.value === 'color') applyColorSelection();
}

function revertToOriginal(): void {
    confirmRevert.value = false;
    if (buffersMatch(rgba, original)) {
        history.clear();
        syncHistoryFlags();
        return;
    }
    rgba.set(original);
    writeWorking();
    history.clear();
    clearSelection();
    syncHistoryFlags();
    if (tool.value === 'color') applyColorSelection();
}

function onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    if (event.code === 'Space') {
        spaceDown = true;
        event.preventDefault();
        paint();
        return;
    }

    if (event.key === 'Escape') {
        if (hasSelection.value) {
            event.preventDefault();
            clearSelection();
        }
        return;
    }

    if (confirmRevert.value) {
        if (event.key === 'Escape') {
            event.preventDefault();
            confirmRevert.value = false;
        }
        return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelection.value) {
        event.preventDefault();
        deleteSelection();
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
    if (event.code === 'Space') {
        spaceDown = false;
        paint();
    }
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

function antsLoop(now: number): void {
    antsPhase = (now / 30) % 1000;
    if (hasSelection.value) paint();
    antsRaf = requestAnimationFrame(antsLoop);
}

watch([brushSize, tool], () => {
    paint();
});

watch(fuzziness, () => {
    if (tool.value === 'color') applyColorSelection();
});

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    document.body.classList.add('rubber-ie-open');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    fitView();
    if (viewport.value) {
        resizeObserver = new ResizeObserver(() => paint());
        resizeObserver.observe(viewport.value);
    }
    rootEl.value?.focus();
    antsRaf = requestAnimationFrame(antsLoop);
});

onUnmounted(() => {
    document.body.classList.remove('rubber-ie-open');
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    resizeObserver?.disconnect();
    cancelAnimationFrame(antsRaf);
    history.clear();
});
</script>

<style scoped>
.ie-root {
    position: fixed;
    inset: 0;
    z-index: 10050;
    display: flex;
    flex-direction: column;
    background: #1b1e24;
    color: #e8eaed;
    font-family: "Segoe UI", system-ui, sans-serif;
    outline: none;
}

.ie-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 48px;
    padding: 0 14px;
    background: linear-gradient(180deg, #2a2f38 0%, #22262e 100%);
    border-bottom: 1px solid #0f1115;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
}

.ie-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.02em;
}

.ie-brand-mark {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: linear-gradient(135deg, #5b9cff, #3d7cf0);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
}

.ie-top-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

.ie-sep {
    width: 1px;
    height: 22px;
    margin: 0 4px;
    background: #3a414d;
}

.ie-btn {
    appearance: none;
    border: 1px solid #3a414d;
    background: #2c313a;
    color: #e8eaed;
    border-radius: 6px;
    padding: 5px 11px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
}

.ie-btn:hover:not(:disabled) {
    background: #363c48;
    border-color: #525b6a;
}

.ie-btn:disabled {
    opacity: 0.35;
    cursor: default;
}

.ie-btn-primary {
    background: #3d7cf0;
    border-color: #2f6ae0;
    color: #fff;
}

.ie-btn-primary:hover:not(:disabled) {
    background: #4d8aff;
}

.ie-btn-danger {
    background: #4a2a2a;
    border-color: #7a3a3a;
    color: #ffb4b4;
}

.ie-btn-danger:hover:not(:disabled) {
    background: #5c3232;
}

.ie-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 72px 1fr 200px;
}

.ie-tools {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 8px;
    background: #22262e;
    border-right: 1px solid #0f1115;
}

.ie-tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 4px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #c5cad3;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
}

.ie-tool:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
}

.ie-tool.active {
    background: rgba(61, 124, 240, 0.18);
    border-color: rgba(91, 156, 255, 0.45);
    color: #fff;
}

.ie-view {
    position: relative;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    touch-action: none;
    background: #15181d;
}

.ie-view canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.ie-options {
    padding: 14px 14px 18px;
    background: #22262e;
    border-left: 1px solid #0f1115;
}

.ie-opt-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9aa3b2;
    margin-bottom: 10px;
}

.ie-range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #c5cad3;
    margin-bottom: 4px;
}

.ie-range {
    width: 100%;
    accent-color: #5b9cff;
    margin-bottom: 10px;
}

.ie-brush-preview {
    margin: 0 auto 12px;
    border-radius: 50%;
    border: 1.5px solid #e8eaed;
    box-shadow: 0 0 0 1px #111;
    background: radial-gradient(circle at 35% 35%, #5a6270, #2c313a);
}

.ie-brush-value {
    text-align: center;
    font-size: 12px;
    color: #c5cad3;
    margin-bottom: 8px;
}

.ie-hint {
    font-size: 11px;
    line-height: 1.4;
    color: #c5cad3;
    margin: 0 0 10px;
}

.ie-hint-muted {
    color: #7d8696;
    margin-top: 18px;
}

.cursor-wand {
    cursor: crosshair;
}

.cursor-eyedrop {
    cursor: copy;
}

.cursor-none {
    cursor: none;
}

.cursor-pan {
    cursor: grab;
}

.ie-swatch-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
}

.ie-swatch {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #0f1115;
    box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.25),
        0 0 0 1px #3a414d;
}

.ie-btn-compact {
    padding: 4px 9px;
    font-size: 11px;
}

.ie-modal-backdrop {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 10, 14, 0.62);
    backdrop-filter: blur(2px);
}

.ie-modal {
    width: min(360px, calc(100vw - 32px));
    padding: 18px 18px 14px;
    border-radius: 10px;
    background: #2a2f38;
    border: 1px solid #3a414d;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
}

.ie-modal-title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 650;
}

.ie-modal-body {
    margin: 0 0 16px;
    font-size: 13px;
    line-height: 1.45;
    color: #c5cad3;
}

.ie-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
</style>

<style>
body.rubber-ie-open {
    overflow: hidden;
}
</style>
