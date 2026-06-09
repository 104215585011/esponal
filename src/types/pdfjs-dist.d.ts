// Timestamp: 2026-06-09 09:03

declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(input: {
    url: string;
    withCredentials?: boolean;
    disableRange?: boolean;
    disableStream?: boolean;
  } | {
    data: Uint8Array;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getViewport(input: { scale: number }): { width: number; height: number };
        render(input: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }): { promise: Promise<void> };
      }>;
    }>;
  };
}
