<template>
    <TablerModal size='xl'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='closePagePicker'
        />
        <div class='rubber-pages-frame d-flex flex-column'>
            <div class='modal-header text-body flex-shrink-0'>
                <div class='d-flex align-items-center'>
                    <IconFileTypePdf
                        :size='28'
                        stroke='1'
                    />
                    <span class='mx-2'>Choose a PDF page</span>
                </div>
            </div>
            <div class='modal-body text-body rubber-pages-body'>
                <div
                    v-if='loaded < total'
                    class='mb-3'
                    aria-live='polite'
                >
                    <div class='text-secondary small mb-1'>
                        Rendering previews ({{ loaded }} of {{ total }})
                    </div>
                    <TablerProgress :percent='total ? loaded / total : 0' />
                </div>
                <div class='rubber-pages-grid'>
                    <button
                        v-for='(thumb, index) in sheetUi.pageThumbs'
                        :key='index'
                        type='button'
                        class='rubber-pages-card cloudtak-hover'
                        :class='{ active: sheetUi.page === index + 1 && sheetUi.hasSheet }'
                        :disabled='sheetUi.busy || thumb === null'
                        :aria-label='`Page ${index + 1}`'
                        @click='pick(index + 1)'
                    >
                        <div class='rubber-pages-thumb'>
                            <span
                                v-if='thumb === null'
                                class='spinner-border spinner-border-sm text-secondary'
                                role='status'
                            />
                            <span
                                v-else-if='thumb === ""'
                                class='text-secondary'
                            >No preview</span>
                            <img
                                v-else
                                :src='thumb'
                                :alt='`Page ${index + 1}`'
                            >
                        </div>
                        <span class='rubber-pages-label'>Page {{ index + 1 }}</span>
                    </button>
                </div>
            </div>
            <div class='modal-footer flex-shrink-0'>
                <TablerButton
                    title='Cancel'
                    :disabled='sheetUi.busy'
                    @click='closePagePicker'
                >
                    Cancel
                </TablerButton>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { TablerButton, TablerModal, TablerProgress } from '@tak-ps/vue-tabler';
import { IconFileTypePdf } from '@tabler/icons-vue';
import { closePagePicker, setPdfPage } from './sheet.ts';
import { sheetUi } from './ui-state.ts';

const total = computed(() => sheetUi.pageThumbs?.length ?? 0);
const loaded = computed(() => (sheetUi.pageThumbs ?? []).filter((thumb) => thumb !== null).length);

function pick(page: number): void {
    void setPdfPage(page);
}
</script>

<style scoped>
.rubber-pages-frame {
    max-height: calc(100dvh - 3.5rem);
}

/* On phones the picker takes the whole screen below the status bar, like the host menu modal. */
@media (max-width: 576px), (max-height: 576px) {
    .rubber-pages-frame {
        height: calc(100dvh - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
        max-height: none;
    }
}

.rubber-pages-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem;
}

.rubber-pages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
    gap: 8px;
}

.rubber-pages-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    min-height: 44px;
    padding: 4px;
    border: 1px solid var(--cloudtak-inset-border);
    border-radius: 6px;
    background: var(--cloudtak-inset-bg);
    color: inherit;
    cursor: pointer;
}

.rubber-pages-card:disabled {
    opacity: 0.65;
    cursor: wait;
}

.rubber-pages-card.active {
    border-color: var(--tblr-primary);
    box-shadow: 0 0 0 1px var(--tblr-primary);
}

.rubber-pages-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    border-radius: 4px;
    overflow: hidden;
}

.rubber-pages-thumb img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    background: #fff;
}

@media (pointer: coarse) {
    .modal-footer :deep(.btn) {
        min-height: 44px;
    }
}

.rubber-pages-label {
    font-size: 0.85rem;
    text-align: center;
}
</style>
