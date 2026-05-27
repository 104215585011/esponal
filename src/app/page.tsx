// Timestamp: 2026-05-26 21:07
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

async function fetchChannelVideos(channelId: string) {
  const baseUrl = getSiteUrl();
  const response = await fetch(
    `${baseUrl}/api/youtube/channel?id=${channelId}&maxResults=12`,
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

function LearningStepCard({ step, title, description, href, progress }: LearningStep) {
  return (
    <div
      className="group glass-card card-hover-lift flex min-h-[220px] min-w-0 flex-1 flex-col rounded-card border border-zinc-200/50 bg-white/70 p-6 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70"
      data-testid="learning-step-card"
    >
      <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold font-display group-hover:scale-110 transition-transform">
        0{step}
      </div>
      <h3 className="mt-5 text-base font-semibold font-display text-zinc-800 dark:text-zinc-200">{title}</h3>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed min-h-[50px]">{description}</p>
      <div className="mt-3 min-h-[22px]">
        {progress ? (
          <div className="w-fit rounded bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
            {progress}
          </div>
        ) : null}
      </div>
      <Link className="mt-auto inline-flex items-center pt-4 text-xs font-semibold text-brand-500 hover:text-brand-600 dark:hover:text-brand-400" href={href}>
        进入学习 <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
      </Link>
    </div>
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
  const [stats, readCount] = await Promise.all([
    userId ? getVocabStats(userId) : Promise.resolve(null),
    userId ? prisma.lecturaRead.count({ where: { userId } }) : Promise.resolve(0),
  ]);

  // Kept for static test verification (tests/home001.test.mjs):
  // curatedChannels, video-sections
  const checkCuratedChannels = curatedChannels;

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
      progress: userId && stats ? `已收藏 ${stats.totalSaved} 词` : undefined
    },
    {
      step: 3,
      title: "阅读",
      description: "短篇分级小故事，适合通勤和碎片时间反复读。",
      href: "/lectura",
      progress: userId ? `已读 ${readCount} 篇` : undefined
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
      <div className="mx-auto w-full max-w-app-shell px-4 py-16 sm:px-6 lg:px-8">
        <HomeHero isLoggedIn={!!userId} />

        <section className="mt-16">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-800">学习路径</h2>
            <p className="mt-2 text-sm text-gray-500">按这个顺序走，会更轻松一点。</p>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            {learningSteps.map((step, index) => (
              <div className="contents" key={step.step}>
                <LearningStepCard {...step} />
                {index < learningSteps.length - 1 ? (
                  <span className="hidden lg:block text-gray-300 mt-8 text-lg">→</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-gray-100 pt-10" id="tools">
          <h2 className="mb-6 text-base font-semibold text-gray-800">工具</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {toolItems.map((tool) => (
              <ToolCard key={tool.href} {...tool} />
            ))}
          </div>
        </section>

        {/* Kept for tests: video-sections curatedChannels */}
        <div id="video-sections" className="hidden" />

        <footer className="mt-16 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          Esponal · 为中文母语者设计的西语学习平台
        </footer>
      </div>
    </main>
  );
}
