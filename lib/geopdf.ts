import { deflateZlib } from './deflate.ts';

function concat(parts: Uint8Array[]): Uint8Array {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function ascii(value: string): Uint8Array {
    return new TextEncoder().encode(value);
}

function pdfNumber(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const rounded = Math.round(value * 1e8) / 1e8;
    return String(rounded);
}

function pdfString(value: string): string {
    return `(${value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
}

/**
 * Geospatial PDF of a north-up warped image.
 * The JPEG is the picture; the soft mask keeps pixels outside the quad transparent.
 * LGIDict plus an ISO viewport measure record the WGS84 bounds.
 */
export async function buildGeoPdf(opts: {
    name: string;
    jpeg: Uint8Array;
    alpha: Uint8Array;
    width: number;
    height: number;
    west: number;
    south: number;
    east: number;
    north: number;
}): Promise<Uint8Array> {
    const mask = await deflateZlib(opts.alpha);
    const longSide = Math.max(opts.width, opts.height);
    const pageScale = 720 / longSide;
    const pageW = pdfNumber(opts.width * pageScale);
    const pageH = pdfNumber(opts.height * pageScale);
    const west = pdfNumber(opts.west);
    const south = pdfNumber(opts.south);
    const east = pdfNumber(opts.east);
    const north = pdfNumber(opts.north);

    const objects: Uint8Array[] = [];

    function add(body: string | Uint8Array): void {
        const header = ascii(`${objects.length + 1} 0 obj\n`);
        const content = typeof body === 'string' ? ascii(body) : body;
        const footer = ascii('\nendobj\n');
        objects.push(concat([header, content, footer]));
    }

    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
    add([
        '<< /Type /Page',
        `/MediaBox [0 0 ${pageW} ${pageH}]`,
        '/Resources << /XObject << /Im 5 0 R >> >>',
        '/Contents 4 0 R',
        '/Group << /Type /Group /S /Transparency /CS /DeviceRGB >>',
        '/LGIDict 7 0 R',
        '/VP [8 0 R]',
        '>>',
    ].join('\n'));

    const content = ascii(`q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im Do\nQ\n`);
    add(concat([
        ascii(`<< /Length ${content.length} >>\nstream\n`),
        content,
        ascii('endstream'),
    ]));

    add(concat([
        ascii([
            '<< /Type /XObject /Subtype /Image',
            `/Width ${opts.width} /Height ${opts.height}`,
            '/ColorSpace /DeviceRGB /BitsPerComponent 8',
            '/Filter /DCTDecode',
            `/Length ${opts.jpeg.length}`,
            '/SMask 6 0 R >>',
            'stream\n',
        ].join('\n')),
        opts.jpeg,
        ascii('\nendstream'),
    ]));

    add(concat([
        ascii([
            '<< /Type /XObject /Subtype /Image',
            `/Width ${opts.width} /Height ${opts.height}`,
            '/ColorSpace /DeviceGray /BitsPerComponent 8',
            '/Filter /FlateDecode',
            `/Length ${mask.length} >>`,
            'stream\n',
        ].join('\n')),
        mask,
        ascii('\nendstream'),
    ]));

    add([
        '<< /Type /LGIDict',
        '/Version (2.1)',
        '/Projection <<',
        '  /Type /Projection',
        '  /ProjectionType /GEOGRAPHIC',
        '  /Datum (WE)',
        '>>',
        `/Neatline [${west} ${south} ${east} ${south} ${east} ${north} ${west} ${north}]`,
        '>>',
    ].join('\n'));

    add([
        '<< /Type /Viewport',
        `/BBox [0 0 ${pageW} ${pageH}]`,
        '/Measure <<',
        '  /Type /Measure',
        '  /Subtype /GEO',
        '  /Bounds [0 0 0 1 1 1 1 0]',
        `  /GPTS [${south} ${west} ${south} ${east} ${north} ${east} ${north} ${west}]`,
        '  /LPTS [0 0 1 0 1 1 0 1]',
        '  /GCS << /Type /GEOGCS /EPSG 4326 >>',
        '>>',
        '>>',
    ].join('\n'));

    add(`<< /Title ${pdfString(opts.name)} /Producer (CloudTAK Rubber Sheet) >>`);

    const chunks: Uint8Array[] = [ascii('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')];
    let position = chunks[0].length;
    const offsets = [0];
    for (const object of objects) {
        offsets.push(position);
        chunks.push(object);
        position += object.length;
    }

    const xrefStart = position;
    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += '0000000000 65535 f \n';
    for (let index = 1; index < offsets.length; index++) {
        xref += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n`;
    xref += `startxref\n${xrefStart}\n%%EOF\n`;
    chunks.push(ascii(xref));
    return concat(chunks);
}
