import { reactive } from 'vue';
import { FORMAT_KEY } from './constants.ts';
import { loadExportType } from './export-type.ts';
import type { ExportType } from './export-type.ts';
import type { WarpMode } from './warp-mode.ts';

export type { ExportType };

export interface MissionChoice {
    guid: string;
    name: string;
    token?: string;
}

export const sheetUi = reactive({
    name: '',
    page: 1,
    pageCount: 1,
    /** Non-null while choosing a PDF page; entries are thumbnail data URLs or null while loading. */
    pageThumbs: null as (string | null)[] | null,
    hasSheet: false,
    /** Last chosen format (KMZ the first time). */
    exportType: loadExportType(typeof localStorage === 'undefined' ? undefined : localStorage, FORMAT_KEY) as ExportType,
    busy: false,
    error: '',
    /** Shown inline once an action has finished; cleared when the next action starts. */
    success: '',
    /** What the busy indicator says while something is running. */
    status: '',
    /** The "Add to Data Sync" picker is open. */
    pickerOpen: false,
    /** Map transform undo/redo (corners, move, rotate). */
    canUndoTransform: false,
    canRedoTransform: false,
    /** Corner drag behaviour when Shift / Alt are not held. */
    warpMode: 'free' as WarpMode,
    /** One-finger touch drags move the sheet (otherwise they pan the map). Never read for mouse input. */
    moveMode: false,
    /** False after Done on the Adjust bar: handles are hidden and the sheet cannot be dragged. */
    adjusting: true,
    /** The Adjust bar is minimized while another plugin's panel is open. Shows the dot on the menu entry. */
    barHidden: false,
    /** "Show settings" choice on the Adjust bar, kept across remounts; null keeps the default for the screen size. */
    barMore: null as boolean | null,
    /** Which pane sections the user opened or closed; null keeps the default for the screen size. */
    sections: {
        adjust: null as boolean | null,
        image: null as boolean | null,
        export: null as boolean | null,
        help: null as boolean | null,
    },
});
