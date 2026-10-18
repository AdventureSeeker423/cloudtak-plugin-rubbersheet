import {
    EDIT_HISTORY_CAP_COARSE,
    EDIT_HISTORY_CAP_DESKTOP,
    MAX_IMAGE_SIDE_COARSE,
    MAX_IMAGE_SIDE_DESKTOP,
} from './constants.ts';

/** True when the primary pointer is a finger (phones, tablets). Safe outside a browser. */
export function isCoarsePointer(): boolean {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(pointer: coarse)').matches;
}

/** Longest side an image is loaded and edited at. Smaller on phones and tablets to save memory. */
export function maxImageSide(): number {
    return isCoarsePointer() ? MAX_IMAGE_SIDE_COARSE : MAX_IMAGE_SIDE_DESKTOP;
}

/** Undo steps the image editor keeps. Fewer on phones and tablets to save memory. */
export function editHistoryCap(): number {
    return isCoarsePointer() ? EDIT_HISTORY_CAP_COARSE : EDIT_HISTORY_CAP_DESKTOP;
}
