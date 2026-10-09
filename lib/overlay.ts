/**
 * Upload a GeoTIFF through CloudTAK Imports and register it as a profile overlay,
 * matching the Files menu "Add to Map as Overlay" flow:
 * PUT /api/import → wait for Success → POST /api/profile/overlay
 * @see https://docs.cloudtak.io/user/ (Uploaded Files)
 */

const POLL_MS = 2000;
const MAX_WAIT_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function readError(response: Response): Promise<string> {
    const text = (await response.text()).trim();
    if (!text) return `Request failed (${response.status})`;
    try {
        const json = JSON.parse(text) as { message?: string };
        if (json.message) return json.message;
    } catch {
        // not JSON
    }
    return text;
}

/**
 * CloudTAK auth is a Bearer token from Capacitor Preferences.
 * On web that is stored as localStorage `CapacitorStorage.token` (not a cookie).
 */
async function getAuthToken(): Promise<string | undefined> {
    try {
        const caps = localStorage.getItem('CapacitorStorage.token');
        if (caps) return caps;
        const plain = localStorage.getItem('token');
        if (plain) return plain;
    } catch {
        // Private browsing can reject storage.
    }

    return readTokenFromCloudTakDb();
}

function readTokenFromCloudTakDb(): Promise<string | undefined> {
    return new Promise((resolve) => {
        const factory = indexedDB as IDBFactory & {
            databases?: () => Promise<Array<{ name?: string }>>;
        };
        const open = () => {
            const request = indexedDB.open('CloudTAK');
            request.onupgradeneeded = () => {
                request.transaction?.abort();
            };
            request.onerror = () => resolve(undefined);
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('config')) {
                    db.close();
                    resolve(undefined);
                    return;
                }
                const tx = db.transaction('config', 'readonly');
                const get = tx.objectStore('config').get('token');
                get.onerror = () => {
                    db.close();
                    resolve(undefined);
                };
                get.onsuccess = () => {
                    db.close();
                    const row = get.result as { value?: unknown } | undefined;
                    resolve(typeof row?.value === 'string' && row.value ? row.value : undefined);
                };
            };
        };

        if (typeof factory.databases !== 'function') {
            open();
            return;
        }
        void factory.databases().then((existing) => {
            if (!existing.some((db) => db.name === 'CloudTAK')) {
                resolve(undefined);
                return;
            }
            open();
        }).catch(() => resolve(undefined));
    });
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not signed in — CloudTAK auth token is missing');

    const headers = new Headers(init.headers);
    if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
        ...init,
        credentials: 'same-origin',
        headers,
    });
}

async function putImport(file: {
    filename: string;
    bytes: Uint8Array;
    mime: string;
}): Promise<string> {
    const form = new FormData();
    const blob = new Blob([file.bytes.slice()], { type: file.mime });
    form.append('file', blob, file.filename);

    const response = await apiFetch('/api/import', {
        method: 'PUT',
        body: form,
    });
    if (!response.ok) throw new Error(await readError(response));

    const body = await response.json() as {
        imports?: Array<{ uid?: string }>;
    };
    const uid = body.imports?.[0]?.uid;
    if (!uid) throw new Error('Import did not return an id');
    return uid;
}

async function waitForImport(uid: string): Promise<string> {
    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
        const response = await apiFetch(`/api/import/${encodeURIComponent(uid)}`);
        if (!response.ok) throw new Error(await readError(response));

        const body = await response.json() as {
            status?: string;
            error?: string | null;
            results?: Array<{ type?: string; type_id?: string }>;
        };

        if (body.status === 'Fail') {
            throw new Error(body.error?.trim() || 'Import failed');
        }
        if (body.status === 'Success') {
            const asset = (body.results ?? []).find((row) => row.type === 'Asset' && typeof row.type_id === 'string');
            if (!asset?.type_id) throw new Error('Import finished but no file asset was created');
            return asset.type_id;
        }

        await sleep(POLL_MS);
    }
    throw new Error('Timed out waiting for the import to finish');
}

async function waitForPmtiles(assetId: string): Promise<void> {
    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
        const response = await apiFetch(`/api/profile/asset/${encodeURIComponent(assetId)}`);
        if (!response.ok) throw new Error(await readError(response));

        const body = await response.json() as {
            artifacts?: Array<{ ext?: string }>;
        };
        if ((body.artifacts ?? []).some((row) => row.ext === '.pmtiles')) return;
        await sleep(POLL_MS);
    }
    throw new Error('Timed out waiting for Cloud Optimized tiles');
}

async function overlayType(assetId: string): Promise<'raster' | 'vector'> {
    const response = await apiFetch(`/api/profile/asset/${encodeURIComponent(assetId)}.pmtiles/tile`);
    if (!response.ok) throw new Error(await readError(response));
    const body = await response.json() as { tiles?: string[] };
    const tile = body.tiles?.[0];
    if (!tile) throw new Error('Malformed PMTiles metadata response');
    try {
        return new URL(tile, window.location.origin).pathname.endsWith('.mvt') ? 'vector' : 'raster';
    } catch {
        return tile.includes('.mvt') ? 'vector' : 'raster';
    }
}

async function createProfileOverlay(opts: {
    assetId: string;
    name: string;
    type: 'raster' | 'vector';
}): Promise<void> {
    const url = `/api/profile/asset/${encodeURIComponent(opts.assetId)}.pmtiles/tile`;
    const response = await apiFetch('/api/profile/overlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            name: opts.name,
            mode: 'profile',
            mode_id: opts.name,
            type: opts.type,
            visible: true,
            opacity: 1,
        }),
    });
    if (!response.ok) throw new Error(await readError(response));
}

/**
 * Import a GeoTIFF into CloudTAK and add it as a map overlay (Files menu flow).
 */
export async function importAsOverlay(
    file: { filename: string; bytes: Uint8Array; mime: string },
    name: string,
    onStatus?: (text: string) => void,
): Promise<void> {
    onStatus?.('Uploading for import…');
    const uid = await putImport(file);

    onStatus?.('Converting to map tiles…');
    const assetId = await waitForImport(uid);

    onStatus?.('Waiting for Cloud Optimized tiles…');
    await waitForPmtiles(assetId);

    onStatus?.('Adding overlay…');
    const type = await overlayType(assetId);
    await createProfileOverlay({
        assetId,
        name: name.trim() || file.filename.replace(/\.[^.]+$/, '') || 'rubber-sheet',
        type,
    });
}
