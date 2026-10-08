<template>
    <div class='pdf-page-picker mb-3'>
        <p class='form-label mb-2'>
            Choose a PDF page
        </p>
        <div class='pdf-page-grid'>
            <button
                v-for='(thumb, index) in sheetUi.pageThumbs'
                :key='index'
                type='button'
                class='pdf-page-card'
                :class='{ active: sheetUi.page === index + 1 && sheetUi.hasSheet }'
                :disabled='sheetUi.busy || thumb === null'
                @click='pick(index + 1)'
            >
                <div class='pdf-page-thumb'>
                    <span
                        v-if='thumb === null'
                        class='text-secondary'
                    >…</span>
                    <span
                        v-else-if='thumb === ""'
                        class='text-secondary'
                    >?</span>
                    <img
                        v-else
                        :src='thumb'
                        :alt='`Page ${index + 1}`'
                    >
                </div>
                <span class='pdf-page-label'>Page {{ index + 1 }}</span>
            </button>
        </div>
        <button
            v-if='sheetUi.hasSheet'
            type='button'
            class='btn btn-link px-0 mt-2'
            :disabled='sheetUi.busy'
            @click='closePagePicker'
        >
            Cancel
        </button>
    </div>
</template>

<script setup lang='ts'>
import { closePagePicker, setPdfPage } from './sheet.ts';
import { sheetUi } from './ui-state.ts';

function pick(page: number): void {
    void setPdfPage(page);
}
</script>

<style scoped>
.pdf-page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 10px;
}

.pdf-page-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    color: inherit;
    cursor: pointer;
}

.pdf-page-card:disabled {
    opacity: 0.65;
    cursor: wait;
}

.pdf-page-card.active {
    border-color: #206bc4;
    box-shadow: 0 0 0 1px #206bc4;
}

.pdf-page-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    background: #1a1f24;
    border-radius: 4px;
    overflow: hidden;
}

.pdf-page-thumb img {
    max-width: 100%;
    max-height: 140px;
    object-fit: contain;
}

.pdf-page-label {
    font-size: 0.85rem;
    text-align: center;
}
</style>
