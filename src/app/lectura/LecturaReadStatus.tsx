"use client";

import { useEffect, useState } from "react";

type LecturaReadStatusProps = {
  slug: string;
  isRead: boolean;
};

type LecturaMarkedEvent = CustomEvent<{ slug: string }>;

async function markRead(slug: string) {
  const response = await fetch(`/api/lectura/${slug}/read`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("mark read failed");
  }

  window.dispatchEvent(
    new CustomEvent("lectura:marked-read", {
      detail: { slug }
    })
  );
}

export function LecturaReadStatus({ slug, isRead }: LecturaReadStatusProps) {
  const [isMarked, setIsMarked] = useState(isRead);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleMarked = (event: Event) => {
      const detail = (event as LecturaMarkedEvent).detail;
      if (detail?.slug === slug) {
        setIsMarked(true);
        setIsSaving(false);
      }
    };

    window.addEventListener("lectura:marked-read", handleMarked as EventListener);
    return () => {
      window.removeEventListener("lectura:marked-read", handleMarked as EventListener);
    };
  }, [slug]);

  if (isMarked) {
    return (
      <span className="inline-flex min-h-[36px] items-center rounded-full bg-emerald-50 px-3 text-sm font-medium text-emerald-600 cursor-default">
        已读 ✓
      </span>
    );
  }

  return (
    <button
      className="inline-flex min-h-[36px] items-center rounded-full border border-emerald-100 px-3 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-default disabled:opacity-60"
      disabled={isSaving}
      onClick={() => {
        setIsSaving(true);
        markRead(slug)
          .then(() => setIsMarked(true))
          .catch(() => setIsSaving(false));
      }}
      type="button"
    >
      {isSaving ? "标记中..." : "标记为已读"}
    </button>
  );
}
