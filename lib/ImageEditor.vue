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
                <div class='ie-top-center'>
                    <button
                        type='button'
                        class='ie-btn ie-btn-icon'
                        :disabled='!canUndo'
                        title='Undo (Ctrl+Z)'
                        @click='doUndo'
                    >
                        <svg viewBox='0 0 24 24' width='15' height='15' aria-hidden='true'>
                            <path
                                fill='currentColor'
                                d='M12.5 8c-2.6 0-5 1-6.9 2.6L3 8v8h8l-2.6-2.6A6.9 6.9 0 0 1 12.5 11c3 0 5.6 1.9 6.6 4.6l2.3-.8C20 11.3 16.5 8 12.5 8z'
                            />
                        </svg>
                        Undo
                    </button>
                    <button
                        type='button'
                        class='ie-btn ie-btn-icon'
                        :disabled='!canRedo'
                        title='Redo (Ctrl+Y)'
                        @click='doRedo'
                    >
                        <svg viewBox='0 0 24 24' width='15' height='15' aria-hidden='true'>
                            <path
                                fill='currentColor'
                                d='M11.5 8c2.6 0 5 1 6.9 2.6L21 8v8h-8l2.6-2.6A6.9 6.9 0 0 0 11.5 11c-3 0-5.6 1.9-6.6 4.6l-2.3-.8C4 11.3 7.5 8 11.5 8z'
                            />
                        </svg>
                        Redo
                    </button>
                    <button
                        type='button'
                        class='ie-btn'
                        :disabled='!canRevert'
                        title='Discard all edits in this session'
                        @click='confirmRevert = true'
                    >
                        Revert To Original
                    </button>
                </div>
                <div class='ie-top-actions'>
                    <button
                        type='button'
                        class='ie-btn'
                        @click='emit("cancel")'
                    >
                        Cancel Changes
                    </button>
                    <button
                        type='button'
                        class='ie-btn ie-btn-save'
                        @click='emitApply'
                    >
                        Save Changes
                    </button>
                </div>
            </header>

            <div
                class='ie-body'
                :style='bodyStyle'
            >
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
                        :class='{ active: tool === "rect" }'
                        title='Rectangle Marquee — drag to select'
                        @click='setTool("rect")'
                    >
                        <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                            <path
                                fill='none'
                                stroke='currentColor'
                                stroke-width='2'
                                stroke-dasharray='3 2'
                                d='M4 4h16v16H4z'
                            />
                        </svg>
                        <span>Rect</span>
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
                    <button
                        type='button'
                        class='ie-tool'
                        :class='{ active: tool === "color" }'
                        title='Selective Color — select every matching color in the image'
                        @click='setTool("color")'
                    >
                        <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                            <path
                                fill='currentColor'
                                d='M3 17.2 12.8 7.4l3.8 3.8L6.8 21H3v-3.8zm14.6-9.2 2.1-2.1a1.5 1.5 0 0 0 0-2.1l-1.5-1.5a1.5 1.5 0 0 0-2.1 0l-2.1 2.1 3.6 3.6zM14 19h7v2h-7v-2z'
                            />
                        </svg>
                        <span class='ie-tool-multiline'>Selective<br>Color</span>
                    </button>
                    <button
                        type='button'
                        class='ie-tool'
                        :class='{ active: tool === "stamp" }'
                        title='Icons — place or remove facility markers'
                        @click='setTool("stamp")'
                    >
                        <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                            <path
                                fill='currentColor'
                                d='M12 2a4 4 0 0 1 4 4c0 2.2-1.8 5.2-4 8.5C9.8 11.2 8 8.2 8 6a4 4 0 0 1 4-4zm0 5.5A1.5 1.5 0 1 0 12 4a1.5 1.5 0 0 0 0 3.5zM6 20.5c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5V22H6v-1.5z'
                            />
                        </svg>
                        <span>Icons</span>
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
                    <div
                        v-if='hasSelection'
                        class='ie-selection-bar'
                        @pointerdown.stop
                        @wheel.stop
                    >
                        <button
                            type='button'
                            class='ie-btn ie-btn-danger ie-btn-icon'
                            title='Delete selection (Del)'
                            @click='deleteSelection'
                        >
                            <svg viewBox='0 0 24 24' width='15' height='15' aria-hidden='true'>
                                <path
                                    fill='currentColor'
                                    d='M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9zm-1 12h12l1-12H5l1 12z'
                                />
                            </svg>
                            Delete
                        </button>
                        <button
                            type='button'
                            class='ie-btn ie-btn-icon'
                            title='Deselect (Esc / Ctrl+D)'
                            @click='clearSelection'
                        >
                            <svg viewBox='0 0 24 24' width='15' height='15' aria-hidden='true'>
                                <path
                                    fill='currentColor'
                                    d='M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4z'
                                />
                            </svg>
                            Deselect
                        </button>
                    </div>
                </div>

                <aside
                    class='ie-options'
                    :class='{ "ie-options-wide": tool === "stamp" }'
                >
                    <template v-if='tool === "wand"'>
                        <div class='ie-opt-label'>Match range</div>
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
                            title='How far from the clicked color still counts as a match'
                        >
                        <p class='ie-hint'>
                            Click to select. Shift add · Ctrl subtract. Then Delete.
                        </p>
                    </template>
                    <template v-else-if='tool === "rect"'>
                        <div class='ie-opt-label'>Rectangle</div>
                        <p class='ie-hint'>
                            Drag to select. Shift add · Ctrl subtract. Then Delete.
                        </p>
                    </template>
                    <template v-else-if='tool === "color"'>
                        <div class='ie-opt-label'>Target color</div>
                        <div class='ie-swatch-row'>
                            <span
                                class='ie-swatch'
                                :class='{ empty: !hasColorTarget }'
                                :style='hasColorTarget ? { background: targetColorCss } : undefined'
                                :title='hasColorTarget ? "Current target" : "Click the image to pick"'
                            />
                            <span class='ie-swatch-caption'>
                                {{ hasColorTarget ? targetColorCss : 'Click image to pick' }}
                            </span>
                        </div>
                        <div class='ie-opt-label'>Match range</div>
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
                            :disabled='!hasColorTarget'
                            title='How far from the target color still counts as a match'
                        >
                        <p class='ie-hint'>
                            Pick a color to select every match in the image. Then Delete.
                        </p>
                    </template>
                    <template v-else-if='tool === "stamp"'>
                        <div class='ie-opt-label'>Facility</div>
                        <div class='ie-stamp-grid'>
                            <button
                                v-for='entry in facilityCatalog'
                                :key='entry.kind'
                                type='button'
                                class='ie-stamp-swatch'
                                :class='{ active: stampKind === entry.kind }'
                                :title='entry.label'
                                @click='stampKind = entry.kind'
                            >
                                <StampIcon
                                    :kind='entry.kind'
                                    :size='32'
                                />
                                <span>{{ entry.short }}</span>
                            </button>
                        </div>
                        <div class='ie-opt-label'>Numbered placards</div>
                        <div class='ie-stamp-grid ie-stamp-grid-numbers'>
                            <button
                                v-for='entry in numberCatalog'
                                :key='entry.kind'
                                type='button'
                                class='ie-stamp-swatch ie-stamp-swatch-number'
                                :class='{ active: stampKind === entry.kind }'
                                :title='entry.label'
                                @click='stampKind = entry.kind'
                            >
                                <StampIcon
                                    :kind='entry.kind'
                                    :size='28'
                                />
                            </button>
                        </div>
                        <div class='ie-opt-label'>Icon size</div>
                        <input
                            class='ie-range'
                            type='range'
                            min='16'
                            max='96'
                            v-model.number='stampSize'
                        >
                        <div class='ie-brush-value'>{{ stampSize }}px</div>
                        <p class='ie-hint'>
                            Pick an icon, then click to place. Esc clears the pick. Click a placed icon to remove. [ ] size · Shift twice as fast.
                        </p>
                    </template>
                    <template v-else>
                        <div class='ie-opt-label'>Brush size</div>
                        <div class='ie-brush-preview' :style='brushPreviewStyle' />
                        <input
                            class='ie-range'
                            type='range'
                            min='2'
                            max='300'
                            v-model.number='brushSize'
                        >
                        <div class='ie-brush-value'>{{ brushSize }}px</div>
                        <p class='ie-hint'>
                            Drag to erase. [ ] change size · Shift twice as fast.
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
import { MAX_IMAGE_SIDE } from './constants.ts';
import { EditHistory, EDIT_HISTORY_CAP, type EditHistorySnapshot } from './edit-history.ts';
import {
    colorSelect,
    eraseBrush,
    eraseMask,
    floodSelect,
    type FloodSelectMode,
    rectSelect,
    sampleColor,
    selectionOutlinePath,
} from './image-edit.ts';
import StampIcon from './StampIcon.vue';
import {
    FACILITY_STAMP_CATALOG,
    NUMBER_STAMP_CATALOG,
    cloneStamps,
    drawStampAt,
    hitTestStamp,
    stampIntoRgba,
    type PlacedStamp,
    type StampKind,
} from './stamp-icons.ts';

const props = defineProps<{
    source: HTMLCanvasElement;
    /** True original pixels for Revert (from first load). Defaults to source. */
    pristine?: Uint8Array;
    /** Undo/redo stacks from a previous edit session. */
    history?: EditHistorySnapshot | null;
}>();

const emit = defineEmits<{
    apply: [canvas: HTMLCanvasElement, history: EditHistorySnapshot];
    cancel: [];
}>();

type Tool = 'wand' | 'rect' | 'color' | 'eraser' | 'stamp';

const tool = ref<Tool>('wand');
const fuzziness = ref(28);
const brushSize = ref(12);
const stampKind = ref<StampKind | null>(null);
const stampSize = ref(40);
const facilityCatalog = FACILITY_STAMP_CATALOG;
const numberCatalog = NUMBER_STAMP_CATALOG;
const targetR = ref(0);
const targetG = ref(0);
const targetB = ref(0);
const hasColorTarget = ref(false);
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

let width = props.source.width;
let height = props.source.height;
let rgba = new Uint8Array(width * height * 4);
let selectionMask = new Uint8Array(width * height);
let selectionScratch = new Uint8Array(width * height);
const history = new EditHistory();

const working = document.createElement('canvas');
working.width = width;
working.height = height;
let workingCtx = working.getContext('2d', { willReadFrequently: true });
if (!workingCtx) throw new Error('Could not create edit canvas');

const tintCanvas = document.createElement('canvas');
tintCanvas.width = width;
tintCanvas.height = height;
let tintCtx = tintCanvas.getContext('2d');
if (!tintCtx) throw new Error('Could not create selection overlay');

const sourceCtx = props.source.getContext('2d', { willReadFrequently: true });
if (!sourceCtx) throw new Error('Could not read the sheet image');
const initial = sourceCtx.getImageData(0, 0, width, height);
rgba.set(initial.data);
workingCtx.putImageData(initial, 0, 0);

let original = props.pristine && props.pristine.length === rgba.length
    ? new Uint8Array(props.pristine)
    : new Uint8Array(initial.data);
if (props.history) history.importSnapshot(props.history);

/** Stamps placed this session — parallel undo stacks stay aligned with EditHistory. */
let stamps: PlacedStamp[] = [];
let stampPast: PlacedStamp[][] = props.history
    ? Array.from({ length: history.undoCount }, () => [])
    : [];
let stampFuture: PlacedStamp[][] = props.history
    ? Array.from({ length: history.redoCount }, () => [])
    : [];
let nextStampId = 1;

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
let lastAntPaint = 0;
let rectDrag: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    mode: FloodSelectMode;
} | null = null;

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
    if (tool.value === 'stamp') return 'cursor-stamp';
    if (tool.value === 'color') return 'cursor-eyedrop';
    if (tool.value === 'rect') return 'cursor-cross';
    return 'cursor-wand';
});

const bodyStyle = computed(() => ({
    gridTemplateColumns: tool.value === 'stamp' ? '72px 1fr 260px' : '72px 1fr 200px',
}));

function syncHistoryFlags(): void {
    canUndo.value = history.canUndo;
    canRedo.value = history.canRedo;
    canRevert.value = !buffersMatch(rgba, original) || stamps.length > 0;
}

/** Snapshot pixels + stamp list before a mutating edit. */
function pushEdit(): void {
    history.push(rgba);
    stampPast.push(cloneStamps(stamps));
    if (stampPast.length > EDIT_HISTORY_CAP) stampPast.shift();
    stampFuture = [];
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
    for (const stamp of stamps) {
        drawStampAt(workingCtx, stamp.kind, stamp.x, stamp.y, stamp.size);
    }
}

function rebuildSelectionVisuals(): void {
    const tint = tintCtx.createImageData(width, height);
    const data = tint.data;
    let count = 0;
    for (let i = 0; i < selectionMask.length; i++) {
        if (!selectionMask[i]) continue;
        count += 1;
        const o = i * 4;
        data[o] = 90;
        data[o + 1] = 160;
        data[o + 2] = 255;
        data[o + 3] = 36;
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
    if (!hasColorTarget.value) {
        clearSelection();
        return;
    }
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
    rectDrag = null;
    if (next === 'color') {
        if (hasColorTarget.value) applyColorSelection();
        else clearSelection();
    } else if (next === 'eraser' || next === 'stamp') {
        clearSelection();
    }
    // Wand / Rect keep the current selection.
    paint();
}

function deleteSelection(): void {
    if (!hasSelection.value) return;
    pushEdit();
    eraseMask(rgba, width, height, selectionMask);
    writeWorking();
    clearSelection();
    syncHistoryFlags();
}

function padRgbaBuffer(
    src: Uint8Array,
    srcW: number,
    srcH: number,
    padLeft: number,
    padTop: number,
    newW: number,
    newH: number,
): Uint8Array {
    const out = new Uint8Array(newW * newH * 4);
    for (let y = 0; y < srcH; y++) {
        const dy = y + padTop;
        const srcRow = y * srcW * 4;
        const dstRow = dy * newW * 4;
        for (let x = 0; x < srcW; x++) {
            const si = srcRow + x * 4;
            const di = dstRow + (x + padLeft) * 4;
            out[di] = src[si];
            out[di + 1] = src[si + 1];
            out[di + 2] = src[si + 2];
            out[di + 3] = src[si + 3];
        }
    }
    return out;
}

function padMask(
    src: Uint8Array,
    srcW: number,
    srcH: number,
    padLeft: number,
    padTop: number,
    newW: number,
    newH: number,
): Uint8Array {
    const out = new Uint8Array(newW * newH);
    for (let y = 0; y < srcH; y++) {
        const dy = y + padTop;
        const srcRow = y * srcW;
        const dstRow = dy * newW;
        for (let x = 0; x < srcW; x++) {
            out[dstRow + x + padLeft] = src[srcRow + x];
        }
    }
    return out;
}

/**
 * Grow the edit canvas with transparent padding so a stamp at (cx, cy) fits fully.
 * Returns the stamp center in the (possibly expanded) image space.
 */
function ensureStampFits(cx: number, cy: number, size: number): { x: number; y: number } {
    const half = Math.max(8, size) / 2;
    let padLeft = Math.max(0, Math.ceil(half - cx));
    let padTop = Math.max(0, Math.ceil(half - cy));
    let padRight = Math.max(0, Math.ceil(cx + half - width));
    let padBottom = Math.max(0, Math.ceil(cy + half - height));
    if (padLeft === 0 && padTop === 0 && padRight === 0 && padBottom === 0) {
        return { x: cx, y: cy };
    }

    let newW = width + padLeft + padRight;
    let newH = height + padTop + padBottom;
    // Keep within export/import limits; shrink padding symmetrically if needed.
    if (newW > MAX_IMAGE_SIDE) {
        const over = newW - MAX_IMAGE_SIDE;
        const cutL = Math.min(padLeft, Math.floor(over / 2));
        const cutR = Math.min(padRight, over - cutL);
        padLeft -= cutL;
        padRight -= cutR;
        newW = width + padLeft + padRight;
    }
    if (newH > MAX_IMAGE_SIDE) {
        const over = newH - MAX_IMAGE_SIDE;
        const cutT = Math.min(padTop, Math.floor(over / 2));
        const cutB = Math.min(padBottom, over - cutT);
        padTop -= cutT;
        padBottom -= cutB;
        newH = height + padTop + padBottom;
    }
    if (padLeft === 0 && padTop === 0 && padRight === 0 && padBottom === 0) {
        return {
            x: Math.min(width - half, Math.max(half, cx)),
            y: Math.min(height - half, Math.max(half, cy)),
        };
    }

    const oldW = width;
    const oldH = height;
    rgba = padRgbaBuffer(rgba, oldW, oldH, padLeft, padTop, newW, newH);
    original = padRgbaBuffer(original, oldW, oldH, padLeft, padTop, newW, newH);
    selectionMask = padMask(selectionMask, oldW, oldH, padLeft, padTop, newW, newH);
    selectionScratch = new Uint8Array(newW * newH);
    history.mapFrames((frame) => {
        if (frame.length !== oldW * oldH * 4) return frame;
        return padRgbaBuffer(frame, oldW, oldH, padLeft, padTop, newW, newH);
    });
    for (const stamp of stamps) {
        stamp.x += padLeft;
        stamp.y += padTop;
    }
    for (const stack of stampPast) {
        for (const stamp of stack) {
            stamp.x += padLeft;
            stamp.y += padTop;
        }
    }
    for (const stack of stampFuture) {
        for (const stamp of stack) {
            stamp.x += padLeft;
            stamp.y += padTop;
        }
    }

    width = newW;
    height = newH;
    working.width = width;
    working.height = height;
    const nextWorking = working.getContext('2d', { willReadFrequently: true });
    if (!nextWorking) throw new Error('Could not resize edit canvas');
    workingCtx = nextWorking;
    tintCanvas.width = width;
    tintCanvas.height = height;
    const nextTint = tintCanvas.getContext('2d');
    if (!nextTint) throw new Error('Could not resize selection overlay');
    tintCtx = nextTint;

    return { x: cx + padLeft, y: cy + padTop };
}

function placeOrRemoveStamp(x: number, y: number): void {
    const hit = hitTestStamp(stamps, x, y);
    if (hit) {
        pushEdit();
        stamps = stamps.filter((stamp) => stamp.id !== hit.id);
    } else {
        const kind = stampKind.value;
        if (!kind) return;
        const at = ensureStampFits(x, y, stampSize.value);
        pushEdit();
        stamps.push({
            id: nextStampId++,
            kind,
            x: at.x,
            y: at.y,
            size: stampSize.value,
        });
    }
    writeWorking();
    syncHistoryFlags();
    paint();
}

/** Bake session stamps into the pixel buffer (used on Save). */
function bakeStamps(): void {
    if (!stamps.length) return;
    for (const stamp of stamps) {
        stampIntoRgba(rgba, width, height, stamp.kind, stamp.x, stamp.y, stamp.size);
    }
    stamps = [];
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
            // Slow crawling ants in screen-stable dash length (Photoshop-like).
            const dash = Math.max(3, 6 / scale.value);
            const gap = dash;
            const widthPx = Math.max(1 / scale.value, 1.25 / scale.value);
            ctx.lineWidth = widthPx;
            ctx.setLineDash([dash, gap]);
            ctx.lineDashOffset = -antsPhase / scale.value;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.stroke(selectionPath);
            ctx.lineDashOffset = -(antsPhase / scale.value) + dash;
            ctx.strokeStyle = 'rgba(20,24,32,0.75)';
            ctx.stroke(selectionPath);
            ctx.setLineDash([]);
        }
    }

    if (rectDrag) {
        const left = Math.min(rectDrag.x0, rectDrag.x1);
        const top = Math.min(rectDrag.y0, rectDrag.y1);
        const rw = Math.abs(rectDrag.x1 - rectDrag.x0);
        const rh = Math.abs(rectDrag.y1 - rectDrag.y0);
        const dash = Math.max(3, 6 / scale.value);
        ctx.lineWidth = Math.max(1 / scale.value, 1.25 / scale.value);
        ctx.setLineDash([dash, dash]);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeRect(left, top, rw, rh);
        ctx.lineDashOffset = dash;
        ctx.strokeStyle = 'rgba(20,24,32,0.8)';
        ctx.strokeRect(left, top, rw, rh);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        ctx.fillStyle = 'rgba(90,160,255,0.12)';
        ctx.fillRect(left, top, rw, rh);
    }

    if (tool.value === 'stamp' && pointerInView && !panning && !spaceDown) {
        const hover = viewToImage(hoverClientX, hoverClientY);
        if (hover) {
            const hit = hitTestStamp(stamps, hover.x, hover.y);
            if (hit) {
                ctx.beginPath();
                ctx.arc(hit.x, hit.y, hit.size * 0.55, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 80, 80, 0.95)';
                ctx.lineWidth = Math.max(1.5 / scale.value, 2 / scale.value);
                ctx.setLineDash([4 / scale.value, 3 / scale.value]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (stampKind.value) {
                drawStampAt(ctx, stampKind.value, hover.x, hover.y, stampSize.value, 0.55);
            }
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

function selectModeFromEvent(event: PointerEvent): FloodSelectMode {
    if (event.ctrlKey || event.metaKey) return 'subtract';
    if (event.shiftKey) return 'add';
    return 'replace';
}

function clampImagePoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
        x: Math.min(width, Math.max(0, point.x)),
        y: Math.min(height, Math.max(0, point.y)),
    };
}

function finishRectDrag(): void {
    if (!rectDrag) return;
    const drag = rectDrag;
    rectDrag = null;
    if (Math.abs(drag.x1 - drag.x0) < 1 && Math.abs(drag.y1 - drag.y0) < 1) {
        paint();
        return;
    }
    rectSelect(width, height, drag.x0, drag.y0, drag.x1, drag.y1, selectionMask, drag.mode);
    rebuildSelectionVisuals();
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

    if (tool.value === 'rect') {
        const clamped = clampImagePoint(point);
        dragging = true;
        target.setPointerCapture(event.pointerId);
        event.preventDefault();
        rectDrag = {
            x0: clamped.x,
            y0: clamped.y,
            x1: clamped.x,
            y1: clamped.y,
            mode: selectModeFromEvent(event),
        };
        paint();
        return;
    }

    if (tool.value === 'stamp') {
        dragging = true;
        target.setPointerCapture(event.pointerId);
        event.preventDefault();
        placeOrRemoveStamp(point.x, point.y);
        dragging = false;
        return;
    }

    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return;

    dragging = true;
    target.setPointerCapture(event.pointerId);
    event.preventDefault();

    if (tool.value === 'wand') {
        floodSelect(
            rgba,
            width,
            height,
            point.x,
            point.y,
            fuzziness.value,
            selectionMask,
            selectModeFromEvent(event),
            selectionScratch,
        );
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
            hasColorTarget.value = true;
            applyColorSelection();
        }
        dragging = false;
        return;
    }

    pushEdit();
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

    if (tool.value === 'rect' && dragging && rectDrag) {
        const point = viewToImage(event.clientX, event.clientY);
        if (!point) return;
        const clamped = clampImagePoint(point);
        rectDrag.x1 = clamped.x;
        rectDrag.y1 = clamped.y;
        paint();
        return;
    }

    if (tool.value === 'stamp') {
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
    if (tool.value === 'rect' && rectDrag) finishRectDrag();
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
    if (!history.canUndo) return;
    stampFuture.push(cloneStamps(stamps));
    stamps = stampPast.pop() ?? [];
    if (!history.undo(rgba)) {
        stampPast.push(stamps);
        stamps = stampFuture.pop() ?? [];
        return;
    }
    writeWorking();
    clearSelection();
    syncHistoryFlags();
    if (tool.value === 'color' && hasColorTarget.value) applyColorSelection();
}

function doRedo(): void {
    if (!history.canRedo) return;
    stampPast.push(cloneStamps(stamps));
    stamps = stampFuture.pop() ?? [];
    if (!history.redo(rgba)) {
        stampFuture.push(stamps);
        stamps = stampPast.pop() ?? [];
        return;
    }
    writeWorking();
    clearSelection();
    syncHistoryFlags();
    if (tool.value === 'color' && hasColorTarget.value) applyColorSelection();
}

function revertToOriginal(): void {
    confirmRevert.value = false;
    if (buffersMatch(rgba, original) && stamps.length === 0) {
        syncHistoryFlags();
        return;
    }
    pushEdit();
    rgba.set(original);
    stamps = [];
    writeWorking();
    clearSelection();
    syncHistoryFlags();
    if (tool.value === 'color' && hasColorTarget.value) applyColorSelection();
}

function onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    if (confirmRevert.value) {
        if (event.key === 'Escape') {
            event.preventDefault();
            confirmRevert.value = false;
        }
        return;
    }

    if (event.code === 'Space') {
        spaceDown = true;
        event.preventDefault();
        paint();
        return;
    }

    if (event.key === 'Escape') {
        if (tool.value === 'stamp' && stampKind.value) {
            event.preventDefault();
            stampKind.value = null;
            paint();
            return;
        }
        if (hasSelection.value) {
            event.preventDefault();
            clearSelection();
        }
        return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelection.value) {
        event.preventDefault();
        deleteSelection();
        return;
    }

    if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        const step = event.shiftKey ? 2 : 1;
        if (tool.value === 'stamp') {
            const next = event.key === ']'
                ? stampSize.value + step
                : stampSize.value - step;
            stampSize.value = Math.min(96, Math.max(16, next));
            paint();
            return;
        }
        const next = event.key === ']'
            ? brushSize.value + step
            : brushSize.value - step;
        brushSize.value = Math.min(300, Math.max(2, next));
        if (tool.value !== 'eraser') tool.value = 'eraser';
        return;
    }

    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    if (key === 'd') {
        if (hasSelection.value) {
            event.preventDefault();
            clearSelection();
        }
        return;
    }
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
    bakeStamps();
    writeWorking();
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(working, 0, 0);
    emit('apply', out, history.exportSnapshot());
}

function antsLoop(now: number): void {
    antsRaf = requestAnimationFrame(antsLoop);
    if (!hasSelection.value) return;
    // ~12 fps crawl — readable ants without strobing a full redraw.
    if (now - lastAntPaint < 80) return;
    lastAntPaint = now;
    antsPhase = (now / 140) % 1000;
    paint();
}

watch([brushSize, stampSize, stampKind, tool], () => {
    paint();
});

watch(fuzziness, () => {
    if (tool.value === 'color' && hasColorTarget.value) applyColorSelection();
});

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    document.body.classList.add('rubber-ie-open');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    syncHistoryFlags();
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
    stamps = [];
    stampPast = [];
    stampFuture = [];
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
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
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
    justify-self: start;
}

.ie-brand-mark {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: linear-gradient(135deg, #5b9cff, #3d7cf0);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
}

.ie-top-center {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.ie-top-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    justify-self: end;
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

.ie-btn-icon {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.ie-btn:hover:not(:disabled) {
    background: #363c48;
    border-color: #525b6a;
}

.ie-btn:disabled {
    opacity: 0.35;
    cursor: default;
}

.ie-btn-save {
    background: #2f9e5a;
    border-color: #248a4b;
    color: #fff;
}

.ie-btn-save:hover:not(:disabled) {
    background: #37b067;
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

.ie-tool-multiline {
    display: block;
    line-height: 1.15;
    text-align: center;
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

.ie-selection-bar {
    position: absolute;
    left: 50%;
    bottom: 18px;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    transform: translateX(-50%);
    background: rgba(34, 38, 46, 0.94);
    border: 1px solid #3a414d;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    animation: ie-selection-in 160ms ease-out;
}

@keyframes ie-selection-in {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

.ie-options {
    padding: 14px 14px 18px;
    background: #22262e;
    border-left: 1px solid #0f1115;
    overflow: auto;
}

.ie-stamp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 14px;
}

.ie-stamp-grid-numbers {
    grid-template-columns: repeat(4, 1fr);
}

.ie-stamp-swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px 6px;
    border: 1px solid #3a414d;
    border-radius: 8px;
    background: #2c313a;
    color: #c5cad3;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.15;
    text-align: center;
    cursor: pointer;
}

.ie-stamp-swatch:hover {
    background: #363c48;
    border-color: #525b6a;
    color: #fff;
}

.ie-stamp-swatch.active {
    background: rgba(61, 124, 240, 0.18);
    border-color: rgba(91, 156, 255, 0.55);
    color: #fff;
}

.ie-stamp-swatch-number {
    padding: 6px 2px;
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

.cursor-cross {
    cursor: crosshair;
}

.cursor-eyedrop {
    cursor: copy;
}

.cursor-stamp {
    cursor: cell;
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
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #0f1115;
    box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.25),
        0 0 0 1px #3a414d;
}

.ie-swatch.empty {
    background-color: #1b1e24;
    background-image:
        linear-gradient(45deg, #3a414d 25%, transparent 25%),
        linear-gradient(-45deg, #3a414d 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #3a414d 75%),
        linear-gradient(-45deg, transparent 75%, #3a414d 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
}

.ie-swatch-caption {
    font-size: 11px;
    line-height: 1.3;
    color: #c5cad3;
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
