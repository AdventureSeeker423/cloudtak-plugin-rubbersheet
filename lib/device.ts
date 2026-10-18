/** True when the primary pointer is a finger (phones, tablets). Safe outside a browser. */
export function isCoarsePointer(): boolean {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(pointer: coarse)').matches;
}
