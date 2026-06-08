// Timestamp: 2026-06-08 17:31
export const OCR_PAGE_LIMIT = 300;

export class OcrPageLimitError extends Error {
  readonly pageCount: number;

  constructor(pageCount: number, message = "ocr_page_limit") {
    super(message);
    this.name = "OcrPageLimitError";
    this.pageCount = pageCount;
  }
}

export class OcrProviderError extends Error {
  readonly code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = "OcrProviderError";
    this.code = code;
  }
}

type OcrConfig = {
  apiUrl: string;
  apiToken: string | null;
  timeoutMs: number;
};

function getOcrConfig(): OcrConfig | null {
  const apiUrl = process.env.IMPORT_OCR_API_URL?.trim();
  const apiToken = process.env.IMPORT_OCR_API_TOKEN?.trim() || null;
  const timeoutMs = Number(process.env.IMPORT_OCR_TIMEOUT_MS ?? 180000);

  if (!apiUrl) {
    return null;
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    apiToken,
    timeoutMs: timeoutMs > 0 && Number.isFinite(timeoutMs) ? timeoutMs : 180000,
  };
}

function normalizeOcrPages(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((page) => (typeof page === "string" ? page.trim() : ""))
    .filter((page) => page.length > 0);
}

async function requestOcrProvider(
  config: OcrConfig,
  input: {
    fileName: string;
    pdfBase64: string;
    pageCount: number;
  },
) {
  const headers: HeadersInit = {
    "content-type": "application/json",
  };

  if (config.apiToken) {
    headers.authorization = `Bearer ${config.apiToken}`;
  }

  try {
    const response = await fetch(`${config.apiUrl}/ocr`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        fileName: input.fileName,
        pdfBase64: input.pdfBase64,
        pageCount: input.pageCount,
        language: "es",
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      throw new OcrProviderError(
        "ocr_provider_failed",
        `ocr_provider_failed:${response.status}`,
      );
    }

    return (await response.json()) as { pages?: unknown };
  } catch (error) {
    if (error instanceof OcrProviderError) {
      throw error;
    }

    throw new OcrProviderError("ocr_provider_failed");
  }
}

export async function runOcr(input: {
  fileName: string;
  pdfBase64: string;
  pageCount: number;
}) {
  if (input.pageCount > OCR_PAGE_LIMIT) {
    throw new OcrPageLimitError(input.pageCount);
  }

  const config = getOcrConfig();
  if (!config) {
    throw new OcrProviderError("ocr_provider_unavailable");
  }

  const payload = await requestOcrProvider(config, input);
  const pages = normalizeOcrPages(payload.pages);

  if (pages.length === 0) {
    throw new OcrProviderError("ocr_provider_empty");
  }

  if (pages.length !== input.pageCount) {
    throw new OcrProviderError("ocr_provider_page_mismatch");
  }

  return pages;
}
