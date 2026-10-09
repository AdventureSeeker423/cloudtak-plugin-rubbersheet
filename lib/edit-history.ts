/**
 * Linear undo/redo of deep-copied RGBA snapshots.
 * Call push() with the buffer state *before* each logical edit
 * (wand click, or eraser stroke start).
 */

export const EDIT_HISTORY_CAP = 40;

export class EditHistory {
    private past: Uint8Array[] = [];
    private future: Uint8Array[] = [];

    get canUndo(): boolean {
        return this.past.length > 0;
    }

    get canRedo(): boolean {
        return this.future.length > 0;
    }

    get undoCount(): number {
        return this.past.length;
    }

    get redoCount(): number {
        return this.future.length;
    }

    clear(): void {
        this.past = [];
        this.future = [];
    }

    /** Snapshot the current buffer before mutating it. Clears redo. */
    push(rgba: Uint8Array): void {
        this.past.push(rgba.slice());
        if (this.past.length > EDIT_HISTORY_CAP) {
            this.past.shift();
        }
        this.future = [];
    }

    /**
     * Restore previous snapshot into `target` (same length).
     * Current target is pushed onto redo.
     */
    undo(target: Uint8Array): boolean {
        if (!this.past.length || target.length !== this.past[this.past.length - 1].length) {
            return false;
        }
        const prev = this.past.pop()!;
        this.future.push(target.slice());
        target.set(prev);
        return true;
    }

    redo(target: Uint8Array): boolean {
        if (!this.future.length || target.length !== this.future[this.future.length - 1].length) {
            return false;
        }
        const next = this.future.pop()!;
        this.past.push(target.slice());
        if (this.past.length > EDIT_HISTORY_CAP) {
            this.past.shift();
        }
        target.set(next);
        return true;
    }
}
