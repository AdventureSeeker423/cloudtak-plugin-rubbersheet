// Host modules (the plugin is built inside app/plugins/<name>/, like lib/overlay.ts).
import Subscription from '../../../src/base/subscription.ts';
import { db } from '../../../src/database.ts';
import { apiFetch, readError } from './api.ts';
import { DATA_SYNC_LIST } from './constants.ts';
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

/**
 * Data syncs the "Add to Data Sync" picker offers. Which list is chosen by DATA_SYNC_LIST:
 * 'subscribed' (default) is what the host Share to Data Sync shows, 'all' is the wider list
 * from listAllWritableMissions().
 */
export async function listMissionsForPicker(): Promise<MissionChoice[]> {
    if (DATA_SYNC_LIST === 'all') return listAllWritableMissions();
    return listSubscribedMissions();
}

/**
 * Same list as the host Share to Data Sync: the locally stored data syncs where the user
 * has a write role (Subscription.localList with role MISSION_SUBSCRIBER). The mission token
 * is looked up so password-protected syncs still accept the upload.
 */
export async function listSubscribedMissions(): Promise<MissionChoice[]> {
    const list = await Subscription.localList({ role: 'MISSION_SUBSCRIBER' });
    const missions: MissionChoice[] = [];
    for (const mission of list) {
        let token: string | undefined;
        try {
            token = (await db.subscription.get(mission.guid))?.token || undefined;
        } catch {
            // A missing token only matters for password-protected syncs; the upload reports that.
        }
        missions.push({ guid: mission.guid, name: mission.name, token });
    }
    return missions.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every data sync the user may be able to attach files to: local subscription rows with a
 * write role (subscribed or not), merged with the server mission catalog so
 * unsubscribed-but-visible syncs still appear. This was the picker list before phase 4.
 */
export async function listAllWritableMissions(): Promise<MissionChoice[]> {
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
    const response = await apiFetch(
        '/api/marti/mission?passwordProtected=true&defaultRole=true&sort=createTime&order=desc',
    );
    if (!response.ok) throw new Error(await readError(response, `Could not list data syncs (${response.status})`));

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
    if (mission.token) headers.MissionAuthorization = mission.token;

    const body = file.bytes.buffer.slice(
        file.bytes.byteOffset,
        file.bytes.byteOffset + file.bytes.byteLength,
    ) as ArrayBuffer;

    const response = await apiFetch(url, {
        method: 'POST',
        headers,
        body,
    });

    if (!response.ok) throw new Error(await readError(response, `Upload failed (${response.status})`));
}
