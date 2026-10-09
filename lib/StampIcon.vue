<template>
    <canvas
        ref='canvasEl'
        class='stamp-icon'
        :width='pixelSize'
        :height='pixelSize'
        :style='{ width: `${displaySize}px`, height: `${displaySize}px` }'
    />
</template>

<script setup lang='ts'>
import { onMounted, ref, watch } from 'vue';
import { drawStampPreview, type StampKind } from './stamp-icons.ts';

const props = withDefaults(defineProps<{
    kind: StampKind;
    size?: number;
}>(), {
    size: 36,
});

const canvasEl = ref<HTMLCanvasElement | null>(null);
const displaySize = props.size;
const pixelSize = Math.round(props.size * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));

function paint(): void {
    const canvas = canvasEl.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = pixelSize / displaySize;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStampPreview(ctx, props.kind, displaySize);
}

onMounted(paint);
watch(() => props.kind, paint);
</script>

<style scoped>
.stamp-icon {
    display: block;
    flex-shrink: 0;
}
</style>
