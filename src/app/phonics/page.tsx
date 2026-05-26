// Timestamp: 2026-05-26 16:25
import { SPANISH_ALPHABET } from "@/../content/phonics/alphabet";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { AlphabetGrid } from "./AlphabetGrid";
import { PhonicsIntro } from "./PhonicsIntro";
import { PhonicsProsody } from "./PhonicsProsody";

export default function PhonicsPage() {
  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto max-w-app-shell px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-5xl font-display">
            西语字母
          </h1>
          <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400 font-light">27 个字母 · 听一遍，就开始</p>
        </section>

        <section className="mb-10 border-b border-gray-100 pb-10 dark:border-zinc-800/80">
          <PhonicsIntro />
        </section>

        <AlphabetGrid letters={SPANISH_ALPHABET} />

        <PhonicsProsody />
      </div>
    </main>
  );
}
