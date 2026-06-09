// Timestamp: 2026-06-09 14:15
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { UnifiedImportClient } from "./UnifiedImportClient";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="min-h-screen bg-app px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-8">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <Link
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full pr-3 text-sm font-semibold text-zinc-600 active:text-zinc-950"
          href="/vocab"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          返回语料库
        </Link>
        <Link
          className="inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-semibold text-brand-600 active:text-brand-700"
          href="/import/library"
        >
          我的导入库
        </Link>
      </div>
      <UnifiedImportClient />
    </main>
  );
}
