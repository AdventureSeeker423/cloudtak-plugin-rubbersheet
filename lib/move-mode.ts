/** Inputs that decide whether a touch on the map starts moving the sheet. */
export interface TouchMoveInput {
    /** The on-screen Move toggle. */
    moveMode: boolean;
    /** False after Done on the Adjust bar: the sheet is locked in place. */
    adjusting: boolean;
    /** Number of fingers down on the map when the touch started. */
    touches: number;
    /** The first finger is on an opaque pixel of the sheet. */
    hit: boolean;
}

/**
 * A one-finger drag moves the sheet only in Move mode. Otherwise the touch is left
 * to MapLibre, so one finger pans the map even over a large sheet and two fingers
 * pinch and rotate it.
 */
export function shouldStartTouchMove(input: TouchMoveInput): boolean {
    return input.moveMode && input.adjusting && input.touches === 1 && input.hit;
}

/**
 * Browsers fire compatibility mouse events after a touch. Those must not start a
 * mouse-style sheet move when the touch itself was left to the map.
 */
export function ignoreCompatMouse(now: number, lastTouchAt: number, windowMs = 700): boolean {
    return now - lastTouchAt < windowMs;
}
