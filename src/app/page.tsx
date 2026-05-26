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
    <div className="min-w-0 flex-1 rounded-card border border-gray-100 bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
        Step {step}
      </p>
      <h3 className="mt-1 text-sm font-semibold text-gray-800">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p>
      {progress ? <p className="mt-2 text-xs font-medium text-brand-600">{progress}</p> : null}
      <Link className="mt-3 inline-block text-xs text-brand-600 hover:underline" href={href}>
        进入 →
      </Link>
    </div>
  );
}

function ToolCard({ title, description, href }: ToolItem) {
  return (
    <Link
      className="flex gap-3 rounded-card border border-gray-100 bg-surface p-5 transition hover:border-brand-200"
      href={href}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;
  const [stats, readCount, channelSections] = await Promise.all([
    userId ? getVocabStats(userId) : Promise.resolve(null),
    userId ? prisma.lecturaRead.count({ where: { userId } }) : Promise.resolve(0),
    Promise.all(
      curatedChannels.map(async (channel) => ({
        channel,
        videos: await fetchChannelVideos(channel.id)
      }))
    )
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

        <div className="mt-16" id="video-sections">
          {channelSections.map(({ channel, videos }) => (
            <section
              className="mb-8 border-t border-gray-100 pt-6 first:border-t-0 first:pt-0"
              key={channel.id}
            >
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{channel.title}</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {channelDescriptions[channel.title] ?? "策划频道内容。"}
                  </p>
                </div>
                <Link
                  className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
                  href={`/search?q=${encodeURIComponent(channel.title)}`}
                >
                  查看全部 →
                </Link>
              </div>

              <div className="flex gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
                {videos.length === 0 ? (
                  <div className="flex h-40 w-full items-center justify-center rounded-surface border border-dashed border-gray-200 bg-surface text-sm text-gray-400">
                    暂时还没有拉到视频数据
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          Esponal 路 为中文母语者设计的西语学习平台
        </footer>
      </div>
    </main>
  );
}
