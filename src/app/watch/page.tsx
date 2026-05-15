import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getSiteUrl } from "@/lib/site-url";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { RelatedPanel } from "./RelatedPanel";
import { TranscriptPanel } from "./TranscriptPanel";

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

async function fetchVideoInfo(videoId: string) {
  if (!videoId) {
    return {
      title: "未提供视频",
      channelTitle: "Esponal"
    };
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
      channelTitle: payload.author_name?.trim() || "YouTube Channel"
    };
  } catch (error) {
    console.warn("Watch page oEmbed failed", error);

    return {
      title: "YouTube 视频",
      channelTitle: "YouTube Channel"
    };
  }
}

async function fetchRelatedVideos(query: string, currentVideoId: string) {
  if (!query) {
    return [] as YouTubeVideoPayload[];
  }

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

export default async function WatchPage({ searchParams }: WatchPageProps) {
  const videoId = searchParams?.v?.trim() ?? "";
  const videoInfo = await fetchVideoInfo(videoId);
  const relatedVideos = await fetchRelatedVideos(videoInfo.channelTitle, videoId);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <SiteHeader />
      <div className="relative flex min-h-[calc(100vh-58px)] overflow-hidden pl-7">
        <section className="flex basis-[63%] flex-col justify-center overflow-y-auto py-8 pr-6">
          <div className="w-full overflow-hidden rounded-[14px] bg-black shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_20px_rgba(0,0,0,0.12)]">
            <div className="aspect-video w-full">
              {videoId ? (
                <iframe
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  className="h-full w-full border-0"
                  id={PLAYER_IFRAME_ID}
                  src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                  title={videoInfo.title}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/60">
                  缺少视频参数
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 px-0.5">
            <div className="mb-2 inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11.5px] font-semibold text-green-700">
              A1 入门级
            </div>
            <h1 className="line-clamp-2 text-[17px] font-semibold leading-7 text-gray-900">
              {videoInfo.title}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-green-600 to-sky-500 text-[10px] font-bold text-white">
                ES
              </div>
              <span>{videoInfo.channelTitle}</span>
            </div>
          </div>

          <div className="mt-5 px-0.5">
            <div className="mb-3 h-px bg-gray-200" />
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.5px] text-gray-500">
              章节
            </p>
            <div className="space-y-1">
              {MOCK_CHAPTERS.map((chapter) => (
                <div
                  className="flex items-center gap-3 rounded-md px-1 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
                  key={chapter.time}
                >
                  <span className="w-9 shrink-0 text-[11px] font-semibold text-gray-400">
                    {chapter.time}
                  </span>
                  <span>{chapter.title}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0 flex-1 border-l border-gray-200 bg-white">
          <TranscriptPanel iframeId={PLAYER_IFRAME_ID} videoId={videoId} />
        </section>

        <RelatedPanel relatedVideos={relatedVideos} />
      </div>
    </main>
  );
}
