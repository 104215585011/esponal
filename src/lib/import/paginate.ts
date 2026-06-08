// Timestamp: 2026-06-08 12:58
type PaginateOptions = {
  targetCharsPerPage?: number;
};

function normalizeParagraphs(text: string) {
  return text
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function paginateImportedText(text: string, options: PaginateOptions = {}) {
  const targetCharsPerPage = options.targetCharsPerPage ?? 2500;
  const paragraphs = normalizeParagraphs(text);

  if (paragraphs.length === 0) {
    return [];
  }

  const pages: string[] = [];
  let currentPage = "";

  for (const paragraph of paragraphs) {
    const nextPage = currentPage ? `${currentPage}\n\n${paragraph}` : paragraph;

    if (currentPage && nextPage.length > targetCharsPerPage) {
      pages.push(currentPage);
      currentPage = paragraph;
      continue;
    }

    currentPage = nextPage;
  }

  if (currentPage) {
    pages.push(currentPage);
  }

  return pages;
}
