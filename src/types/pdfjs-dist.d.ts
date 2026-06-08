// Timestamp: 2026-06-08 23:25

declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(input: {
    url: string;
    withCredentials?: boolean;
    disableWorker?: boolean;
    disableRange?: boolean;
    disableStream?: boolean;
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
