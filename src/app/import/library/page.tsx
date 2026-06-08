// Timestamp: 2026-06-08 18:22
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { buildImportedDocumentProgress } from "@/lib/import/progress";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

function formatKind(kind: string) {
  if (kind === "epub") return "EPUB";
  if (kind === "pdf_ocr") return "OCR PDF";
  return "PDF";
}

function formatFailReason(reason: string | null) {
  if (reason === "ocr_page_limit") return "页数超过 OCR 上限";
  if (reason === "insufficient_credits") return "配额不足，无法 OCR";
  if (reason === "ocr_failed") return "OCR 识别失败";
  if (reason === "unsupported_file_type") return "文件类型不支持";
  return "解析失败";
}

export default async function ImportLibraryPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    redirect("/auth/sign-in?callbackUrl=/import/library");
  }

  const documents = await prisma.importedDocument.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      failReason: true,
      pageCount: true,
      lastPageIndex: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <main className="min-h-screen bg-app pb-24">
      <SiteHeader />
      <section className="mx-auto max-w-app-shell px-4 py-5 md:py-8">
        <header className="mb-6 md:mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
            Import Library
          </p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-zinc-900 md:text-[32px]">
            我的导入库
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">
            EPUB 和 PDF 会被整理成可点词的阅读材料，处理完成后可以从上次页继续读。
          </p>
        </header>

        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center shadow-card">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-zinc-900">还没有导入内容</h2>
            <p className="mt-1 text-sm text-zinc-500">从导入入口上传 EPUB/PDF 后，会在这里出现。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {documents.map((document) => {
              const progress = buildImportedDocumentProgress(document);
              const progressWidth = `${progress.progressPercent}%`;

              if (document.status === "processing") {
                return (
                  <article
                    className="relative group flex flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-card transition-all active:scale-[0.98] md:p-5"
                    key={document.id}
                  >
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-md bg-brand-50/50 px-2 py-1 text-[10px] font-semibold text-brand-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      处理中
                    </span>
                    <div className="animate-pulse pr-20">
                      <h2 className="font-display text-lg font-bold text-zinc-900 line-clamp-2">
                        {document.title}
                      </h2>
                      <div className="mt-3 h-3 w-3/4 rounded-full bg-zinc-200" />
                      <div className="mt-2 h-3 w-1/2 rounded-full bg-zinc-100" />
                    </div>
                    <div className="mt-auto flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                      <span>{formatKind(document.kind)}</span>
                      <span>正在抽取文字</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-zinc-100">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-400" />
                    </div>
                  </article>
                );
              }

              if (document.status === "failed") {
                return (
                  <article
                    className="relative group flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/30 p-4 shadow-card transition-all active:scale-[0.98] md:p-5"
                    key={document.id}
                  >
                    <button
                      aria-label="删除失败记录"
                      className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-white/80 text-red-500"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="pr-12">
                      <h2 className="font-display text-lg font-bold text-zinc-900 line-clamp-2">
                        {document.title}
                      </h2>
                      <p className="mt-2 text-sm font-medium text-red-500">
                        {formatFailReason(document.failReason)}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                      <span>{formatKind(document.kind)}</span>
                      <span>{document.pageCount} 页</span>
                    </div>
                  </article>
                );
              }

              if (document.status === "ready") {
                return (
                  <Link
                    className="relative group flex flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-card transition-all hover:border-brand-300 active:scale-[0.98] md:p-5 md:hover:-translate-y-[2px] md:hover:shadow-elevated"
                    href={`/import/${document.id}`}
                    key={document.id}
                  >
                    <h2 className="font-display text-lg font-bold text-zinc-900 line-clamp-2">
                      {document.title}
                    </h2>
                    <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                        {formatKind(document.kind)}
                      </span>
                      <span>{document.pageCount} 页</span>
                      <span>{progress.currentPage} / {progress.pageCount}</span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 text-zinc-500">
                      点击继续阅读，查词、收藏和 AI 回落沿用阅读器体验。
                    </p>
                    <div className="mt-auto h-1 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: progressWidth }} />
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  className="relative group flex flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-card transition-all hover:border-brand-300 active:scale-[0.98] md:p-5 md:hover:-translate-y-[2px] md:hover:shadow-elevated"
                  href={`/import/${document.id}`}
                  key={document.id}
                >
                  <h2 className="font-display text-lg font-bold text-zinc-900 line-clamp-2">
                    {document.title}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                      {formatKind(document.kind)}
                    </span>
                    <span>{document.pageCount} 页</span>
                    <span>{progress.currentPage} / {progress.pageCount}</span>
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-zinc-500">
                    点击继续阅读，查词、收藏和 AI 回落沿用阅读器体验。
                  </p>
                  <div className="mt-auto h-1 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: progressWidth }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
