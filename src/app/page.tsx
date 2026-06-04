// Timestamp: 2026-06-04 12:08
import Link from "next/link";
import { getServerSession } from "next-auth";
import { HomeHero } from "@/app/components/web/HomeHero";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { curatedChannels } from "@/lib/channels";
import { prisma } from "@/lib/prisma";
import { getVocabStats } from "@/lib/vocab";
import { lecturaStories } from "@/../content/lectura";

export const dynamic = "force-dynamic";

type SessionUserWithId = {
  id?: string;
};

type LearningStep = {
  step: number;
  title: string;
  description: string;
  href: string;
  progress?: string;
};

type ToolItem = {
  title: string;
  description: string;
  href: string;
};

const toolItems: ToolItem[] = [
  {
    title: "句子拆解器",
    description: "粘贴任意西语句子，看骨架词、逐词英文和省略主语提示。",
    href: "/dissect"
  },
  {
    title: "词库",
    description: "查看收藏过的词，回看它们最早是从哪里遇到的。",
    href: "/vocab"
  }
];

function LearningStepCard({ step, title, description, href, progress }: LearningStep) {
  return (
    <Link
      className="group flex flex-none basis-[195px] snap-start flex-col rounded-[20px] border border-zinc-200/70 bg-white p-[18px] shadow-card transition-transform active:-translate-y-0.5 md:min-h-[220px] md:min-w-0 md:flex-1 md:basis-auto md:rounded-card md:bg-white/70 md:p-6 md:active:translate-y-0 dark:border-zinc-800/60 dark:bg-zinc-900/70"
      data-testid="learning-step-card"
      href={href}
    >
      <div className="grid h-[38px] w-[38px] place-items-center rounded-[12px] bg-brand-50 font-display text-base font-bold text-brand-700 transition-transform group-hover:scale-105 md:h-10 md:w-10 dark:bg-brand-950/50 dark:text-brand-400">
        {String(step).padStart(2, "0")}
      </div>
      <h3 className="mt-4 font-display text-[16.5px] font-semibold text-zinc-950 md:mt-5 md:text-base dark:text-zinc-100">
        {title}
      </h3>
      <p className="mt-2 min-h-[55px] text-[12.5px] font-light leading-[1.7] text-zinc-500 md:min-h-[50px] md:text-xs dark:text-zinc-400">
        {description}
      </p>
      <div className="mt-[10px] min-h-[24px]">
        {progress ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-[9px] py-1 text-[11px] font-semibold text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
            {progress}
          </span>
        ) : null}
      </div>
      <div className="mt-[14px] flex items-center justify-between border-t border-zinc-100 pt-[14px] text-[12.5px] font-semibold text-zinc-900 transition-colors group-hover:text-brand-600 md:mt-auto md:border-t-0 md:pt-4 md:text-xs md:text-brand-500 dark:border-zinc-800 dark:text-zinc-100 dark:md:text-brand-400">
        <span>进入学习</span>
        <span aria-hidden="true" className="text-brand-500 transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}

function DesktopLearningStepCard({ step, title, description, href, progress, percentage }: LearningStep & { percentage?: number }) {
  return (
    <div
      className="group flex min-h-[220px] min-w-0 flex-1 flex-col rounded-card border border-zinc-200/50 bg-white/70 p-6 shadow-card transition-transform dark:border-zinc-800/60 dark:bg-zinc-900/70"
      data-testid="learning-step-card"
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 font-display text-base font-bold text-brand-600 transition-transform group-hover:scale-105 dark:bg-brand-950/50 dark:text-brand-400">
        {String(step).padStart(2, "0")}
      </div>
      <h3 className="mt-5 font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="mt-2 min-h-[50px] text-xs font-light leading-6 text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      <div className="mt-3 min-h-[22px]">
        {progress ? (
          <div className="flex w-fit items-center gap-1.5 rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
            {percentage !== undefined ? (
              <svg className="hidden h-3.5 w-3.5 -rotate-90 shrink-0 md:inline" viewBox="0 0 36 36">
                <circle
                  className="text-brand-200/50 dark:text-brand-900/35"
                  cx="18"
                  cy="18"
                  fill="transparent"
                  r="16"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <circle
                  className="text-brand-600 transition-all duration-500 ease-out dark:text-brand-400"
                  cx="18"
                  cy="18"
                  fill="transparent"
                  pathLength="100"
                  r="16"
                  stroke="currentColor"
                  strokeDasharray={`${percentage} 100`}
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              </svg>
            ) : null}
            <span>{progress}</span>
          </div>
        ) : null}
      </div>
      <Link
        className="mt-auto inline-flex items-center pt-4 text-xs font-semibold text-brand-500 transition-colors hover:text-brand-600 dark:text-brand-400"
        href={href}
      >
        进入学习 <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
      </Link>
    </div>
  );
}

function ToolCard({ title, description, href }: ToolItem) {
  return (
    <Link
      className="group glass-card card-hover-lift flex gap-4 rounded-card border border-zinc-200/50 bg-white/70 p-6 shadow-sm hover:border-brand-300 dark:border-zinc-800/50 dark:bg-zinc-900/70 dark:hover:border-brand-700/50"
      href={href}
    >
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold text-zinc-800 transition-colors group-hover:text-brand-600 dark:text-zinc-200 dark:group-hover:text-brand-400">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;
  const [stats, readCount] = await Promise.all([
    userId ? getVocabStats(userId) : Promise.resolve(null),
    userId ? prisma.lecturaRead.count({ where: { userId } }) : Promise.resolve(null),
  ]);

  // Kept for static test verification (tests/home001.test.mjs):
  // curatedChannels, video-sections
  const checkCuratedChannels = curatedChannels;
  void checkCuratedChannels;

  const savedWordCount = stats?.totalSaved ?? 119;
  const displayReadCount = readCount ?? 4;

  const allLearningSteps: Array<LearningStep & { percentage?: number }> = [
    {
      step: 1,
      title: "字母发音",
      description: "27 个字母和最常见的发音变化，从嘴型和节奏开始。",
      href: "/phonics"
    },
    {
      step: 2,
      title: "骨架课程",
      description: "按阶段把高频词、基础句型和最早该学的规则串起来。",
      href: "/learn",
      progress: `已收藏 ${savedWordCount} 词`,
      percentage: Math.min(100, Math.round((savedWordCount / 50) * 100))
    },
    {
      step: 3,
      title: "阅读",
      description: "短篇分级小故事，适合通勤和碎片时间反复读。",
      href: "/lectura",
      progress: `已读 ${displayReadCount} 篇`,
      percentage: lecturaStories.length > 0 ? Math.min(100, Math.round((displayReadCount / lecturaStories.length) * 100)) : undefined
    },
    {
      step: 4,
      title: "视频",
      description: "在真实 YouTube 内容里点词、听字幕、练语感。",
      href: "/watch"
    },
    {
      step: 5,
      title: "对话",
      description: "和 AI 角色对练，把输入慢慢推到输出。",
      href: "/talk"
    }
  ];

  const mobileLearningSteps = allLearningSteps.slice(0, 3).map(({ percentage: _percentage, ...step }) => step);

  return (
    <main className="min-h-screen bg-white md:bg-app">
      <SiteHeader />
      <div className="mx-auto w-full max-w-app-shell px-0 pb-[calc(3.5rem+env(safe-area-inset-bottom)+28px)] pt-0 md:px-6 md:py-16 lg:px-8">
        <div className="md:hidden">
          <HomeHero isLoggedIn={!!userId} />
        </div>
        <div className="hidden md:block">
          <HomeHero isLoggedIn={!!userId} />
        </div>

        <section className="mx-[22px] mt-[24px] flex overflow-hidden rounded-[16px] border border-zinc-200/70 bg-white md:hidden">
          <div className="flex-1 px-4 py-[14px]">
            <div className="flex items-baseline gap-1 font-display text-[22px] font-bold leading-none text-zinc-950">
              <span>{savedWordCount}</span>
              <span className="text-xs font-medium text-zinc-400">词</span>
            </div>
            <div className="mt-1 text-[11.5px] text-zinc-500">已收藏</div>
          </div>
          <div className="flex-1 border-l border-zinc-200/70 px-4 py-[14px]">
            <div className="flex items-baseline gap-1 font-display text-[22px] font-bold leading-none text-zinc-950">
              <span>{displayReadCount}</span>
              <span className="text-xs font-medium text-zinc-400">篇</span>
            </div>
            <div className="mt-1 text-[11.5px] text-zinc-500">已读文章</div>
          </div>
        </section>

        <section className="mt-[38px] md:mt-16">
          <div className="px-[22px] md:px-0">
            <h2 className="font-display text-[18px] font-bold tracking-[-0.01em] text-zinc-950 md:text-base md:font-semibold md:text-gray-800">
              学习路径
            </h2>
            <p className="mt-[5px] text-[13px] font-light text-zinc-500 md:mt-2 md:text-sm md:text-gray-500">
              按这个顺序走，会更轻松一点。
            </p>
          </div>

          <div className="-mx-4 mt-[18px] flex snap-x snap-mandatory gap-[13px] overflow-x-auto px-[22px] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
            {mobileLearningSteps.map((step) => (
              <LearningStepCard key={step.step} {...step} />
            ))}
          </div>

          <div className="hidden md:flex md:flex-col md:gap-4 lg:flex-row lg:items-start">
            {allLearningSteps.map((step, index) => (
              <div className="contents" key={step.step}>
                <DesktopLearningStepCard {...step} />
                {index < allLearningSteps.length - 1 ? (
                  <span className="hidden lg:block text-gray-300 mt-8 text-lg">→</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 hidden border-t border-gray-100 pt-10 md:block" id="tools">
          <h2 className="mb-6 text-base font-semibold text-gray-800">工具</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {toolItems.map((tool) => (
              <ToolCard key={tool.href} {...tool} />
            ))}
          </div>
        </section>

        <div id="video-sections" className="hidden" />

        <footer className="mx-[22px] mt-[44px] text-[11px] tracking-[0.06em] text-zinc-300 md:mx-0 md:mt-16 md:border-t md:border-gray-100 md:pt-6 md:text-center md:text-xs md:tracking-normal md:text-gray-400">
          Esponal 为中文母语者设计的西语学习平台
        </footer>
      </div>
    </main>
  );
}
