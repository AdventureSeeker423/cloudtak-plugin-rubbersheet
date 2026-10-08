import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerCode from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw';
import { MAX_IMAGE_SIDE } from './constants.ts';

const THUMB_MAX_SIDE = 180;

let workerReady = false;

function configureWorker(): void {
    if (workerReady) return;
    const blob = new Blob([workerCode], { type: 'text/javascript' });
    GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
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

async function renderPageAtScale(
    pageNumber: number,
    maxSide: number,
    maxScale = 4,
): Promise<HTMLCanvasElement> {
    if (!openDocument) throw new Error('No PDF is open');
    const page = await openDocument.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxScale, maxSide / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not draw the PDF page');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
}

export async function renderPdfPage(pageNumber: number): Promise<HTMLCanvasElement> {
    return renderPageAtScale(pageNumber, MAX_IMAGE_SIDE, 4);
}

export async function renderPdfThumbnail(pageNumber: number): Promise<string> {
    const canvas = await renderPageAtScale(pageNumber, THUMB_MAX_SIDE, 1);
    return canvas.toDataURL('image/png');
}
