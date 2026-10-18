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
/* No surface of its own: it sits on the host panel, so both themes come from the host. */
.rubber-opacity {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    width: 100%;
    padding: 0;
    background: transparent;
    color: inherit;
    user-select: none;
}

.rubber-opacity-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.rubber-opacity-range {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 24px;
    accent-color: var(--tblr-primary);
}

.rubber-opacity-label {
    font-size: 0.75rem;
    text-align: center;
    color: var(--tblr-secondary-color, var(--tblr-secondary));
    line-height: 1.1;
}

@media (pointer: coarse) {
    .rubber-opacity-range {
        min-height: 44px;
    }
}
</style>
