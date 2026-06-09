// Timestamp: 2026-06-09 11:52
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
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
    <main className="min-h-screen bg-[#f6f4ef]">
      <ImportReaderClient
        documentId={document.id}
        kind={document.kind}
        lastPosition={document.lastPosition}
        title={document.title}
        unitCount={document.unitCount}
      />
    </main>
  );
}
