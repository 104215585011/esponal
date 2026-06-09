// Timestamp: 2026-06-09 09:12

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";
export const runtime = "nodejs";

const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");

export async function GET() {
  const workerSource = await readFile(workerPath, "utf8");

  return new Response(workerSource, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "text/javascript; charset=utf-8",
    },
  });
}
