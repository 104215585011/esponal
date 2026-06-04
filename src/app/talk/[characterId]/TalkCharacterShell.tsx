// Timestamp: 2026-06-04 12:11
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { TalkClient } from "./TalkClient";
import { TalkSidebar } from "./TalkSidebar";

type TalkCharacterShellProps = {
  characterId: string;
  characterName: string;
  characterLanguage: string;
  characterStyle: string;
  characterFlag: string;
  initialSessionId: string | null;
  locale: string;
};

export function TalkCharacterShell({
  characterId,
  characterName,
  characterLanguage,
  characterStyle,
  characterFlag,
  initialSessionId,
  locale
}: TalkCharacterShellProps) {
  const router = useRouter();
  const [sessionsOpen, setSessionsOpen] = useState(false);

  return (
    <main className="min-h-screen bg-app">
      <header className="fixed inset-x-0 top-0 z-50 grid h-[52px] grid-cols-[44px_1fr_44px] items-center border-b border-zinc-200/50 bg-white/70 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/70 md:hidden">
        <button
          aria-label="返回对话列表"
          className="flex h-11 w-11 items-center justify-center text-zinc-600 transition-transform active:scale-90 dark:text-zinc-300"
          onClick={() => router.push("/talk")}
          type="button"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.2}
            viewBox="0 0 24 24"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="min-w-0 text-center">
          <h1 className="truncate font-display text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
            {characterName}
          </h1>
          <p className="truncate text-[11px] font-light text-zinc-400 dark:text-zinc-500">
            {characterLanguage}
          </p>
        </div>

        <button
          aria-label="对话记录"
          className="flex h-11 w-11 items-center justify-center text-zinc-600 transition-transform active:scale-90 dark:text-zinc-300"
          onClick={() => setSessionsOpen(true)}
          type="button"
        >
          <svg
            className="h-[22px] w-[22px]"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>
      </header>

      <div className="hidden md:block"><SiteHeader /></div>

      <section className="mx-auto flex h-[calc(100dvh-52px)] md:h-[calc(100vh-64px)] w-full max-w-app-shell pt-[52px] md:pt-0 md:flex">
        <div className="hidden border-r border-zinc-200 px-4 pt-4 dark:border-zinc-800/80 md:block md:w-[260px] md:shrink-0">
          <TalkSidebar
            characterId={characterId}
            characterName={characterName}
            onOpenChange={setSessionsOpen}
            open={sessionsOpen}
          />
        </div>

        <div className="min-w-0 flex-1 md:px-4 md:pt-4">
          <div className="mx-auto flex h-full max-w-3xl flex-col">
            <div className="hidden md:block">
              <BackLink href="/talk" label="对话" />
              <header className="mb-3 mt-2 flex items-center gap-3">
                <span aria-hidden className="text-3xl">
                  {characterFlag}
                </span>
                <div>
                  <h1 className="font-display text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {characterName}
                  </h1>
                  <p className="text-[13px] font-light text-zinc-500 dark:text-zinc-400">
                    {characterLanguage} · {characterStyle}
                  </p>
                </div>
              </header>
            </div>

            <TalkSidebar
              characterId={characterId}
              characterName={characterName}
              onOpenChange={setSessionsOpen}
              open={sessionsOpen}
            />

            <TalkClient
              characterId={characterId}
              characterName={characterName}
              initialSessionId={initialSessionId}
              locale={locale}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
