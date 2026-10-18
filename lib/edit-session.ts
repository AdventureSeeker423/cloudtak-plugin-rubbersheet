import { shallowRef } from 'vue';
import { getEditSession, type EditSession } from './sheet.ts';

/**
 * The image editor's working data while its route is open. Module-level so the
 * pane can fill it before navigating and the route component can read it.
 * It never outlives the route: a page reload lands on the pane without a session.
 */
export const editSession = shallowRef<EditSession | null>(null);

/** Copy the current sheet into a new edit session. Returns false when there is no sheet. */
export function beginEditSession(): boolean {
    endEditSession();
    const session = getEditSession();
    if (!session) return false;
    editSession.value = session;
    return true;
}

/** Drop the session and release its canvas (phones have little memory). */
export function endEditSession(): void {
    const session = editSession.value;
    editSession.value = null;
    if (!session) return;
    session.source.width = 0;
    session.source.height = 0;
}

/**
 * Set when the pane opens the editor. The pane is rebuilt when the editor route closes, so the
 * new pane uses this to put keyboard focus back on its Edit Image button.
 */
export const returnFocus = { edit: false };
