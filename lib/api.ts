/**
 * Thin wrapper over the host `std.ts` for the plugin's own API requests (Data Sync upload,
 * Imports, overlay tiles).
 *
 * `stdurl` and `getRuntimeToken` are the part of `std()` that matters in the Capacitor apps:
 * the API lives on the saved server URL (not the app's own origin) and the login token is in
 * Capacitor Preferences. On the web both resolve to the same values as before (same origin,
 * localStorage `CapacitorStorage.token`).
 *
 * `std()` itself is deliberately not used here. It imposes a 20 s timeout (a multi-MB upload or
 * a tile poll can run longer), turns non-JSON error bodies into `Status Code: N: <parse error>`
 * and throws `Error('401')`. Those would change the error text shown in the pane and the
 * `MissionAuthorization` flow, so requests go through `fetch` and `readError` keeps the
 * existing message mapping.
 */
import { getRuntimeToken, stdurl } from '../../../src/std.ts';
import { errorMessage } from './api-error.ts';

/** Absolute URL for an API path, on the saved server URL in the native apps. */
export function apiUrl(path: string): string {
    return stdurl(path).toString();
}

/** Login token: the host's runtime token, then the stores a plain web session may still use. */
export async function apiToken(): Promise<string | undefined> {
    try {
        const token = await getRuntimeToken();
        if (token) return token;
    } catch {
        // Fall through to the storage lookups below.
    }

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

/**
 * fetch against the API with the login token as a Bearer header (unless the caller set an
 * Authorization header). With `requireToken` a missing token is an error instead of an
 * unauthenticated request.
 */
export async function apiFetch(
    path: string,
    init: RequestInit = {},
    opts: { requireToken?: boolean } = {},
): Promise<Response> {
    const token = await apiToken();
    if (!token && opts.requireToken) throw new Error('Not signed in — CloudTAK auth token is missing');

    const headers = new Headers(init.headers);
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(apiUrl(path), {
        ...init,
        credentials: 'same-origin',
        headers,
    });
}

/** Message for a failed response: the body text, or its JSON `message`, or `fallback`. */
export async function readError(response: Response, fallback = `Request failed (${response.status})`): Promise<string> {
    return errorMessage(await response.text(), fallback);
}
