declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
    const component: DefineComponent<{}, {}, any>;
    export default component;
}

declare module '*.svg' {
    const content: string;
    export default content;
}

declare module '*.json' {
    const value: unknown;
    export default value;
}

declare module '*.mjs?url' {
    const url: string;
    export default url;
}

declare module '*.mjs?raw' {
    const content: string;
    export default content;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
    interface PdfViewport {
        width: number;
        height: number;
    }

    interface PdfPageHandle {
        getViewport(params: { scale: number }): PdfViewport;
        render(params: {
            canvasContext: CanvasRenderingContext2D;
            viewport: PdfViewport;
        }): { promise: Promise<void> };
    }

    interface PdfDocumentHandle {
        numPages: number;
        getPage(pageNumber: number): Promise<PdfPageHandle>;
        destroy(): Promise<void>;
    }

    export const GlobalWorkerOptions: { workerSrc: string };

    export function getDocument(src: {
        data: ArrayBuffer;
        disableRange?: boolean;
        disableStream?: boolean;
    }): {
        promise: Promise<PdfDocumentHandle>;
    };
}
