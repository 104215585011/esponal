// Timestamp: 2026-05-28 08:46
"use client";

import { useState, useRef, useEffect } from "react";

export type ReadingFontSize = "sm" | "md" | "lg";
export type ReadingLookupMode = "float" | "dock";

type ReadingPreferencesProps = {
  fontSize: ReadingFontSize;
  setFontSize: (size: ReadingFontSize) => void;
  lookupMode: ReadingLookupMode;
  setLookupMode: (mode: ReadingLookupMode) => void;
};

export function ReadingPreferences({
  fontSize,
  setFontSize,
  lookupMode,
  setLookupMode
}: ReadingPreferencesProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label="阅读设置"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shadow-sm"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <svg className="h-4.5 w-4.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-50 w-56 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-900/95 p-4 shadow-xl backdrop-blur-md">
          <div className="space-y-4">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                字体大小
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/80 p-0.5">
                {(["sm", "md", "lg"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`rounded-md py-1.5 text-xs font-medium transition ${
                      fontSize === size
                        ? "bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                    type="button"
                  >
                    {size === "sm" && "A-"}
                    {size === "md" && "A"}
                    {size === "lg" && "A+"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                查词展示模式
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/80 p-0.5">
                {(["float", "dock"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setLookupMode(mode)}
                    className={`rounded-md py-1.5 text-xs font-medium transition ${
                      lookupMode === mode
                        ? "bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                    type="button"
                  >
                    {mode === "float" ? "浮动气泡" : "侧边固定"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
