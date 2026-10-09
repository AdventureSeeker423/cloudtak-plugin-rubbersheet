import type { MissionChoice } from './ui-state.ts';

function roleType(role: unknown): string {
    if (typeof role === 'string') return role;
    if (role && typeof role === 'object' && 'type' in role) {
        return String((role as { type: unknown }).type);
    }
    return '';
}

function canWriteRole(role: unknown): boolean {
    const type = roleType(role);
    // Same filter as CloudTAK ShareToMission (role: 'MISSION_SUBSCRIBER').
    return type === 'MISSION_OWNER' || type === 'MISSION_SUBSCRIBER';
}

async function getAuthToken(): Promise<string | undefined> {
    try {
        const caps = localStorage.getItem('CapacitorStorage.token');
        if (caps) return caps;
        const plain = localStorage.getItem('token');
        if (plain) return plain;
    } catch {
        // Private browsing can reject storage.
    }
    return undefined;
}

/**
 * Data syncs the user can attach files to — matching Files → Share to Data Sync:
 * local subscription rows with a write role (subscribed or not), merged with the
 * server mission catalog so unsubscribed-but-visible syncs still appear.
 */
export async function listWritableMissions(): Promise<MissionChoice[]> {
    const byGuid = new Map<string, MissionChoice>();

    for (const mission of await listLocalMissions()) {
        byGuid.set(mission.guid, mission);
    }

    try {
        for (const mission of await listServerMissions()) {
            const existing = byGuid.get(mission.guid);
            byGuid.set(mission.guid, {
                guid: mission.guid,
                name: mission.name,
                token: existing?.token ?? mission.token,
            });
        }
    } catch {
        // Offline / API failure — local list alone is still useful.
    }

    return [...byGuid.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function listLocalMissions(): Promise<MissionChoice[]> {
    const factory = indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name?: string }>>;
    };

    const read = (): Promise<MissionChoice[]> => new Promise((resolve, reject) => {
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
                        token?: unknown;
                        role?: unknown;
                    };
                    // Native ShareToMission does not require subscribed === true.
                    if (!canWriteRole(record.role)) continue;
                    if (typeof record.guid !== 'string' || typeof record.name !== 'string') continue;
                    const token = typeof record.token === 'string' && record.token ? record.token : undefined;
                    missions.push({ guid: record.guid, name: record.name, token });
                }
                db.close();
                resolve(missions);
            };
        };
    });

    if (typeof factory.databases !== 'function') return read();
    return factory.databases().then((existing) => {
        if (!existing.some((db) => db.name === 'CloudTAK')) return [];
        return read();
    }).catch(() => []);
}

async function listServerMissions(): Promise<MissionChoice[]> {
    const token = await getAuthToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(
        '/api/marti/mission?passwordProtected=true&defaultRole=true&sort=createTime&order=desc',
        {
            credentials: 'same-origin',
            headers,
        },
    );
    if (!response.ok) {
        const text = (await response.text()).trim();
        throw new Error(text || `Could not list data syncs (${response.status})`);
    }

    const body = await response.json() as {
        items?: Array<{
            guid?: unknown;
            name?: unknown;
            defaultRole?: unknown;
        }>;
    };

    const missions: MissionChoice[] = [];
    for (const item of body.items ?? []) {
        if (typeof item.guid !== 'string' || typeof item.name !== 'string') continue;
        // Server catalog is the same set Menu → Data Sync shows; upload enforces write access.
        missions.push({ guid: item.guid, name: item.name });
    }
    return missions;
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
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
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
        let message = text || `Upload failed (${response.status})`;
        try {
            const json = JSON.parse(text) as { message?: string };
            if (json.message) message = json.message;
        } catch {
            // not JSON
        }
        throw new Error(message);
    }
}
