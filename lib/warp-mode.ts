/** How dragging a map corner behaves when no modifier key is held. */
export type WarpMode = 'free' | 'scale-corner' | 'scale-center';

/** What a corner drag does: move the corner, or scale about the opposite corner / the center. */
export type CornerDragMode = 'center' | 'opposite' | 'corner';

/**
 * Resolve the corner drag mode. Alt (scale from center) and Shift (scale about
 * the opposite corner) override the on-screen warp mode for that gesture, so
 * keyboard users keep their shortcuts; otherwise the warp mode decides.
 */
export function resolveCornerDragMode(warpMode: WarpMode, altKey: boolean, shiftKey: boolean): CornerDragMode {
    if (altKey) return 'center';
    if (shiftKey) return 'opposite';
    if (warpMode === 'scale-center') return 'center';
    if (warpMode === 'scale-corner') return 'opposite';
    return 'corner';
}
