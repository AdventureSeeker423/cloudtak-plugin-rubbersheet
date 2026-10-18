/**
 * Turns an error response body into the message shown to the user: the JSON `message` when
 * there is one, otherwise the plain text, otherwise `fallback`.
 */
export function errorMessage(body: string, fallback: string): string {
    const text = body.trim();
    if (!text) return fallback;
    try {
        const json = JSON.parse(text) as { message?: unknown } | null;
        if (json && typeof json.message === 'string' && json.message) return json.message;
    } catch {
        // not JSON
    }
    return text;
}
