// Timestamp: 2026-06-08 18:22
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { getImportedDocumentByIdForUser } from "@/lib/import/service";
import { ImportReaderClient } from "./ImportReaderClient";

export const dynamic = "force-dynamic";

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

export default async function ImportReaderPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    redirect(`/auth/sign-in?callbackUrl=/import/${params.id}`);
  }

  const document = await getImportedDocumentByIdForUser(userId, params.id);

  if (!document || document.status !== "ready") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-app pb-24">
      <SiteHeader />
      <section className="mx-auto max-w-app-shell px-4 py-5 md:py-8">
        <header className="mb-5 md:mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
            Imported Reading
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-zinc-900 md:text-[32px]">
            {document.title}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            共 {document.pageCount} 页，当前第 {document.lastPageIndex + 1} 页
          </p>
        </header>

        <ImportReaderClient
          documentId={document.id}
          initialPageIndex={document.lastPageIndex}
          pageCount={document.pageCount}
          title={document.title}
        />
      </section>
    </main>
  );
}
