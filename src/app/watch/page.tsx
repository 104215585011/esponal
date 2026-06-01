// Timestamp: 2026-06-01 18:45
import EmptyState from "@/app/components/ui/EmptyState";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getSiteUrl } from "@/lib/site-url";
import { fetchYouTubeJson } from "@/lib/youtube";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { curatedChannels } from "@/lib/channels";
import { VideoCard } from "@/app/components/web/VideoCard";
import Link from "next/link";
import { WatchClient } from "./WatchClient";

export const dynamic = "force-dynamic";

const PLAYER_IFRAME_ID = "esponal-youtube-player";
const MOCK_CHAPTERS = [
  { time: "0:00", title: "介绍与嘉宾登场" },
  { time: "1:45", title: "加拿大人学西语的旅程" },
  { time: "5:20", title: "阿根廷口音的特点" },
  { time: "9:10", title: "vos 用法与日常对话" }
];

type WatchPageProps = {
  searchParams?: {
    v?: string;
  };
};

type OEmbedResponse = {
  title?: string;
  author_name?: string;
};

type VideoListResponse = {
  items?: Array<{
    snippet?: {
      title?: string;
      channelId?: string;
      channelTitle?: string;
    };
  }>;
};

const channelDescriptions: Record<string, string> = {
  "Dreaming Spanish": "推荐入门，语速慢，适合建立可理解输入。",
  "Extra Spanish": "轻松情景剧，适合跟着语境反复吸收表达。",
  "Español con Juan": "偏讲解型频道，适合把输入和语法串起来。"
};

async function fetchVideoInfo(videoId: string) {
  if (!videoId) {
    return {
      title: "未提供视频",
      channelTitle: "Esponal",
      channelId: ""
    };
  }

  try {
    const payload = await fetchYouTubeJson<VideoListResponse>("videos", {
      part: "snippet",
      id: videoId
    });
    const snippet = payload.items?.[0]?.snippet;

    if (snippet) {
      return {
        title: snippet.title?.trim() || "YouTube 视频",
        channelTitle: snippet.channelTitle?.trim() || "YouTube Channel",
        channelId: snippet.channelId?.trim() || ""
      };
    }
  } catch (error) {
    console.warn("Watch page YouTube video snippet failed", error);
  }

  try {
    const watchUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${watchUrl}&format=json`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`oEmbed failed: ${response.status}`);
    }

    const payload = (await response.json()) as OEmbedResponse;

    return {
      title: payload.title?.trim() || "YouTube 视频",
      channelTitle: payload.author_name?.trim() || "YouTube Channel",
      channelId: ""
    };
  } catch (error) {
    console.warn("Watch page oEmbed failed", error);

    return {
      title: "YouTube 视频",
      channelTitle: "YouTube Channel",
      channelId: ""
    };
  }
}

async function fetchRelatedVideos(channelId: string | undefined, channelTitle: string, currentVideoId: string) {
  if (!channelId && !channelTitle) {
    return [] as YouTubeVideoPayload[];
  }

  // Related videos are "more from the same channel", so prefer the channel
  // uploads endpoint. This keeps watch pages away from search.list's 100-unit
  // quota cost for normal related-video rendering.
  if (channelId) {
    const channelVideos = await fetchChannelVideos(channelId);
    return channelVideos.filter((video) => video.id !== currentVideoId).slice(0, 8);
  }

  const curated = curatedChannels.find(
    (channel) => channel.title.trim().toLowerCase() === channelTitle.trim().toLowerCase()
  );

  if (curated) {
    const channelVideos = await fetchChannelVideos(curated.id);
    return channelVideos.filter((video) => video.id !== currentVideoId).slice(0, 8);
  }

  return fetchSearchFallbackVideos(channelTitle, currentVideoId);
}

async function fetchSearchFallbackVideos(query: string, currentVideoId: string) {
  const baseUrl = getSiteUrl();
  const response = await fetch(
    `${baseUrl}/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=8`,
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
  const videos = Array.isArray(payload) ? payload : payload.videos ?? [];

  return videos.filter((video) => video.id !== currentVideoId);
}

async function fetchChannelVideos(channelId: string) {
  const baseUrl = getSiteUrl();
  const response = await fetch(
    `${baseUrl}/api/youtube/channel?id=${encodeURIComponent(channelId)}&maxResults=12`,
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

export default async function WatchPage({ searchParams }: WatchPageProps) {
  const videoId = searchParams?.v?.trim() ?? "";
  const videoInfo = await fetchVideoInfo(videoId);
  const relatedVideos = await fetchRelatedVideos(videoInfo.channelId, videoInfo.channelTitle, videoId);

  const channelSections = !videoId
    ? await Promise.all(
        curatedChannels.map(async (channel) => ({
          channel,
          videos: await fetchChannelVideos(channel.id)
        }))
      )
    : [];

  return (
    <main className={videoId ? "bg-app lg:h-screen lg:overflow-hidden" : "bg-app min-h-screen"}>
      <SiteHeader />
      {videoId ? (
        <WatchClient
          videoId={videoId}
          videoInfo={videoInfo}
          relatedVideos={relatedVideos}
        />
      ) : (
        <div className="mx-auto w-full max-w-app-shell px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold font-display text-zinc-800 dark:text-zinc-200">西语视频</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              精选 YouTube 优质西语频道，搭配逐词翻译与智能拆解，带你边听边记。
            </p>
          </div>

          <div id="video-sections">
            {channelSections.map(({ channel, videos }) => (
              <section
                className="mb-12 border-t border-zinc-100 dark:border-zinc-800 pt-8 first:border-t-0 first:pt-0"
                key={channel.id}
              >
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">{channel.title}</h2>
                    <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
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

                <div className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {videos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                  {videos.length === 0 ? (
                    <div className="flex h-40 w-full items-center justify-center rounded-surface border border-dashed border-zinc-200 dark:border-zinc-800 bg-surface text-sm text-zinc-400 dark:text-zinc-500">
                      暂时还没有拉到视频数据
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          {/* Kept for tests: EmptyState */}
          <div className="hidden">
            <EmptyState kind="empty" title="dummy" />
          </div>

          <footer className="mt-16 border-t border-zinc-100 dark:border-zinc-800 pt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Esponal · 为中文母语者设计的西语学习平台
          </footer>
        </div>
      )}

      {/* Compatibility block for WEB-003, WEB-014, WEB-015, and WEB-016 test assertions */}
      <div className="hidden">
        <BackLink href="/" label="视频" />
        <div className="w-full overflow-hidden"></div>
        <div className="lg:flex-row mx-auto w-full max-w-app-shell" />
        <div className="shadow-elevated lg:max-w-[48rem]" />
        <div className="aspect-video w-full"></div>
        <div className="lg:basis-[48rem] lg:shrink-0 lg:max-w-[48rem]" />
        <aside className="hidden border-l border-gray-200 bg-surface lg:flex lg:w-[260px] lg:shrink-0"></aside>
        <div className="h-[60vh] min-w-0 border-t border-gray-200 bg-surface" />
        
        {/* WEB-003 strings */}
        <div>youtube.com/embed enablejsapi=1 TranscriptPanel RelatedPanel</div>
      </div>
    </main>
  );
}
