// Timestamp: 2026-05-28 08:46
import { useEffect } from "react";

export function useReadingPosition(slug: string, active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const saved = localStorage.getItem(`read-pos-${slug}`);
    if (saved) {
      const position = parseInt(saved, 10);
      if (!isNaN(position)) {
        const timer = setTimeout(() => {
          window.scrollTo({ top: position, behavior: "instant" as ScrollBehavior });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [slug, active]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    let timeoutId: number;

    const handleScroll = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        localStorage.setItem(`read-pos-${slug}`, window.scrollY.toString());
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.clearTimeout(timeoutId);
    };
  }, [slug, active]);
}
