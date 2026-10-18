<template>
    <TablerPillGroup
        class='rubber-warp-strip'
        :model-value='sheetUi.warpMode'
        :options='options'
        :rounded='false'
        size='default'
        padding=''
        :name='props.name'
        @update:model-value='onWarpMode'
    />
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { TablerPillGroup } from '@tak-ps/vue-tabler';
import { sheetUi } from './ui-state.ts';
import type { WarpMode } from './warp-mode.ts';

const props = withDefaults(defineProps<{
    /** Radio group name. Must differ between instances that are on screen together. */
    name?: string;
    /** Short labels for narrow places such as the map bar. */
    compact?: boolean;
}>(), {
    name: 'rubber-sheet-warp-mode',
    compact: false,
});

const options = computed<{ value: WarpMode; label: string }[]>(() => [
    { value: 'free', label: 'Free' },
    { value: 'scale-corner', label: props.compact ? 'Corner' : 'Scale corner' },
    { value: 'scale-center', label: props.compact ? 'Center' : 'Scale center' },
]);

function onWarpMode(value: string): void {
    if (value === 'free' || value === 'scale-corner' || value === 'scale-center') {
        sheetUi.warpMode = value;
    }
}
</script>

<style scoped>
@media (pointer: coarse) {
    :deep(.btn) {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
}
</style>
