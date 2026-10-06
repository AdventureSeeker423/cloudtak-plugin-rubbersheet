export async function deflateZlib(data: Uint8Array): Promise<Uint8Array> {
    if (typeof CompressionStream === 'undefined') {
        throw new Error('This browser cannot compress the export');
    }
    const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
