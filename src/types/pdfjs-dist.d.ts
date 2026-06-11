// Timestamp: 2026-06-09 09:48

declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerPort: Worker | null;
    workerSrc: string;
  };

  export function getDocument(input: {
    url: string;
    rangeChunkSize?: number;
    disableAutoFetch?: boolean;
    withCredentials?: boolean;
    disableRange?: boolean;
    disableStream?: boolean;
  } | {
    data: Uint8Array;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getTextContent(): Promise<{
          items: Array<{
            str?: string;
            transform?: number[];
            width?: number;
            height?: number;
          }>;
        }>;
        getViewport(input: { scale: number }): {
          width: number;
          height: number;
          convertToViewportPoint?: (x: number, y: number) => [number, number];
        };
        render(input: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }): { promise: Promise<void> };
      }>;
    }>;
  };
}
