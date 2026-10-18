<template>
    <div class='d-flex align-items-center gap-1'>
        <TablerIconButton
            :title='undoTitle'
            :disabled='!sheetUi.canUndoTransform'
            @click='onUndo'
        >
            <IconArrowBackUp
                :size='32'
                stroke='1'
            />
        </TablerIconButton>
        <TablerIconButton
            :title='redoTitle'
            :disabled='!sheetUi.canRedoTransform'
            @click='onRedo'
        >
            <IconArrowForwardUp
                :size='32'
                stroke='1'
            />
        </TablerIconButton>
        <button
            v-if='sheetUi.hasSheet'
            type='button'
            class='btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1'
            title='Remove Sheet'
            aria-label='Remove Sheet'
            @click='confirmRemove = true'
        >
            <IconTrash
                :size='16'
                stroke='1'
            />
            <span class='d-none d-sm-inline'>Remove Sheet</span>
        </button>
        <RemoveSheetConfirm
            v-if='confirmRemove'
            @close='confirmRemove = false'
            @confirm='onRemove'
        />
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconArrowBackUp, IconArrowForwardUp, IconTrash } from '@tabler/icons-vue';
import { useAppStore } from '../../../src/stores/app.ts';
import { touchWording } from './device.ts';
import RemoveSheetConfirm from './RemoveSheetConfirm.vue';
import { clearSheet, redoSheetTransform, undoSheetTransform } from './sheet.ts';
import { sheetUi } from './ui-state.ts';

const confirmRemove = ref(false);

// Keyboard shortcuts are only mentioned where there is a keyboard.
const appStore = useAppStore();
const touch = computed(() => touchWording(appStore.isMobileDetected));
const undoTitle = computed(() => touch.value ? 'Undo' : 'Undo (Ctrl+Z)');
const redoTitle = computed(() => touch.value ? 'Redo' : 'Redo (Ctrl+Y)');

// TablerIconButton still emits click while disabled.
function onUndo(): void {
    if (sheetUi.canUndoTransform) undoSheetTransform();
}

function onRedo(): void {
    if (sheetUi.canRedoTransform) redoSheetTransform();
}

function onRemove(): void {
    confirmRemove.value = false;
    void clearSheet();
}
</script>

<style scoped>
@media (pointer: coarse) {
    .btn,
    :deep([role='button']) {
        min-width: 44px;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
}
</style>
