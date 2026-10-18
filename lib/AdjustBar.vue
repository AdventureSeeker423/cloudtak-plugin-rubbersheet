<template>
    <div
        class='rubber-adjust user-select-none'
        :class='{
            "rubber-adjust--full": showFull,
            "rubber-adjust--tall": showFull,
            "rubber-adjust--locked": showFull && !sheetUi.adjusting,
        }'
    >
        <template v-if='showFull && sheetUi.adjusting'>
            <div
                class='rubber-adjust-row'
                role='toolbar'
                aria-label='Adjust the sheet'
            >
                <button
                    type='button'
                    class='btn btn-primary rubber-adjust-done'
                    title='Done adjusting. The sheet stays on the map.'
                    @click='onDone'
                >
                    <IconCheck
                        :size='24'
                        stroke='1'
                    /><span class='ms-1'>Done</span>
                </button>
                <TablerIconButton
                    class='rubber-adjust-btn'
                    title='Undo'
                    :disabled='!sheetUi.canUndoTransform'
                    @click='onUndo'
                >
                    <IconArrowBackUp
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    class='rubber-adjust-btn'
                    title='Redo'
                    :disabled='!sheetUi.canRedoTransform'
                    @click='onRedo'
                >
                    <IconArrowForwardUp
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-if='touchCapable'
                    class='rubber-adjust-btn'
                    :class='{ "rubber-adjust-btn--on": sheetUi.moveMode }'
                    :title='sheetUi.moveMode ? "Move mode is on. Tap to stop moving the sheet." : "Move the sheet with one finger"'
                    :aria-pressed='sheetUi.moveMode'
                    @click='sheetUi.moveMode = !sheetUi.moveMode'
                >
                    <IconArrowsMove
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    class='rubber-adjust-btn'
                    title='Remove Sheet'
                    @click='confirmRemove = true'
                >
                    <IconTrash
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-if='appStore.isMobileDetected'
                    class='rubber-adjust-btn'
                    :title='opened ? "Hide settings" : "Show settings"'
                    :aria-expanded='opened'
                    @click='opened = !opened'
                >
                    <IconChevronDown
                        v-if='opened'
                        :size='24'
                        stroke='1'
                    />
                    <IconChevronUp
                        v-else
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
            <p
                v-if='touchCapable && (opened || !appStore.isMobileDetected)'
                class='rubber-adjust-hint text-secondary small mb-0'
                aria-live='polite'
            >
                <template v-if='sheetUi.moveMode'>
                    Move mode: drag the sheet to move it. Two fingers pan and zoom the map.
                </template>
                <template v-else>
                    One finger pans the map. Drag a handle to warp.
                </template>
            </p>
            <div
                v-if='opened || !appStore.isMobileDetected'
                class='rubber-adjust-settings'
            >
                <WarpModeStrip
                    name='rubber-sheet-warp-mode-bar'
                    compact
                />
                <OpacityBar />
            </div>
        </template>
        <div
            v-else-if='showFull'
            class='rubber-adjust-row'
        >
            <button
                type='button'
                class='btn btn-primary rubber-adjust-done flex-shrink-0'
                title='Show the handles and adjust the sheet again'
                @click='sheetUi.adjusting = true'
            >
                <IconAdjustments
                    :size='24'
                    stroke='1'
                /><span class='ms-1'>Adjust</span>
            </button>
            <OpacityBar />
        </div>
        <OpacityBar v-else />
        <RemoveSheetConfirm
            v-if='confirmRemove'
            @close='confirmRemove = false'
            @confirm='onRemove'
        />
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import {
    IconAdjustments,
    IconArrowBackUp,
    IconArrowForwardUp,
    IconArrowsMove,
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconTrash,
} from '@tabler/icons-vue';
// Host store (the plugin is built inside app/plugins/<name>/, like lib/overlay.ts).
import { useAppStore } from '../../../src/stores/app.ts';
import { ROUTE_NAME } from './constants.ts';
import OpacityBar from './OpacityBar.vue';
import RemoveSheetConfirm from './RemoveSheetConfirm.vue';
import { clearSheet, redoSheetTransform, undoSheetTransform } from './sheet.ts';
import { sheetUi } from './ui-state.ts';
import WarpModeStrip from './WarpModeStrip.vue';

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();

const touchCapable = typeof window !== 'undefined' && (
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    || (typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: coarse)').matches)
);

// Same "More" toggle as the host DrawOverlay on phones. Open in portrait so the warp mode is in reach, collapsed in landscape.
// The choice lives in sheetUi so it survives the bar being rebuilt after another plugin's panel closes.
const opened = computed({
    get: () => sheetUi.barMore ?? (typeof window === 'undefined' || window.innerHeight > 576),
    set: (value: boolean) => {
        sheetUi.barMore = value;
    },
});
const confirmRemove = ref(false);

/** A pure mouse desktop keeps the opacity slider only; touch and small screens get the full bar. */
const showFull = computed(() => appStore.isMobileDetected || touchCapable || !sheetUi.adjusting);

function onUndo(): void {
    if (sheetUi.canUndoTransform) undoSheetTransform();
}

function onRedo(): void {
    if (sheetUi.canRedoTransform) redoSheetTransform();
}

function onDone(): void {
    sheetUi.adjusting = false;
    sheetUi.moveMode = false;
    if (route.name === ROUTE_NAME) void router.push('/');
}

function onRemove(): void {
    confirmRemove.value = false;
    void clearSheet();
}
</script>

<style>
/* The host panel (PluginPane.vue) is a fixed 50 px row. Its scoped rule `.plugin-pane[data-v-x]` has specificity
 * 0,2,0, the same as a single `.plugin-pane:has(...)`, so the winner depended on CSS order, and in a production build
 * the host rule won: the 50 px box stayed small and the bar stuck out of it. Repeating the class gives 0,3,0 in any order. */
.plugin-pane.plugin-pane:has(.rubber-adjust) {
    height: auto;
    min-height: 50px;
    max-width: calc(100vw - 16px);
    box-sizing: border-box;
}
/* Alone in the panel, the bar draws the surface itself (same fill, border, radius and shadow as `.cloudtak-panel`)
 * and the host box turns invisible, so the surface always matches the content. */
.plugin-pane.plugin-pane:has(.rubber-adjust):not(:has(> div + div)) {
    padding-block: 0;
    background-color: transparent;
    border-color: transparent;
    box-shadow: none;
}
.plugin-pane:not(:has(> div + div)) .rubber-adjust {
    padding: 6px 8px;
    border: 1px solid var(--cloudtak-surface-border, rgba(128, 128, 128, 0.3));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
/* Next to another plugin's bar the host panel stays the shared surface and grows around both. */
.plugin-pane.plugin-pane:has(> div + div) .rubber-adjust {
    background-color: transparent;
}
</style>
<style scoped>
@media (prefers-reduced-motion: reduce) {
    .rubber-adjust,
    .rubber-adjust :deep(*) {
        transition: none !important;
        animation: none !important;
    }
}
.rubber-adjust {
    box-sizing: border-box;
    /* Own surface, same fill as the host panel, so the content stays readable even if the host box does not fit it. */
    background-color: var(--cloudtak-panel-bg, var(--cloudtak-surface-bg, var(--tblr-bg-surface, #14141a)));
    color: var(--cloudtak-surface-color, var(--tblr-body-color));
    border-radius: 6px;
    width: min(300px, calc(100vw - 48px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
}

.rubber-adjust--full {
    width: min(440px, calc(100vw - 48px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
}

.rubber-adjust--locked {
    width: min(360px, calc(100vw - 48px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
}

.rubber-adjust-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
}

.rubber-adjust--locked .rubber-adjust-row {
    gap: 12px;
    justify-content: flex-start;
}

.rubber-adjust-row > .rubber-opacity {
    flex: 1 1 auto;
    min-width: 0;
}

.rubber-adjust-done {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding-inline: 10px;
}

.rubber-adjust-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
}

.rubber-adjust-btn--on,
.rubber-adjust-btn--on:hover {
    background-color: var(--tblr-primary);
    color: var(--tblr-white, #fff);
}

.rubber-adjust-hint {
    margin-top: 4px;
    line-height: 1.25;
}

.rubber-adjust-settings {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
}

/* Landscape phones: strip and slider share one line, the hint goes away. */
@media (max-height: 500px) {
    .rubber-adjust--full {
        width: min(640px, calc(100vw - 48px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
    }

    .rubber-adjust-hint {
        display: none;
    }

    .rubber-adjust-settings {
        flex-direction: row;
        align-items: center;
        gap: 12px;
    }

    .rubber-adjust-settings > * {
        flex: 1 1 0;
        min-width: 0;
    }
}
</style>
