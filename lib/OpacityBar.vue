<template>
    <div
        class='rubber-opacity'
        role='group'
        aria-label='Transparency'
    >
        <span>0</span>
        <input
            class='rubber-opacity-range'
            type='range'
            min='0'
            max='100'
            :value='opacityState.value'
            :aria-valuenow='opacityState.value'
            aria-valuemin='0'
            aria-valuemax='100'
            aria-label='Transparency'
            @input='onInput'
        >
        <span>100</span>
    </div>
</template>

<script setup lang='ts'>
import { opacityState, setOpacity } from './opacity.ts';

function onInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    setOpacity(Number(target.value));
}
</script>

<style scoped>
.rubber-opacity {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 14px;
    border-radius: 8px;
    background: rgba(20, 24, 28, 0.92);
    color: #fff;
    min-width: 260px;
    user-select: none;
}

.rubber-opacity-range {
    flex: 1 1 auto;
    width: 180px;
    accent-color: #206bc4;
}
</style>
