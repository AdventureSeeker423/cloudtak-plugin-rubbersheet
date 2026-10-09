<template>
    <ImageEditor
        v-if='editing && editSource && editPristine'
        :source='editSource'
        :pristine='editPristine'
        :history='editHistory'
        @apply='onEditApply'
        @cancel='onEditCancel'
    />
    <div
        v-else
        class='p-3'
    >
        <p class='text-secondary mb-3'>
            Drag a corner to warp the sheet. Hold Shift to scale about the
            opposite corner, or Alt (or Shift+Alt) to scale from the center —
            press or release mid-drag to switch modes. Drag the rotate icon to
            rotate, or drag the image to move it.
            Use Edit Image for a fullscreen wand / eraser editor.
        </p>

        <label
            class='form-label'
            for='rubber-sheet-file'
        >Image or PDF</label>
        <input
            id='rubber-sheet-file'
            class='form-control mb-3'
            type='file'
            accept='image/png,image/jpeg,image/webp,image/gif,application/pdf,.png,.jpg,.jpeg,.webp,.gif,.pdf'
            :disabled='sheetUi.busy'
            @change='onFile'
        >

        <PdfPagePicker v-if='sheetUi.pageThumbs' />

        <button
            v-else-if='sheetUi.pageCount > 1 && sheetUi.hasSheet'
            type='button'
            class='btn btn-outline-secondary mb-3'
            :disabled='sheetUi.busy'
            @click='openPagePicker'
        >
            Change PDF page ({{ sheetUi.page }} of {{ sheetUi.pageCount }})
        </button>

        <button
            v-if='sheetUi.hasSheet'
            type='button'
            class='btn btn-outline-primary mb-3 w-100'
            :disabled='sheetUi.busy'
            @click='openEditor'
        >
            Edit Image
        </button>

        <label
            class='form-label'
            for='rubber-sheet-name'
        >Name</label>
        <input
            id='rubber-sheet-name'
            class='form-control mb-3'
            type='text'
            :value='sheetUi.name'
            :disabled='sheetUi.busy'
            @input='onName'
        >

        <label
            class='form-label'
            for='rubber-sheet-format'
        >Export File Type</label>
        <select
            id='rubber-sheet-format'
            class='form-select mb-3'
            :value='sheetUi.exportType'
            :disabled='sheetUi.busy'
            @change='onFormat'
        >
            <option
                value=''
                disabled
            >
                Select a format
            </option>
            <option value='kmz'>
                KMZ
            </option>
            <option value='geotiff'>
                GeoTIFF
            </option>
            <option value='geopdf'>
                GeoPDF
            </option>
            <option value='zip'>
                Zipped bundle (all included)
            </option>
        </select>

        <div class='d-grid gap-2'>
            <button
                type='button'
                class='btn btn-primary'
                :disabled='!canExport'
                @click='downloadCurrent'
            >
                Download
            </button>
            <button
                type='button'
                class='btn btn-success'
                :disabled='!canExport'
                @click='openMissionPicker'
            >
                Upload to Data Sync
            </button>
            <button
                type='button'
                class='btn btn-outline-primary'
                :disabled='!sheetUi.hasSheet || sheetUi.busy'
                @click='onAddOverlay'
            >
                Add to Map as Overlay
            </button>
            <button
                type='button'
                class='btn btn-outline-secondary'
                :disabled='!sheetUi.hasSheet || sheetUi.busy'
                @click='clearSheet'
            >
                Remove
            </button>
        </div>

        <p
            v-if='sheetUi.error'
            class='text-danger mt-3 mb-0'
        >
            {{ sheetUi.error }}
        </p>
        <p
            v-if='sheetUi.status'
            class='text-secondary mt-3 mb-0'
        >
            {{ sheetUi.status }}
        </p>

        <div
            v-if='sheetUi.missions'
            class='mt-3'
        >
            <p
                v-if='sheetUi.missions.length === 0'
                class='mb-2'
            >
                No data syncs available to upload to.
            </p>
            <template v-else>
                <p class='text-secondary small mb-2'>
                    Choose a data sync (same list as Share → Data Sync).
                </p>
                <div class='d-grid gap-2'>
                    <button
                        v-for='mission in sheetUi.missions'
                        :key='mission.guid'
                        type='button'
                        class='btn btn-outline-primary'
                        :disabled='sheetUi.busy'
                        @click='uploadCurrent(mission)'
                    >
                        {{ mission.name }}
                    </button>
                </div>
            </template>
            <button
                type='button'
                class='btn btn-link px-0 mt-2'
                :disabled='sheetUi.busy'
                @click='closeMissionPicker'
            >
                Cancel
            </button>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, shallowRef } from 'vue';
import type { PluginAPI } from '@tak-ps/cloudtak';
import ImageEditor from './ImageEditor.vue';
import PdfPagePicker from './PdfPagePicker.vue';
import type { EditHistorySnapshot } from './edit-history.ts';
import {
    addCurrentAsOverlay,
    applyEditedCanvas,
    bind,
    clearSheet,
    closeMissionPicker,
    downloadCurrent,
    getEditSession,
    loadUserFile,
    openMissionPicker,
    openPagePicker,
    uploadCurrent,
} from './sheet.ts';
import { sheetUi } from './ui-state.ts';

const props = defineProps<{
    api: PluginAPI;
}>();

const editing = ref(false);
const editSource = shallowRef<HTMLCanvasElement | null>(null);
const editPristine = shallowRef<Uint8Array | null>(null);
const editHistory = shallowRef<EditHistorySnapshot | null>(null);

const canExport = computed(() => {
    return sheetUi.hasSheet && sheetUi.exportType !== '' && !sheetUi.busy;
});

onMounted(() => {
    bind(props.api);
});

function openEditor(): void {
    const session = getEditSession();
    if (!session) return;
    editSource.value = session.source;
    editPristine.value = session.pristine;
    editHistory.value = session.history;
    editing.value = true;
    sheetUi.error = '';
    sheetUi.status = '';
}

function onEditApply(canvas: HTMLCanvasElement, history: EditHistorySnapshot): void {
    try {
        applyEditedCanvas(canvas, history);
        sheetUi.status = 'Image edits applied';
    } catch (err) {
        sheetUi.error = err instanceof Error ? err.message : String(err);
    }
    editing.value = false;
    editSource.value = null;
    editPristine.value = null;
    editHistory.value = null;
}

function onEditCancel(): void {
    editing.value = false;
    editSource.value = null;
    editPristine.value = null;
    editHistory.value = null;
}

function onAddOverlay(): void {
    void addCurrentAsOverlay(() => {
        void props.api.router.push('/menu/overlays');
    });
}

function onFile(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    target.value = '';
    if (file) void loadUserFile(file);
}

function onName(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    sheetUi.name = target.value;
}

function onFormat(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if (value === '' || value === 'kmz' || value === 'geotiff' || value === 'geopdf' || value === 'zip') {
        sheetUi.exportType = value;
    }
}
</script>
