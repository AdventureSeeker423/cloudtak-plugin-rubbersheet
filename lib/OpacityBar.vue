<template>
    <div
        class='rubber-opacity'
        role='group'
        aria-label='Opacity'
        @wheel.prevent='onWheel'
    >
        <div class='rubber-opacity-row'>
            <span>0%</span>
            <input
                class='rubber-opacity-range'
                type='range'
                min='0'
                max='100'
                step='1'
                :value='opacityState.value'
                :aria-valuenow='opacityState.value'
                aria-valuemin='0'
                aria-valuemax='100'
                aria-label='Opacity'
                @input='onInput'
            >
            <span>100%</span>
        </div>
        <div class='rubber-opacity-label'>
            Opacity {{ opacityState.value }}%
        </div>
    </div>
</template>

<script setup lang='ts'>
import { opacityState, setOpacity } from './opacity.ts';

function onInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    setOpacity(Number(target.value));
}

function onWheel(event: WheelEvent): void {
    const step = event.deltaY < 0 ? 5 : -5;
    setOpacity(opacityState.value + step);
}
</script>

<style scoped>
.rubber-opacity {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    height: 48px;
    padding: 4px 14px 6px;
    border-radius: 8px;
    background: rgba(20, 24, 28, 0.92);
    color: #fff;
    min-width: 280px;
    user-select: none;
}

.rubber-opacity-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.rubber-opacity-range {
    flex: 1 1 auto;
    width: 180px;
    accent-color: #206bc4;
}

.rubber-opacity-label {
    font-size: 0.75rem;
    text-align: center;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.1;
}
</style>
