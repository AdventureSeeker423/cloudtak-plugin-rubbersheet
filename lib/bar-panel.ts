import type { Component } from 'vue';
import { createPanelCoordinator } from './panel-coordinator.ts';

export interface BarPanelHost {
    add: (item: { key: string; component: Component }) => void;
    remove: (key: string) => void;
}

/** The parts of the sheet UI state the bar panel reads and writes. */
export interface BarPanelUi {
    hasSheet: boolean;
    moveMode: boolean;
    /** True while the Adjust bar is minimized for another plugin's panel. Drives the dot on the menu entry. */
    barHidden: boolean;
}

export interface BarPanelOptions {
    /** Plugin id in the panel contract. */
    id: string;
    /** bottomBar key. */
    key: string;
    component: Component;
    bottomBar: BarPanelHost;
    ui: BarPanelUi;
    /** Ends a handle or sheet drag in progress. */
    cancelDrag: () => void;
    target?: EventTarget;
}

export interface BarPanel {
    readonly shown: boolean;
    readonly minimized: boolean;
    /** Adds the bar unless it is shown or minimized. Never announces. Use for silent re-adds (style reload). */
    ensureBar: () => void;
    /** ensureBar() for a user action: announces panel-open when the bar was actually added. */
    showBar: () => void;
    /** Removes the bar without announcing. */
    hideBar: () => void;
    /** The sheet is gone or the plugin shuts down: announce panel-close if the bar is shown or minimized, then remove it. */
    clear: () => void;
    restoreFromSelector: () => void;
    dispose: () => void;
}

/**
 * Owns the Adjust bar's place in the bottom bar. Minimizing only removes the bar: the sheet, handles, histories,
 * opacity and the Done / Adjust state belong to sheet.ts and are never touched here.
 */
export function createBarPanel(o: BarPanelOptions): BarPanel {
    let barOn = false;

    function addBar(): void {
        o.bottomBar.add({ key: o.key, component: o.component });
        barOn = true;
    }

    function removeBar(): void {
        if (!barOn) return;
        try {
            o.bottomBar.remove(o.key);
        } catch {
            // The bar may already be gone if the plugin is shutting down.
        }
        barOn = false;
    }

    const coordinator = createPanelCoordinator({
        id: o.id,
        target: o.target,
        isShown: () => barOn,
        hasState: () => o.ui.hasSheet,
        close: removeBar,
        minimize: () => {
            removeBar();
            // The Move toggle lives in the hidden bar, so a one-finger drag would otherwise stay stuck on moving the sheet.
            o.ui.moveMode = false;
            o.cancelDrag();
        },
        restore: addBar,
        onMinimizedChange: (minimized) => {
            o.ui.barHidden = minimized;
        },
    });

    function ensureBar(): void {
        if (barOn || coordinator.minimized) return;
        addBar();
    }

    return {
        get shown() { return barOn; },
        get minimized() { return coordinator.minimized; },
        ensureBar,
        showBar() {
            const was = barOn;
            ensureBar();
            if (!was && barOn) coordinator.opened();
        },
        hideBar: removeBar,
        clear() {
            if (barOn || coordinator.minimized) coordinator.closed();
            removeBar();
        },
        restoreFromSelector: () => coordinator.restoreFromSelector(),
        dispose: () => coordinator.dispose(),
    };
}
