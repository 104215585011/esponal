// Timestamp: 2026-11-15 03:20
"use client";

import { useEffect, useState } from "react";

export function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is not available"));
  }

  const w = window as any;
  if (w.YT?.Player) {
    return Promise.resolve(w.YT);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const handleReady = () => {
      if (w.YT?.Player) {
        resolve(w.YT);
        return;
      }
      reject(new Error("YouTube iframe API did not initialize"));
    };

    const previousReady = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      handleReady();
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load YouTube iframe API"));
      document.head.appendChild(script);
    }
  });
}

export function useIsMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateMobileViewport();
    mediaQuery.addEventListener("change", updateMobileViewport);
    return () => mediaQuery.removeEventListener("change", updateMobileViewport);
  }, []);

  return isMobileViewport;
}
