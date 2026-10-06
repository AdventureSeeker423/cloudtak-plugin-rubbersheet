const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    CRC_TABLE[index] = crc >>> 0;
}

export function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDate(date: Date): { time: number; date: number } {
    const year = Math.max(1980, date.getFullYear());
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

export interface ZipEntry {
    name: string;
    data: Uint8Array;
}

/**
 * ZIP archive using the store method. Imagery is already compressed, so a second
 * deflate pass would not shrink KMZ, GeoTIFF, or GeoPDF entries.
 */
export function zipStore(entries: ZipEntry[], now = new Date()): Uint8Array {
    const encoder = new TextEncoder();
    const stamp = dosDate(now);
    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = encoder.encode(entry.name);
        const checksum = crc32(entry.data);
        const local = new Uint8Array(30 + name.length + entry.data.length);
        const view = new DataView(local.buffer);
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, stamp.time, true);
        view.setUint16(12, stamp.date, true);
        view.setUint32(14, checksum, true);
        view.setUint32(18, entry.data.length, true);
        view.setUint32(22, entry.data.length, true);
        view.setUint16(26, name.length, true);
        view.setUint16(28, 0, true);
        local.set(name, 30);
        local.set(entry.data, 30 + name.length);
        locals.push(local);

        const central = new Uint8Array(46 + name.length);
        const centralView = new DataView(central.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, stamp.time, true);
        centralView.setUint16(14, stamp.date, true);
        centralView.setUint32(16, checksum, true);
        centralView.setUint32(20, entry.data.length, true);
        centralView.setUint32(24, entry.data.length, true);
        centralView.setUint16(28, name.length, true);
        centralView.setUint16(30, 0, true);
        centralView.setUint16(32, 0, true);
        centralView.setUint16(34, 0, true);
        centralView.setUint16(36, 0, true);
        centralView.setUint32(38, 0, true);
        centralView.setUint32(42, offset, true);
        central.set(name, 46);
        centrals.push(central);
        offset += local.length;
    }

    const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    const total = offset + centralSize + end.length;
    const out = new Uint8Array(total);
    let cursor = 0;
    for (const part of locals) {
        out.set(part, cursor);
        cursor += part.length;
    }
    for (const part of centrals) {
        out.set(part, cursor);
        cursor += part.length;
    }
    out.set(end, cursor);
    return out;
}

export function unzipStore(data: Uint8Array): ZipEntry[] {
    const entries: ZipEntry[] = [];
    let offset = 0;
    while (offset + 30 <= data.length) {
        const view = new DataView(data.buffer, data.byteOffset + offset, data.length - offset);
        if (view.getUint32(0, true) !== 0x04034b50) break;
        const method = view.getUint16(8, true);
        const compressed = view.getUint32(18, true);
        const nameLength = view.getUint16(26, true);
        const extraLength = view.getUint16(28, true);
        const nameStart = offset + 30;
        const dataStart = nameStart + nameLength + extraLength;
        const name = new TextDecoder().decode(data.subarray(nameStart, nameStart + nameLength));
        if (method !== 0) throw new Error(`Unsupported zip method ${method} for ${name}`);
        entries.push({
            name,
            data: data.slice(dataStart, dataStart + compressed),
        });
        offset = dataStart + compressed;
    }
    return entries;
}
