// Timestamp: 2026-11-15 02:35
import Link from "next/link";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getLastCourseEncounter, getLastVideoEncounter } from "@/lib/continueLearning";
import { getDueReviewCount, getVocabStats } from "@/lib/vocab";

export const dynamic = "force-dynamic";

type SessionUserWithId = {
  id?: string;
};

type Entry = {
  title: string;
  hint: string;
  href: string;
};

const tools: Entry[] = [
  { title: "学习路线", hint: "A1 → B1", href: "/learn" },
  { title: "语料库", hint: "生词本", href: "/vocab" },
  { title: "AI 对话", hint: "5 位老师", href: "/talk" },
  { title: "语法", hint: "要点卡片", href: "/grammar" },
  { title: "拆解", hint: "句子骨架", href: "/dissect" },
  { title: "字母", hint: "发音入门", href: "/phonics" },
];

export default async function MobileHomePage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;

  const [dueCount, stats, lastVideo, lastCourse] = userId
    ? await Promise.all([
        getDueReviewCount(userId).catch(() => 0),
        getVocabStats(userId).catch(() => null),
        getLastVideoEncounter(userId).catch(() => null),
        getLastCourseEncounter(userId).catch(() => null),
      ])
    : [0, null, null, null];

  const resumeItem = lastVideo
    ? {
        eyebrow: `上次观看 · ${lastVideo.relativeTime}`,
        title: lastVideo.title,
        subtitle: lastVideo.originalSentence,
        href: `/watch?v=${lastVideo.videoId}${lastVideo.timestampSec > 0 ? `&t=${Math.floor(lastVideo.timestampSec)}` : ""}`,
        cta: "继续看视频 →",
      }
    : lastCourse
      ? {
          eyebrow: `上次课程 · ${lastCourse.relativeTime}`,
          title: lastCourse.title,
          subtitle: lastCourse.originalSentence,
          href: `/learn/${lastCourse.slug}`,
          cta: "继续学习 →",
        }
      : null;

  const primaryEntries: Entry[] = [
    {
      title: "复习生词",
      hint: userId
        ? dueCount > 0
          ? `${dueCount} 个词该复习了`
          : `已收藏 ${stats?.totalSaved ?? 0} 词`
        : "登录后同步个人词库",
      href: "/review",
    },
    { title: "看视频", hint: "YouTube 双语字幕", href: "/watch" },
    { title: "读短文", hint: "分级读物 + 我的导入", href: "/lectura" },
  ];

  return (
    <main className="px-4 pb-6 pt-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
        Hoy
      </p>
      <h1 className="mt-2 text-[26px] font-extrabold leading-[1.3] tracking-tight text-zinc-950 dark:text-zinc-50">
        今天继续读一点
        <br />
        西语。
      </h1>

      {resumeItem ? (
        <Link
          href={resumeItem.href}
          className="mt-4 block rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50 to-white p-4 shadow-card transition active:scale-[0.99] dark:border-brand-900/50 dark:from-brand-950/40 dark:to-zinc-900"
        >
          <div className="text-[11px] font-semibold text-brand-700 dark:text-brand-400">
            {resumeItem.eyebrow}
          </div>
          <div className="mt-1 truncate text-[15px] font-bold text-zinc-950 dark:text-zinc-50">
            {resumeItem.title}
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
            {resumeItem.subtitle}
          </p>
          <div className="mt-3 text-xs font-semibold text-brand-600 dark:text-brand-400">
            {resumeItem.cta}
          </div>
        </Link>
      ) : (
        <p className="mt-2.5 text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
          不打卡、不催促，选一个想听或想读的内容开始。
        </p>
      )}

      <div className="mt-5 grid gap-2">
        {primaryEntries.map((entry) => (
          <Link
            className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white px-4 py-3.5 transition active:scale-[0.99] dark:border-zinc-800/70 dark:bg-zinc-900"
            href={entry.href}
            key={entry.href}
          >
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{entry.title}</span>
              <span className="mt-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">{entry.hint}</span>
            </span>
            <span className="text-[12px] font-semibold text-brand-600 dark:text-brand-400">进入 →</span>
          </Link>
        ))}
      </div>

      <h2 className="mt-7 text-[15px] font-bold text-zinc-900 dark:text-zinc-50">练习与工具</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {tools.map((tool) => (
          <Link
            className="rounded-2xl border border-zinc-200/70 bg-white px-2 py-3.5 text-center transition active:scale-[0.97] dark:border-zinc-800/70 dark:bg-zinc-900"
            href={tool.href}
            key={tool.href}
          >
            <span className="block text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-50">{tool.title}</span>
            <span className="mt-1 block text-[10.5px] text-zinc-500 dark:text-zinc-400">{tool.hint}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
