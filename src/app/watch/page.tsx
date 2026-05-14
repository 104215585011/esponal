import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { authOptions } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { SubtitlePanel } from "./SubtitlePanel";
import { WatchSidebar } from "./WatchSidebar";

export const dynamic = "force-dynamic";

const PLAYER_IFRAME_ID = "esponal-youtube-player";

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
  const [session, videoInfo] = await Promise.all([
    getServerSession(authOptions),
    fetchVideoInfo(videoId)
  ]);
  const relatedVideos = await fetchRelatedVideos(videoInfo.channelTitle, videoId);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-4 py-6 md:flex-row">
        <section className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-t-xl bg-black">
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
            <SubtitlePanel iframeId={PLAYER_IFRAME_ID} videoId={videoId} />
          </div>

          <div className="mt-4">
            <h1 className="line-clamp-2 text-xl font-semibold text-gray-900">
              {videoInfo.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{videoInfo.channelTitle}</p>
          </div>
        </section>

        <WatchSidebar
          isLoggedIn={Boolean(session?.user)}
          relatedVideos={relatedVideos}
          savedWords={[]}
        />
      </div>
    </main>
  );
}
