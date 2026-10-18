/*
 * Menu icon with a state dot.
 *
 * Wraps IconRubberSheet (lib/icon.ts, which carries the ATAK-CIV GPL-3.0 notice and is not changed) and adds an
 * 8 px dot while the Adjust bar is minimized for another plugin's panel. The host copies a menu item's fields
 * when it is added, so the item cannot change later. A render function that reads a reactive flag does update.
 *
 * The dot is never the only signal: the wrapper gets a title, and the text "Controls hidden. " is added in front
 * of the label for screen readers (the icon comes before the label in the menu item).
 */
import { defineComponent, h } from 'vue';
import { IconRubberSheet } from './icon.ts';
import { sheetUi } from './ui-state.ts';

const STYLE_ID = 'rubber-sheet-menu-icon-style';
const STYLE = `
.rs-menu-icon { position: relative; display: inline-flex; }
.rs-menu-icon__dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    box-sizing: content-box;
    border-radius: 50%;
    background-color: var(--tblr-primary, #1E90FF);
    /* The host sets --cloudtak-surface-bg for both themes on <html>; --cloudtak-panel-bg only exists inside panels (the rail and menu are one). */
    border: 2px solid var(--cloudtak-panel-bg, var(--cloudtak-surface-bg, #ffffff));
}
@media (forced-colors: active) {
    .rs-menu-icon__dot {
        forced-color-adjust: none;
        background-color: Highlight;
        border-color: Canvas;
    }
}
.rs-menu-icon__text {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
`;

function ensureStyle(): void {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = STYLE;
    document.head.appendChild(el);
}

export const IconRubberSheetState = defineComponent({
    name: 'IconRubberSheetState',
    props: {
        size: { type: [Number, String], default: 32 },
        color: { type: String, default: 'currentColor' },
        stroke: { type: [Number, String], default: undefined },
    },
    setup(props) {
        ensureStyle();
        return () => {
            const hidden = sheetUi.barHidden;
            return h('span', {
                class: 'rs-menu-icon',
                title: hidden ? 'Rubber Sheet, controls hidden' : undefined,
            }, [
                h(IconRubberSheet, props),
                hidden ? h('span', { class: 'rs-menu-icon__dot', 'aria-hidden': 'true' }) : null,
                hidden ? h('span', { class: 'rs-menu-icon__text' }, 'Controls hidden. ') : null,
            ]);
        };
    },
});
