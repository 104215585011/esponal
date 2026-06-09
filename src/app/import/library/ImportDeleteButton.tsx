// Timestamp: 2026-06-09 12:20
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function ImportDeleteButton({
  documentId,
  title,
  tone = "neutral",
}: {
  documentId: string;
  title: string;
  tone?: "neutral" | "danger";
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (isDeleting) return;
    if (!confirm(`确定删除「${title}」吗？`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/import/${documentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("delete failed");
      }
      router.refresh();
    } catch {
      alert("删除失败，请稍后重试。");
    } finally {
      setIsDeleting(false);
    }
  }

  const toneClass =
    tone === "danger"
      ? "border-red-100 bg-white/90 text-red-500 active:bg-red-50"
      : "border-zinc-200 bg-white/90 text-zinc-500 active:bg-zinc-100";

  return (
    <button
      aria-label={`删除 ${title}`}
      className={`flex h-9 w-9 items-center justify-center rounded-full border ${toneClass} disabled:opacity-50`}
      disabled={isDeleting}
      onClick={handleDelete}
      type="button"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}
