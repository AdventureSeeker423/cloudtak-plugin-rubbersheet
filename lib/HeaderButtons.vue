<template>
    <div class='d-flex align-items-center gap-1'>
        <button
            type='button'
            class='btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1'
            title='Undo (Ctrl+Z)'
            :disabled='!sheetUi.canUndoTransform'
            @click='onUndo'
        >
            <svg
                viewBox='0 0 24 24'
                width='15'
                height='15'
                aria-hidden='true'
            >
                <path
                    fill='currentColor'
                    d='M12.5 8c-2.6 0-5 1-6.9 2.6L3 8v8h8l-2.6-2.6A6.9 6.9 0 0 1 12.5 11c3 0 5.6 1.9 6.6 4.6l2.3-.8C20 11.3 16.5 8 12.5 8z'
                />
            </svg>
            Undo
        </button>
        <button
            type='button'
            class='btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1'
            title='Redo (Ctrl+Y)'
            :disabled='!sheetUi.canRedoTransform'
            @click='onRedo'
        >
            <svg
                viewBox='0 0 24 24'
                width='15'
                height='15'
                aria-hidden='true'
            >
                <path
                    fill='currentColor'
                    d='M11.5 8c2.6 0 5 1 6.9 2.6L21 8v8h-8l2.6-2.6A6.9 6.9 0 0 0 11.5 11c-3 0-5.6 1.9-6.6 4.6l-2.3-.8C4 11.3 7.5 8 11.5 8z'
                />
            </svg>
            Redo
        </button>
        <button
            type='button'
            class='btn btn-sm btn-outline-secondary'
            title='Remove the sheet, or close Rubber Sheet if none is loaded'
            @click='onCancel'
        >
            Cancel
        </button>
    </div>
</template>

<script setup lang='ts'>
import type { PluginAPI } from '@tak-ps/cloudtak';
import { clearSheet, redoSheetTransform, undoSheetTransform } from './sheet.ts';
import { sheetUi } from './ui-state.ts';

const props = defineProps<{
    api: PluginAPI;
}>();

function onUndo(): void {
    undoSheetTransform();
}

function onRedo(): void {
    redoSheetTransform();
}

function onCancel(): void {
    if (sheetUi.hasSheet) {
        void clearSheet();
        return;
    }
    void props.api.router.push('/');
}
</script>
