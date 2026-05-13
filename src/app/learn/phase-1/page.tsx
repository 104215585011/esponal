// COURSE-001 change timestamp: 2026-05-13 13:54
import AudioButton from "@/app/components/audio/AudioButton";
import pronunciationContent from "../../../../content/curriculum/pronunciation-rules.json";
import wordContent from "../../../../content/curriculum/phase1-words.json";

type PartOfSpeech = "noun" | "verb" | "adjective";

type Word = {
  id: string;
  spanish: string;
  partOfSpeech: PartOfSpeech;
  gender?: "masculine" | "feminine";
  chinese: string;
  example: {
    spanish: string;
    chinese: string;
  };
  audioSrc: string;
};

const partOfSpeechLabels: Record<PartOfSpeech, string> = {
  noun: "名词",
  verb: "动词",
  adjective: "形容词"
};

const genderLabels = {
  masculine: "（阳性）",
  feminine: "（阴性）"
};

export default function PhaseOnePage() {
  const words = wordContent.words as Word[];

  return (
    <main
      className="min-h-screen bg-[#F9FAFB] text-gray-900"
      style={{ fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' }}
    >
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          阶段一：入门词汇与发音
        </h1>

        <section className="mt-8 border-t border-gray-100 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">发音规则</h2>
          <div className="mt-5 space-y-4">
            {pronunciationContent.rules.map((rule) => (
              <article className="leading-7 text-gray-600" key={rule.id}>
                <h3 className="font-semibold text-gray-800">
                  {rule.titleChinese}
                </h3>
                <p className="mt-1 text-sm sm:text-base">
                  {rule.explanationChinese}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  <strong className="font-semibold text-gray-700">
                    {rule.example.spanish}
                  </strong>
                  <span className="text-gray-400">
                    {" "}
                    - {rule.example.chinesePronunciation}
                  </span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 border-t border-gray-100 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">高频词汇</h2>
          <div className="mt-5 flex flex-col gap-3">
            {words.map((word) => (
              <article
                className="rounded-xl shadow-sm border border-gray-100 p-4 bg-white"
                key={word.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      {word.spanish}
                    </h3>
                    <span className="rounded-full px-2 py-1 text-xs bg-gray-100 text-gray-500">
                      {partOfSpeechLabels[word.partOfSpeech]}
                    </span>
                  </div>
                  <AudioButton label={word.spanish} src={word.audioSrc} />
                </div>

                <p className="mt-2 text-base text-gray-700">
                  {word.chinese}
                  {word.gender ? (
                    <span className="ml-1 text-gray-400">
                      {genderLabels[word.gender]}
                    </span>
                  ) : null}
                </p>
                <p className="mt-3 text-sm text-gray-500 italic">
                  {word.example.spanish}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {word.example.chinese}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
