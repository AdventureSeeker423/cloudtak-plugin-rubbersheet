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
    hasSheet: false,
    exportType: '' as ExportType,
    busy: false,
    error: '',
    status: '',
    missions: null as MissionChoice[] | null,
});
