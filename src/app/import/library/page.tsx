// Timestamp: 2026-06-09 12:20
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { listImportedDocumentsForUser } from "@/lib/import/service";
import { ImportDeleteButton } from "./ImportDeleteButton";

export const dynamic = "force-dynamic";

type ImportedDocument = Awaited<ReturnType<typeof listImportedDocumentsForUser>>[number];

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

function formatKind(kind: string) {
  return kind === "epub" ? "EPUB" : "PDF";
}

function formatSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function groupImportedDocuments(documents: ImportedDocument[]) {
  return [
    {
      key: "failed",
      title: "导入失败",
      description: "这些记录没有可读原件，可以删除后重新导入。",
      documents: documents.filter((document) => document.status === "failed"),
    },
    {
      key: "pdf",
      title: "PDF 文件",
      description: "保留原版页面，适合教材、讲义和扫描版资料。",
      documents: documents.filter((document) => document.status !== "failed" && document.kind === "pdf"),
    },
    {
      key: "epub",
      title: "EPUB 文件",
      description: "适合电子书和长篇文本阅读。",
      documents: documents.filter((document) => document.status !== "failed" && document.kind === "epub"),
    },
  ].filter((group) => group.documents.length > 0);
}

function progressWidth(document: ImportedDocument) {
  return document.lastPosition ? "35%" : "6%";
}

export default async function ImportLibraryPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    redirect("/auth/sign-in?callbackUrl=/import/library");
  }

  const documents = await listImportedDocumentsForUser(userId);
  const groups = groupImportedDocuments(documents);

  return (
    <main className="min-h-screen bg-app pb-24">
      <SiteHeader />
      <section className="mx-auto max-w-app-shell px-4 py-5 md:py-8">
        <header className="mb-6 md:mb-7">
          <Link
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full text-sm font-semibold text-zinc-600 active:text-zinc-900"
            href="/import"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            返回导入入口
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
            Import Library
          </p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-zinc-900 md:text-[32px]">
            我的导入库
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">
            EPUB 和 PDF 会保留原始图文版式。你可以按类型继续阅读，也可以删除不需要的文件。
          </p>
        </header>

        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center shadow-card">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <FileText className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-base font-semibold text-zinc-900">还没有导入内容</h2>
            <p className="mt-1 text-sm text-zinc-500">从导入入口上传 EPUB/PDF 后，会在这里出现。</p>
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900">{group.title}</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{group.description}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
                    {group.documents.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
                  {group.documents.map((document) => {
                    if (document.status === "failed") {
                      return (
                        <article
                          className="relative flex min-h-[156px] flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/30 p-4 shadow-card transition-all active:scale-[0.98] md:p-5"
                          key={document.id}
                        >
                          <div className="absolute right-4 top-4">
                            <ImportDeleteButton documentId={document.id} title={document.title} tone="danger" />
                          </div>
                          <div className="pr-12">
                            <h3 className="font-display text-lg font-bold text-zinc-900 line-clamp-2">
                              {document.title}
                            </h3>
                            <p className="mt-2 text-sm font-medium text-red-500">
                              {document.failReason ?? "导入失败"}
                            </p>
                          </div>
                        </article>
                      );
                    }

                    return (
                      <article className="relative" key={document.id}>
                        <Link
                          className="flex min-h-[178px] flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 pr-14 shadow-card transition-all hover:border-brand-300 active:scale-[0.98] md:p-5 md:pr-14 md:hover:-translate-y-[2px] md:hover:shadow-elevated"
                          href={`/import/${document.id}`}
                        >
                          <h3 className="font-display text-lg font-bold text-zinc-900 line-clamp-2">
                            {document.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-500">
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                              {formatKind(document.kind)}
                            </span>
                            <span>{formatSize(document.sizeBytes)}</span>
                            {document.unitCount > 0 ? <span>{document.unitCount} 页</span> : null}
                            {document.lastPosition ? <span>已保存进度</span> : null}
                          </div>
                          <p className="line-clamp-2 text-sm leading-6 text-zinc-500">
                            点击继续阅读。原件从 COS 安全加载，进度会自动保存。
                          </p>
                          <div className="mt-auto h-1 overflow-hidden rounded-full bg-zinc-100">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: progressWidth(document) }} />
                          </div>
                        </Link>
                        <div className="absolute right-4 top-4">
                          <ImportDeleteButton documentId={document.id} title={document.title} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
