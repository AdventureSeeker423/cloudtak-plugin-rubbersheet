<template>
    <ImageEditor
        v-if='editSession'
        ref='editor'
        :source='editSession.source'
        :pristine='editSession.pristine'
        :history='editSession.history'
        @apply='onApply'
        @cancel='leave'
    />
</template>

<script setup lang='ts'>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { ROUTE_NAME } from './constants.ts';
import { editSession, endEditSession } from './edit-session.ts';
import type { EditHistorySnapshot } from './edit-history.ts';
import ImageEditor from './ImageEditor.vue';
import { applyEditedCanvas } from './sheet.ts';
import { sheetUi } from './ui-state.ts';

const router = useRouter();
const editor = ref<InstanceType<typeof ImageEditor> | null>(null);

/** Set once the user has chosen to leave, so the route guard lets the navigation through. */
let allowLeave = false;

onMounted(() => {
    // Reloading or opening the address directly leaves no session behind: go back to the pane.
    if (!editSession.value) void router.replace({ name: ROUTE_NAME });
});

onBeforeUnmount(() => {
    endEditSession();
});

/** Same test as the host back button in App.vue: use history when there is some, else go to the pane. */
function leave(): void {
    allowLeave = true;
    if (router.options.history.state.back) router.back();
    else void router.replace({ name: ROUTE_NAME });
}

function onApply(canvas: HTMLCanvasElement, history: EditHistorySnapshot): void {
    try {
        applyEditedCanvas(canvas, history);
        sheetUi.success = 'Image edits applied';
    } catch (err) {
        sheetUi.error = err instanceof Error ? err.message : String(err);
    }
    leave();
}

// Browser Back, the Android hardware Back (the host calls router.back()) and any other
// navigation away ask first when there are unsaved edits.
onBeforeRouteLeave((to) => {
    if (allowLeave) return true;
    const current = editor.value;
    if (!current || !current.dirty) return true;
    current.requestDiscard(() => {
        allowLeave = true;
        // A Back navigation goes one step back in history; anything else is a new navigation.
        if (String(router.options.history.state.back) === to.fullPath) router.back();
        else void router.push(to.fullPath);
    });
    return false;
});
</script>
