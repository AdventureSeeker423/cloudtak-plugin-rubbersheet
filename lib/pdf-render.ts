import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { MAX_IMAGE_SIDE } from './constants.ts';

let workerReady = false;

function configureWorker(): void {
    if (workerReady) return;
    GlobalWorkerOptions.workerSrc = workerUrl;
    workerReady = true;
}

interface PdfPage {
    getViewport(params: { scale: number }): { width: number; height: number };
    render(params: {
        canvasContext: CanvasRenderingContext2D;
        viewport: { width: number; height: number };
    }): { promise: Promise<void> };
}

interface PdfDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPage>;
    destroy(): Promise<void>;
}

let openDocument: PdfDocument | null = null;

export async function closePdf(): Promise<void> {
    if (!openDocument) return;
    const doc = openDocument;
    openDocument = null;
    await doc.destroy();
}

export async function openPdf(data: ArrayBuffer): Promise<number> {
    configureWorker();
    await closePdf();
    const copy = data.slice(0);
    openDocument = await getDocument({
        data: copy,
        disableRange: true,
        disableStream: true,
    }).promise;
    return openDocument.numPages;
}

export async function renderPdfPage(pageNumber: number): Promise<HTMLCanvasElement> {
    if (!openDocument) throw new Error('No PDF is open');
    const page = await openDocument.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, MAX_IMAGE_SIDE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not draw the PDF page');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
}
