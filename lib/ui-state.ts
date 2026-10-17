import { reactive } from 'vue';
import type { WarpMode } from './warp-mode.ts';

export type ExportType = '' | 'kmz' | 'geotiff' | 'geopdf' | 'zip';

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
    exportType: '' as ExportType,
    busy: false,
    error: '',
    status: '',
    missions: null as MissionChoice[] | null,
    /** Map transform undo/redo (corners, move, rotate). */
    canUndoTransform: false,
    canRedoTransform: false,
    /** Corner drag behaviour when Shift / Alt are not held. */
    warpMode: 'free' as WarpMode,
    /** One-finger touch drags move the sheet (otherwise they pan the map). Never read for mouse input. */
    moveMode: false,
    /** False after Done on the Adjust bar: handles are hidden and the sheet cannot be dragged. */
    adjusting: true,
});
