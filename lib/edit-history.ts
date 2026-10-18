import { EDIT_HISTORY_CAP_DESKTOP } from './constants.ts';

/**
 * Linear undo/redo of deep-copied RGBA snapshots.
 * Call push() with the buffer state *before* each logical edit
 * (wand click, or eraser stroke start).
 */

/** Default number of undo steps (desktop). Phones pass a smaller cap to the constructor. */
export const EDIT_HISTORY_CAP = EDIT_HISTORY_CAP_DESKTOP;

/** Serializable undo/redo stacks for persisting across editor sessions. */
export type EditHistorySnapshot = {
    past: Uint8Array[];
    future: Uint8Array[];
};

export class EditHistory {
    private past: Uint8Array[] = [];
    private future: Uint8Array[] = [];
    private cap: number;

    constructor(cap: number = EDIT_HISTORY_CAP) {
        this.cap = Math.max(1, Math.floor(cap));
    }

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

    /**
     * Stacks for storing outside the editor. Deep-copied unless `copy` is false, which hands
     * over the frames themselves (the caller then owns them and this history should be cleared).
     */
    exportSnapshot(options: { copy?: boolean } = {}): EditHistorySnapshot {
        if (options.copy === false) {
            return { past: this.past.slice(), future: this.future.slice() };
        }
        return {
            past: this.past.map((entry) => entry.slice()),
            future: this.future.map((entry) => entry.slice()),
        };
    }

    /**
     * Restore stacks from a prior export. Frames are deep-copied unless `copy` is false,
     * which takes ownership of the snapshot's frames (only the stack arrays are copied).
     */
    importSnapshot(
        snapshot: EditHistorySnapshot | null | undefined,
        options: { copy?: boolean } = {},
    ): void {
        this.clear();
        if (!snapshot) return;
        const copy = options.copy !== false;
        this.past = copy ? snapshot.past.map((entry) => entry.slice()) : snapshot.past.slice();
        this.future = copy ? snapshot.future.map((entry) => entry.slice()) : snapshot.future.slice();
        while (this.past.length > this.cap) this.past.shift();
    }

    /** Snapshot the current buffer before mutating it. Clears redo. */
    push(rgba: Uint8Array): void {
        this.past.push(rgba.slice());
        if (this.past.length > this.cap) {
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

    /**
     * Drop the newest undo snapshot and restore it into `target`.
     * Unlike undo(), nothing is pushed onto redo: the edit never happened.
     */
    rollback(target: Uint8Array): boolean {
        if (!this.past.length || target.length !== this.past[this.past.length - 1].length) {
            return false;
        }
        target.set(this.past.pop()!);
        return true;
    }
    redo(target: Uint8Array): boolean {
        if (!this.future.length || target.length !== this.future[this.future.length - 1].length) {
            return false;
        }
        const next = this.future.pop()!;
        this.past.push(target.slice());
        if (this.past.length > this.cap) {
            this.past.shift();
        }
        target.set(next);
        return true;
    }

    /** Rewrite every stored frame (e.g. after the canvas grows). */
    mapFrames(map: (frame: Uint8Array) => Uint8Array): void {
        this.past = this.past.map(map);
        this.future = this.future.map(map);
    }
}
