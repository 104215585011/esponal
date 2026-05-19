"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isStandalone()) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  if (!promptEvent || dismissed) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
      <span>也可以添加到主屏，离线继续读 Lectura。</span>
      <button
        className="rounded-card bg-brand-600 px-3 py-1.5 font-semibold text-white transition hover:bg-brand-700"
        onClick={async () => {
          const event = promptEvent;
          await event.prompt();
          setDismissed(true);
          setPromptEvent(null);
        }}
        type="button"
      >
        添加到主屏
      </button>
    </div>
  );
}
