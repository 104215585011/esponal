// Timestamp: 2026-11-13 13:40
"use client";

import { useEffect, useState } from "react";

export const MOBILE_QUERY = "(max-width: 767px)";

/**
 * 视口判断:壳只在移动端渲染。
 * 用 JS 而不是 CSS md:hidden —— 桌面端不应该挂载移动壳的 DOM 与事件。
 * SSR 首帧返回 false,水合后立刻校正。
 */
export function useIsMobile(query: string = MOBILE_QUERY) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}
