import { reactive } from 'vue';
import { OPACITY_KEY } from './constants.ts';

function storedOpacity(): number {
    try {
        const raw = localStorage.getItem(OPACITY_KEY);
        if (raw === null) return 100;
        const value = Number(raw);
        if (!Number.isFinite(value)) return 100;
        return Math.min(100, Math.max(0, Math.round(value)));
    } catch {
        return 100;
    }
}

export const opacityState = reactive({
    value: storedOpacity(),
});

let onChange: ((value: number) => void) | null = null;

export function watchOpacity(fn: (value: number) => void): void {
    onChange = fn;
}

export function setOpacity(value: number): void {
    const next = Math.min(100, Math.max(0, Math.round(value)));
    opacityState.value = next;
    try {
        localStorage.setItem(OPACITY_KEY, String(next));
    } catch {
        // Private browsing can reject storage; the slider still works for this session.
    }
    onChange?.(next);
}
