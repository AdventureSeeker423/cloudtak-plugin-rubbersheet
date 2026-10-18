<template>
    <div
        class='rubber-pane d-flex flex-column gap-2 py-2'
    >
        <TablerInlineAlert
            v-if='sheetUi.error'
            severity='danger'
            title='Something went wrong'
            :description='sheetUi.error'
        />
        <template v-if='sheetUi.success'>
            <TablerInlineAlert
                severity='success'
                :title='sheetUi.success'
            />
            <div class='d-flex justify-content-end'>
                <TablerButton
                    class='rubber-action'
                    title='Close and keep the sheet on the map'
                    @click='onClose'
                >
                    Close
                </TablerButton>
            </div>
        </template>

        <div
            class='visually-hidden'
            role='status'
            aria-live='polite'
        >
            {{ sheetUi.busy ? (sheetUi.status || 'Working…') : '' }}
        </div>
        <TablerLoading
            v-if='sheetUi.busy'
            :desc='sheetUi.status || "Working…"'
        />

        <input
            ref='fileInput'
            class='d-none'
            type='file'
            accept='image/png,image/jpeg,image/webp,image/gif,application/pdf,.png,.jpg,.jpeg,.webp,.gif,.pdf'
            @change='onFile'
        >

        <div
            v-if='!sheetUi.hasSheet && !sheetUi.busy'
            class='d-flex flex-column gap-3 px-2'
        >
            <p class='text-secondary mb-0'>
                Place an image or PDF on the map and align it by dragging its corners.
            </p>
            <TablerButton
                class='btn-primary rubber-action w-100'
                title='Choose an image or PDF'
                @click='chooseFile'
            >
                <IconUpload
                    :size='20'
                    stroke='1'
                    class='me-2'
                />
                Choose image or PDF
            </TablerButton>
        </div>

        <template v-if='sheetUi.hasSheet'>
            <SlideDownHeader
                v-model='adjustOpen'
                label='Adjust'
            >
                <template #icon>
                    <IconAdjustments
                        :size='20'
                        stroke='1'
                        class='me-2'
                    />
                </template>
                <div class='d-flex flex-column gap-2 px-2 pt-2'>
                    <div class='form-label mb-0'>
                        Corner drag
                    </div>
                    <WarpModeStrip />
                    <p
                        v-if='touchWording'
                        class='text-secondary small mb-0'
                    >
                        The Adjust bar on the map has Undo, Redo, Move and Opacity.
                    </p>
                    <p
                        v-else
                        class='text-secondary small mb-0'
                    >
                        Opacity is on the bar at the bottom of the map. Undo and Redo are in the header.
                    </p>
                </div>
            </SlideDownHeader>

            <SlideDownHeader
                v-model='imageOpen'
                label='Image'
            >
                <template #icon>
                    <IconPhoto
                        :size='20'
                        stroke='1'
                        class='me-2'
                    />
                </template>
                <div class='d-flex flex-column gap-2 px-2 pt-2'>
                    <TablerInput
                        :model-value='sheetUi.name'
                        label='Name'
                        :disabled='sheetUi.busy'
                        @update:model-value='onName'
                    />
                    <TablerButton
                        ref='editButton'
                        class='btn-outline-primary rubber-action w-100'
                        title='Edit the image'
                        :disabled='sheetUi.busy'
                        @click='openEditor'
                    >
                        <IconPhotoEdit
                            :size='20'
                            stroke='1'
                            class='me-2'
                        />
                        Edit Image
                    </TablerButton>
                    <TablerButton
                        v-if='sheetUi.pageCount > 1'
                        class='btn-outline-secondary rubber-action w-100'
                        title='Choose another page of the PDF'
                        :disabled='sheetUi.busy'
                        @click='openPagePicker'
                    >
                        <IconFileTypePdf
                            :size='20'
                            stroke='1'
                            class='me-2'
                        />
                        Change PDF page ({{ sheetUi.page }} of {{ sheetUi.pageCount }})
                    </TablerButton>
                    <TablerButton
                        class='btn-outline-secondary rubber-action w-100'
                        title='Choose a different image or PDF'
                        :disabled='sheetUi.busy'
                        @click='chooseFile'
                    >
                        <IconReplace
                            :size='20'
                            stroke='1'
                            class='me-2'
                        />
                        Choose a different file
                    </TablerButton>
                </div>
            </SlideDownHeader>

            <SlideDownHeader
                v-model='exportOpen'
                label='Export'
            >
                <template #icon>
                    <IconFileExport
                        :size='20'
                        stroke='1'
                        class='me-2'
                    />
                </template>
                <div class='d-flex flex-column gap-2 px-2 pt-2'>
                    <div class='form-label mb-0'>
                        Format
                    </div>
                    <TablerPillGroup
                        class='rubber-format'
                        :model-value='sheetUi.exportType'
                        :options='formats'
                        :rounded='false'
                        size='default'
                        padding=''
                        name='rubber-sheet-format'
                        :disabled='sheetUi.busy'
                        @update:model-value='onFormat'
                    />
                    <p
                        class='text-secondary small mb-1'
                        aria-live='polite'
                    >
                        {{ formatHint }}
                    </p>
                    <TablerButton
                        class='btn-primary rubber-action w-100'
                        title='Download the export'
                        :disabled='!canExport'
                        @click='onDownload'
                    >
                        <IconDownload
                            :size='20'
                            stroke='1'
                            class='me-2'
                        />
                        Download
                    </TablerButton>
                    <TablerButton
                        class='btn-outline-primary rubber-action w-100'
                        title='Add the export to a Data Sync'
                        :disabled='!canExport'
                        @click='openMissionPicker'
                    >
                        <IconCloudPin
                            :size='20'
                            stroke='1'
                            class='me-2'
                        />
                        Add to Data Sync
                    </TablerButton>
                    <TablerButton
                        class='btn-outline-primary rubber-action w-100'
                        title='Add the sheet to the map as an overlay'
                        :disabled='!sheetUi.hasSheet || sheetUi.busy'
                        @click='onAddOverlay'
                    >
                        <IconMapPlus
                            :size='20'
                            stroke='1'
                            class='me-2'
                        />
                        Add to Map as Overlay
                    </TablerButton>
                </div>
            </SlideDownHeader>
        </template>

        <SlideDownHeader
            v-model='helpOpen'
            label='How it works'
        >
            <template #icon>
                <IconHelp
                    :size='20'
                    stroke='1'
                    class='me-2'
                />
            </template>
            <ul class='text-secondary small ps-4 pe-2 pt-2 mb-0'>
                <template v-if='touchWording'>
                    <li>Drag a corner handle to warp the sheet and the round handle to rotate it.</li>
                    <li>Pick a corner drag mode to scale from the opposite corner or from the center.</li>
                    <li>Tap Move on the map bar to drag the whole sheet with one finger. Otherwise one finger pans the map.</li>
                    <li>Two fingers pan and zoom the map.</li>
                </template>
                <template v-else>
                    <li>Drag a corner to warp the sheet. Hold Shift to scale about the opposite corner or Alt to scale about the center. Press or release mid-drag to switch.</li>
                    <li>Drag the rotate handle to rotate, or drag the image to move it.</li>
                    <li>Undo with Ctrl/Cmd+Z and redo with Ctrl+Y.</li>
                </template>
                <li>Edit Image erases areas and adds facility icons.</li>
            </ul>
        </SlideDownHeader>

        <TablerButton
            v-if='sheetUi.hasSheet'
            class='btn-outline-danger rubber-action w-100 mt-2'
            title='Remove the sheet from the map'
            :disabled='sheetUi.busy'
            @click='confirmRemove = true'
        >
            <IconTrash
                :size='20'
                stroke='1'
                class='me-2'
            />
            Remove Sheet
        </TablerButton>
    </div>

    <PdfPagePicker v-if='sheetUi.pageThumbs' />

    <DataSyncPicker
        v-if='sheetUi.pickerOpen'
        @close='closeMissionPicker'
        @confirm='onUpload'
    />

    <RemoveSheetConfirm
        v-if='confirmRemove'
        @close='confirmRemove = false'
        @confirm='onRemove'
    />
</template>

<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue';
import type { PluginAPI } from '@tak-ps/cloudtak';
import {
    TablerButton,
    TablerInlineAlert,
    TablerInput,
    TablerLoading,
    TablerPillGroup,
} from '@tak-ps/vue-tabler';
import {
    IconAdjustments,
    IconCloudPin,
    IconDownload,
    IconFileExport,
    IconFileTypePdf,
    IconHelp,
    IconMapPlus,
    IconPhoto,
    IconPhotoEdit,
    IconReplace,
    IconTrash,
    IconUpload,
} from '@tabler/icons-vue';
// Host modules (the plugin is built inside app/plugins/<name>/, like lib/overlay.ts).
import SlideDownHeader from '../../../src/components/CloudTAK/util/SlideDownHeader.vue';
import { useAppStore } from '../../../src/stores/app.ts';
import DataSyncPicker from './DataSyncPicker.vue';
import { touchWording as useTouchWording } from './device.ts';
import PdfPagePicker from './PdfPagePicker.vue';
import RemoveSheetConfirm from './RemoveSheetConfirm.vue';
import WarpModeStrip from './WarpModeStrip.vue';
import { EDIT_ROUTE_NAME, FORMAT_KEY } from './constants.ts';
import { beginEditSession, returnFocus } from './edit-session.ts';
import { parseExportType, saveExportType } from './export-type.ts';
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
import { sheetUi, type MissionChoice } from './ui-state.ts';

const props = defineProps<{
    api: PluginAPI;
}>();

const appStore = useAppStore();

const fileInput = ref<HTMLInputElement | null>(null);
const confirmRemove = ref(false);

// First section open; on phones the others start collapsed to keep the pane short.
// The choice lives in sheetUi so it survives the pane being rebuilt after the image editor route.
function section(key: keyof typeof sheetUi.sections, defaultOpen: () => boolean) {
    return computed({
        get: () => sheetUi.sections[key] ?? defaultOpen(),
        set: (value: boolean) => {
            sheetUi.sections[key] = value;
        },
    });
}
const adjustOpen = section('adjust', () => true);
const imageOpen = section('image', () => !appStore.isMobileDetected);
const exportOpen = section('export', () => !appStore.isMobileDetected);
const helpOpen = section('help', () => false);

/** Keyboard keys are never mentioned on a touch screen or a phone-sized window. */
const touchWording = computed(() => useTouchWording(appStore.isMobileDetected));

const formats = [
    { value: 'kmz', label: 'KMZ' },
    { value: 'geotiff', label: 'GeoTIFF' },
    { value: 'geopdf', label: 'GeoPDF' },
    { value: 'zip', label: 'ZIP' },
];

const formatHints: Record<string, string> = {
    kmz: 'Image overlay for TAK clients and Google Earth.',
    geotiff: 'GIS raster file with its map position.',
    geopdf: 'PDF with its map position, for GIS tools and printing.',
    zip: 'KMZ, GeoTIFF and GeoPDF together in one file.',
};

const formatHint = computed(() => formatHints[sheetUi.exportType] ?? '');

const canExport = computed(() => {
    return sheetUi.hasSheet && sheetUi.exportType !== '' && !sheetUi.busy;
});

const editButton = ref<{ $el: HTMLElement } | null>(null);

onMounted(() => {
    bind(props.api);
    // Opening the pane brings the handles back after Done on the Adjust bar.
    sheetUi.adjusting = true;
    if (returnFocus.edit) {
        // Back from the editor: keyboard focus goes to the button that opened it.
        returnFocus.edit = false;
        // After the host menu modal has taken focus for itself.
        setTimeout(() => editButton.value?.$el?.focus(), 150);
    }
});

/** The editor is its own route, so Back (browser or hardware) leaves it and returns to this pane. */
function openEditor(): void {
    if (!beginEditSession()) return;
    sheetUi.error = '';
    sheetUi.success = '';
    sheetUi.status = '';
    returnFocus.edit = true;
    const { router } = props.api;
    void router.push({ name: EDIT_ROUTE_NAME });
}

function onRemove(): void {
    confirmRemove.value = false;
    void clearSheet();
}

/** Closes the pane and keeps the sheet on the map (same as the host Close button). */
function onClose(): void {
    const { router } = props.api;
    void router.push('/');
}

function chooseFile(): void {
    fileInput.value?.click();
}

function onDownload(): void {
    void downloadCurrent();
}

function onUpload(missions: MissionChoice[]): void {
    void uploadCurrent(missions);
}

function onAddOverlay(): void {
    void addCurrentAsOverlay();
}

function onFile(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    target.value = '';
    if (file) void loadUserFile(file);
}

function onName(value: string | number): void {
    sheetUi.name = String(value);
}

function onFormat(value: string): void {
    const type = parseExportType(value);
    if (!type) return;
    sheetUi.exportType = type;
    saveExportType(typeof localStorage === 'undefined' ? undefined : localStorage, FORMAT_KEY, type);
}
</script>

<style scoped>
@media (prefers-reduced-motion: reduce) {
    .rubber-pane,
    .rubber-pane :deep(*) {
        transition: none !important;
        animation: none !important;
    }
}
.rubber-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* Four labels must fit a 360 px phone without pushing the pane wider. */
.rubber-format :deep(.btn) {
    min-width: 0;
    padding-inline: 0.4rem;
}

@media (pointer: coarse) {
    .rubber-action,
    :deep(.btn) {
        min-height: 44px;
    }
}
</style>
