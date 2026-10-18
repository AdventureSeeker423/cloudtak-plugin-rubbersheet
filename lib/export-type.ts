export type ExportType = '' | 'kmz' | 'geotiff' | 'geopdf' | 'zip';

export const DEFAULT_EXPORT_TYPE: ExportType = 'kmz';

/** The formats the pane offers (the empty type exists only as "nothing chosen"). */
export function parseExportType(value: unknown): ExportType | null {
    if (value === 'kmz' || value === 'geotiff' || value === 'geopdf' || value === 'zip') return value;
    return null;
}

interface ReadableStorage {
    getItem(key: string): string | null;
}

interface WritableStorage {
    setItem(key: string, value: string): void;
}

/** Last chosen format, or KMZ when nothing valid is stored or storage is unavailable. */
export function loadExportType(storage: ReadableStorage | undefined, key: string): ExportType {
    try {
        return parseExportType(storage?.getItem(key)) ?? DEFAULT_EXPORT_TYPE;
    } catch {
        return DEFAULT_EXPORT_TYPE;
    }
}

export function saveExportType(storage: WritableStorage | undefined, key: string, value: ExportType): void {
    try {
        if (value) storage?.setItem(key, value);
    } catch {
        // Private browsing can reject storage.
    }
}
