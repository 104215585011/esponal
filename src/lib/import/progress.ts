// Timestamp: 2026-06-08 15:28
export function buildImportedDocumentProgress(input: {
  pageCount: number;
  lastPageIndex: number;
}) {
  const currentPage = input.pageCount > 0 ? input.lastPageIndex + 1 : 0;
  const progressPercent =
    input.pageCount > 0 ? Math.min(100, Math.round((currentPage / input.pageCount) * 100)) : 0;

  return {
    currentPage,
    lastPageIndex: input.lastPageIndex,
    pageCount: input.pageCount,
    progressPercent,
  };
}
