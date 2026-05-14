import Link from "next/link";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { VideoCard } from "@/app/components/web/VideoCard";
import { curatedChannels } from "@/lib/channels";
import { getSiteUrl } from "@/lib/site-url";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";

export const dynamic = "force-dynamic";

const channelDescriptions: Record<string, string> = {
  "Dreaming Spanish": "推荐入门，语速慢，适合建立可理解输入。",
  "Extra Spanish": "轻松情景剧，适合跟着语境反复吸收表达。",
  "Español con Juan": "偏讲解型频道，适合把输入和语法串起来。"
};

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

export default async function HomePage() {
  const channelSections = await Promise.all(
    curatedChannels.map(async (channel) => ({
      channel,
      videos: await fetchChannelVideos(channel.id)
    }))
  );

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <SiteHeader />
      <div className="mx-auto w-full max-w-screen-xl px-4 pb-12 pt-6">
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
                className="shrink-0 text-sm text-emerald-600 hover:underline"
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
                <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white text-sm text-gray-400">
                  暂时还没有拉到视频数据
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
