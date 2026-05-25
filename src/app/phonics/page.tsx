import { SPANISH_ALPHABET } from "@/../content/phonics/alphabet";
import { AlphabetGrid } from "./AlphabetGrid";

export default function PhonicsPage() {
  return (
    <main className="mx-auto max-w-app-shell px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-8">
        <h1 className="text-4xl font-semibold tracking-normal text-gray-950 sm:text-5xl">
          西语字母
        </h1>
        <p className="mt-3 text-base text-gray-600">27 个字母 · 听一遍，就开始</p>
      </section>

      <AlphabetGrid letters={SPANISH_ALPHABET} />
    </main>
  );
}
