import { reactive } from 'vue';

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
});
