"use client";

import { useState } from "react";

type SubtitlePanelProps = {
  spanishLine: string;
  chineseLine: string;
};

export function SubtitlePanel({
  spanishLine,
  chineseLine
}: SubtitlePanelProps) {
  const [showChinese, setShowChinese] = useState(true);

  return (
    <section className="min-h-20 rounded-b-xl bg-[#1A1A1A] px-6 py-3 text-center">
      <div className="mb-2 flex justify-end">
        <button
          className="text-xs text-white/40 transition hover:text-white/70"
          onClick={() => setShowChinese((value) => !value)}
          type="button"
        >
          {showChinese ? "隐藏中文" : "显示中文"}
        </button>
      </div>
      <p className="text-base font-normal leading-7 text-white/70">{spanishLine || "暂无字幕"}</p>
      <p className={`mt-1 text-lg font-medium leading-7 text-white ${showChinese ? "" : "hidden"}`}>
        {chineseLine || "…"}
      </p>
      {!spanishLine ? (
        <p className="mt-1 text-xs text-white/20">暂无字幕</p>
      ) : null}
    </section>
  );
}
