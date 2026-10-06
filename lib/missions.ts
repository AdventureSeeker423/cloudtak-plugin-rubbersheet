import type { MissionChoice } from './ui-state.ts';

function roleType(role: unknown): string {
    if (typeof role === 'string') return role;
    if (role && typeof role === 'object' && 'type' in role) {
        return String((role as { type: unknown }).type);
    }
    return '';
}

/**
 * Subscribed data syncs the user can write to, from CloudTAK's local database.
 * Opening the database without a version does not create it. If CloudTAK has not
 * created it yet, this returns an empty list instead of inventing a new database.
 */
export async function listWritableMissions(): Promise<MissionChoice[]> {
    const factory = indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name?: string }>>;
    };
    if (typeof factory.databases === 'function') {
        const existing = await factory.databases();
        if (!existing.some((db) => db.name === 'CloudTAK')) return [];
    }
    return readMissionDatabase();
}

function readMissionDatabase(): Promise<MissionChoice[]> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CloudTAK');
        request.onupgradeneeded = () => {
            request.transaction?.abort();
        };
        request.onerror = () => {
            const error = request.error;
            if (error && error.name === 'AbortError') {
                resolve([]);
                return;
            }
            reject(error ?? new Error('Could not read data syncs'));
        };
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('subscription')) {
                db.close();
                resolve([]);
                return;
            }
            const tx = db.transaction('subscription', 'readonly');
            const store = tx.objectStore('subscription');
            const all = store.getAll();
            all.onerror = () => {
                db.close();
                reject(all.error ?? new Error('Could not read data syncs'));
            };
            all.onsuccess = () => {
                const rows = Array.isArray(all.result) ? all.result : [];
                const missions: MissionChoice[] = [];
                for (const row of rows) {
                    if (!row || typeof row !== 'object') continue;
                    const record = row as {
                        guid?: unknown;
                        name?: unknown;
                        subscribed?: unknown;
                        token?: unknown;
                        role?: unknown;
                    };
                    if (record.subscribed !== true) continue;
                    const role = roleType(record.role);
                    if (role !== 'MISSION_OWNER' && role !== 'MISSION_SUBSCRIBER') continue;
                    if (typeof record.guid !== 'string' || typeof record.name !== 'string') continue;
                    const token = typeof record.token === 'string' && record.token ? record.token : undefined;
                    missions.push({ guid: record.guid, name: record.name, token });
                }
                missions.sort((a, b) => a.name.localeCompare(b.name));
                db.close();
                resolve(missions);
            };
        };
    });
}

export async function uploadMissionFile(mission: MissionChoice, file: {
    filename: string;
    bytes: Uint8Array;
    mime: string;
}): Promise<void> {
    const url = `/api/marti/missions/${encodeURIComponent(mission.guid)}/upload?name=${encodeURIComponent(file.filename)}`;
    const headers: Record<string, string> = {
        'Content-Type': file.mime,
    };
    if (mission.token) headers.MissionAuthorization = mission.token;

    const body = file.bytes.buffer.slice(
        file.bytes.byteOffset,
        file.bytes.byteOffset + file.bytes.byteLength,
    ) as ArrayBuffer;

    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body,
    });

    if (!response.ok) {
        const text = (await response.text()).trim();
        throw new Error(text || `Upload failed (${response.status})`);
    }
}
