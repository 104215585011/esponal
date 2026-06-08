// Timestamp: 2026-06-08 13:43
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function resolvePageWindow(
  pageCount: number,
  fromValue: string | null,
  toValue: string | null,
) {
  if (pageCount <= 0) {
    return {
      from: 0,
      to: 0,
      pageCount: 0,
    };
  }

  const maxPageIndex = pageCount - 1;
  const rawFrom = Number.parseInt(fromValue ?? "0", 10);
  const rawTo = Number.parseInt(toValue ?? String(maxPageIndex), 10);
  const from = clamp(Number.isFinite(rawFrom) ? rawFrom : 0, 0, maxPageIndex);
  const to = clamp(Number.isFinite(rawTo) ? rawTo : maxPageIndex, from, maxPageIndex);

  return {
    from,
    to,
    pageCount,
  };
}

export function clampLastPageIndex(lastPageIndex: number, pageCount: number) {
  if (pageCount <= 0) {
    return 0;
  }

  return clamp(lastPageIndex, 0, pageCount - 1);
}
