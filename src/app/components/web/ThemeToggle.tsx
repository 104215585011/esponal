"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "color-theme";

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = window.localStorage.getItem(storageKey);
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const preferredTheme = getPreferredTheme();
    applyTheme(preferredTheme);
    setTheme(preferredTheme);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={theme === "dark" ? "切换到日间模式" : "切换到夜间模式"}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:scale-105 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
      onClick={() => {
        applyTheme(nextTheme);
        window.localStorage.setItem(storageKey, nextTheme);
        setTheme(nextTheme);
      }}
      type="button"
    >
      {theme === "dark" ? (
        <svg aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 20 20">
          <path
            clipRule="evenodd"
            d="M10 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm7 5a1 1 0 1 0 0-2h-1a1 1 0 1 0 0 2h1ZM5.76 4.34A1 1 0 0 0 4.34 5.76l.71.7a1 1 0 0 0 1.41-1.4l-.7-.72Zm8.48 0-.7.71a1 1 0 0 0 1.4 1.41l.72-.7a1 1 0 0 0-1.42-1.42ZM4 11a1 1 0 1 0 0-2H3a1 1 0 0 0 0 2h1Zm2.46 3.95a1 1 0 0 0-1.41-1.41l-.71.7a1 1 0 0 0 1.42 1.42l.7-.71Zm8.49-1.41a1 1 0 0 0-1.41 1.41l.7.71a1 1 0 0 0 1.42-1.42l-.71-.7ZM11 16a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0v-1Z"
            fillRule="evenodd"
          />
        </svg>
      ) : (
        <svg aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 20 20">
          <path d="M17.29 13.29A8 8 0 0 1 6.71 2.71a8 8 0 1 0 10.58 10.58Z" />
        </svg>
      )}
    </button>
  );
}
