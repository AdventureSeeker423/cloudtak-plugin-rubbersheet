<template>
    <div class='p-3'>
        <p class='text-secondary mb-3'>
            Drag a corner to warp the sheet. Shift-drag a corner to scale about
            the opposite corner. Alt-drag (or Shift+Alt) to scale from the center.
            Drag the blue knob to rotate, or drag the image to move it.
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
                No data sync you can write to. Subscribe to one first.
            </p>
            <div
                v-else
                class='d-grid gap-2'
            >
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
import { computed, onMounted } from 'vue';
import type { PluginAPI } from '@tak-ps/cloudtak';
import PdfPagePicker from './PdfPagePicker.vue';
import {
    addCurrentAsOverlay,
    bind,
    clearSheet,
    closeMissionPicker,
    downloadCurrent,
    loadUserFile,
    openMissionPicker,
    openPagePicker,
    uploadCurrent,
} from './sheet.ts';
import { sheetUi } from './ui-state.ts';

const props = defineProps<{
    api: PluginAPI;
}>();

const canExport = computed(() => {
    return sheetUi.hasSheet && sheetUi.exportType !== '' && !sheetUi.busy;
});

onMounted(() => {
    bind(props.api);
});

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
