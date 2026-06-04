// Timestamp: 2026-06-04 10:37
import { SPANISH_ALPHABET } from "@/../content/phonics/alphabet";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { AlphabetGrid } from "./AlphabetGrid";
import { PhonicsIntro } from "./PhonicsIntro";
import { PhonicsProsody } from "./PhonicsProsody";

export default function PhonicsPage() {
  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto max-w-app-shell px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-10 lg:px-8">
        <section className="mb-6 md:mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl md:text-5xl">
            西语字母
          </h1>
          <p className="mt-2 text-sm font-light text-zinc-500 dark:text-zinc-400 md:mt-3 md:text-base">27 个字母 · 听一遍，就开始</p>
        </section>

        <section className="mb-8 border-b border-zinc-100 pb-8 dark:border-zinc-900 md:mb-10 md:pb-10">
          <PhonicsIntro />
        </section>

        <AlphabetGrid letters={SPANISH_ALPHABET} />

        <PhonicsProsody />
      </div>
    </main>
  );
}
