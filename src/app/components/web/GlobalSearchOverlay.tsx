// Timestamp: 2026-05-28 08:40
"use client";

import { useEffect, useRef, useState } from "react";

type GlobalSearchOverlayProps = {
  searchAction?: string;
  initialQuery?: string;
};

export function GlobalSearchOverlay({
  searchAction = "/search",
  initialQuery = ""
}: GlobalSearchOverlayProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    // Auto-focus the input after animation
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [open]);

  return (
    <>
      <button
        aria-label="搜索"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg className="h-[18px] w-[18px] fill-none stroke-current stroke-2" viewBox="0 0 20 20">
          <circle cx="9" cy="9" r="5.5" />
          <path d="M13.5 13.5 18 18" />
        </svg>
      </button>

      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-[60] flex flex-col transition-all duration-300 ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-zinc-950/40 dark:bg-zinc-950/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />

        {/* Search panel */}
        <div
          className={`relative mx-auto mt-[env(safe-area-inset-top,0px)] w-full max-w-lg px-4 pt-4 transition-all duration-300 ${
            open ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          }`}
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
            <form
              action={searchAction}
              className="flex items-center gap-3 px-4"
            >
              <span aria-hidden="true" className="shrink-0 text-zinc-400 dark:text-zinc-500">
                <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 20 20">
                  <circle cx="9" cy="9" r="5.5" />
                  <path d="M13.5 13.5 18 18" />
                </svg>
              </span>
              <input
                ref={inputRef}
                className="h-12 w-full border-0 bg-transparent text-base text-zinc-800 dark:text-zinc-100 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                defaultValue={initialQuery}
                name="q"
                placeholder="搜索内容..."
                type="search"
              />
              <button
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
                type="button"
              >
                取消
              </button>
            </form>

            <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                输入关键词搜索视频、阅读、课程等内容
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
