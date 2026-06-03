// Timestamp: 2026-06-03 16:36
import Link from "next/link";
import { getServerSession } from "next-auth";
import { HomeHero } from "@/app/components/web/HomeHero";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { VideoCard } from "@/app/components/web/VideoCard";
import { getAuthOptions } from "@/lib/auth";
import { curatedChannels } from "@/lib/channels";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { getVocabStats } from "@/lib/vocab";
import { lecturaStories } from "@/../content/lectura";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";

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
  percentage?: number;
};

type ToolItem = {
  title: string;
  description: string;
  href: string;
};

const channelDescriptions: Record<string, string> = {
  "Dreaming Spanish": "推荐入门，语速慢，适合建立可理解输入。",
  "Extra Spanish": "轻松情景剧，适合跟着语境反复吸收表达。",
  "Español con Juan": "偏讲解型频道，适合把输入和语法串起来。"
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

async function fetchChannelVideos(channelId: string, maxResults = 8) {
  const baseUrl = getSiteUrl();
  const response = await fetch(
    `${baseUrl}/api/youtube/channel?id=${channelId}&maxResults=${maxResults}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return [] as YouTubeVideoPayload[];
  }

  const payload = (await response.json()) as
    | YouTubeVideoPayload[]
    | { videos?: YouTubeVideoPayload[] };

  return Array.isArray(payload) ? payload : payload.videos ?? [];
}

function LearningStepCard({ step, title, description, href, progress, percentage }: LearningStep) {
  return (
    <Link
      className="group glass-card md:card-hover-lift flex min-h-[150px] w-[140px] shrink-0 snap-start flex-col rounded-card border border-zinc-200/50 bg-white/70 p-4 shadow-sm transition active:scale-[0.98] dark:border-zinc-800/50 dark:bg-zinc-900/70 md:min-h-[220px] md:w-auto md:min-w-0 md:flex-1 md:p-6"
      data-testid="learning-step-card"
      href={href}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 font-display font-bold text-brand-600 transition-transform group-hover:scale-110 dark:bg-brand-950/50 dark:text-brand-400 md:h-10 md:w-10">
        0{step}
      </div>
      <h3 className="mt-4 font-display text-sm font-semibold text-zinc-800 dark:text-zinc-200 md:mt-5 md:text-base">{title}</h3>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 md:min-h-[50px]">{description}</p>
      <div className="mt-3 min-h-[22px]">
        {progress ? (
          <div className="flex w-fit items-center gap-1.5 rounded bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
            {percentage !== undefined ? (
              <svg className="hidden h-3.5 w-3.5 -rotate-90 shrink-0 md:block" viewBox="0 0 36 36">
                <circle
                  className="text-brand-200/50 dark:text-brand-900/35"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="transparent"
                  r="16"
                  cx="18"
                  cy="18"
                />
                <circle
                  className="text-brand-600 dark:text-brand-400 transition-all duration-500 ease-out"
                  strokeWidth="4"
                  pathLength="100"
                  strokeDasharray={`${percentage} 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="16"
                  cx="18"
                  cy="18"
                />
              </svg>
            ) : null}
            <span>{progress}</span>
          </div>
        ) : null}
      </div>
      <span className="mt-auto inline-flex items-center pt-4 text-xs font-semibold text-brand-500 group-hover:text-brand-600 dark:group-hover:text-brand-400">
        进入学习 <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}

function ToolCard({ title, description, href }: ToolItem) {
  return (
    <Link
      className="group glass-card card-hover-lift flex gap-4 rounded-card border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 p-6 shadow-sm hover:border-brand-300 dark:hover:border-brand-700/50"
      href={href}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold font-display text-zinc-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;
  const selectedChannel = curatedChannels[0];
  const [stats, readCount, selectedVideos] = await Promise.all([
    userId ? getVocabStats(userId) : Promise.resolve(null),
    userId ? prisma.lecturaRead.count({ where: { userId } }) : Promise.resolve(0),
    selectedChannel ? fetchChannelVideos(selectedChannel.id, 8) : Promise.resolve([]),
  ]);

  const learningSteps: LearningStep[] = [
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
      progress: userId && stats ? `已收藏 ${stats.totalSaved} 词` : undefined,
      percentage: userId && stats ? Math.min(100, Math.round((stats.totalSaved / 50) * 100)) : undefined
    },
    {
      step: 3,
      title: "阅读",
      description: "短篇分级小故事，适合通勤和碎片时间反复读。",
      href: "/lectura",
      progress: userId ? `已读 ${readCount} 篇` : undefined,
      percentage: userId && lecturaStories.length > 0 ? Math.min(100, Math.round((readCount / lecturaStories.length) * 100)) : undefined
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

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto w-full max-w-app-shell px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:pt-16 md:pb-16 lg:px-8">
        <HomeHero isLoggedIn={!!userId} />

        {userId && stats ? (
          <section className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-brand-700 dark:border-brand-900/50 dark:bg-brand-950/20 dark:text-brand-300 md:hidden">
            已收藏 {stats.totalSaved} 词 · 已读 {readCount} 篇
          </section>
        ) : null}

        <section className="mt-8 md:mt-16">
          <div className="mb-3 md:mb-6">
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">学习路径</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 md:mt-2 md:text-sm">按这个顺序走，会更轻松一点。</p>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:overflow-visible lg:flex-row lg:items-start">
            {learningSteps.map((step, index) => (
              <div className="contents" key={step.step}>
                <LearningStepCard {...step} />
                {index < learningSteps.length - 1 ? (
                  <span className="mt-8 hidden text-lg text-zinc-300 lg:block">→</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 hidden border-t border-zinc-100 pt-10 dark:border-zinc-900 md:block" id="tools">
          <h2 className="mb-6 text-base font-semibold text-zinc-800 dark:text-zinc-200">工具</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {toolItems.map((tool) => (
              <ToolCard key={tool.href} {...tool} />
            ))}
          </div>
        </section>

        {selectedVideos.length > 0 ? (
          <section className="mt-8 md:mt-16" id="video-sections">
            <div className="mb-3 flex items-baseline justify-between md:mb-6">
              <div>
                <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">精选视频</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 md:text-sm">
                  {selectedChannel
                    ? `${selectedChannel.title} · ${channelDescriptions[selectedChannel.title] ?? "适合今天继续听一点。"}`
                    : "适合今天继续听一点。"}
                </p>
              </div>
              <Link className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400" href="/watch">
                全部 <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {selectedVideos.map((video) => (
                <div className="shrink-0 snap-start" key={video.id}>
                  <VideoCard video={video} />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div id="video-sections" className="hidden" />
        )}

        <footer className="mt-8 border-t border-zinc-100 pt-6 text-center text-[11px] text-zinc-400 dark:border-zinc-900 dark:text-zinc-500 md:mt-16 md:text-xs">
          Esponal · 为中文母语者设计的西语学习平台
        </footer>
      </div>
    </main>
  );
}
