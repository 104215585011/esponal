// Timestamp: 2026-11-12 21:40
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  parseYouTubeStartSeconds,
  parseYouTubeVideoId
} from "@/lib/import/parse-video-url";

export function OpenVideoInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const raw = value.trim();
    if (!raw) return;

    const videoId = parseYouTubeVideoId(raw);

    if (!videoId) {
      setError("无法识别这个链接，请粘贴完整的 YouTube 链接或视频 ID");
      return;
    }

    const startSeconds = parseYouTubeStartSeconds(raw);
    const start = startSeconds && startSeconds > 0 ? `&t=${startSeconds}s` : "";

    setError(null);
    router.push(`/watch?v=${videoId}${start}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex w-full items-center gap-2 rounded-full border border-zinc-200/60 bg-white px-4 py-1.5 transition focus-within:border-brand-500/80 focus-within:ring-2 focus-within:ring-brand-100/30">
        <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 20 20">
          <path d="M18 6H8.5C6.567 6 5 7.567 5 9.5V14.5C5 16.433 6.567 18 8.5 18H18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M5 12H15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
        <input
          aria-label="粘贴 YouTube 链接播放"
          className="h-9 w-full border-0 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder="粘贴 YouTube 链接，直接播放…"
          type="text"
          value={value}
        />
        <button
          className="shrink-0 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!value.trim()}
          type="submit"
        >
          播放
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-brand-red">{error}</p> : null}
    </form>
  );
}
