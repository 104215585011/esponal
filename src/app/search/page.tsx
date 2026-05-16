import Link from "next/link";
import EmptyState from "@/app/components/ui/EmptyState";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { VideoCard } from "@/app/components/web/VideoCard";
import { getSiteUrl } from "@/lib/site-url";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams?: {
    q?: string;
  };
};

async function fetchSearchVideos(query: string) {
  if (!query) {
    return [] as YouTubeVideoPayload[];
  }

  const baseUrl = getSiteUrl();
  const response = await fetch(
    `${baseUrl}/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=20`,
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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams?.q?.trim() ?? "";
  const videos = await fetchSearchVideos(query);

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader initialQuery={query} />
      <div className="mx-auto w-full max-w-screen-xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm text-gray-400">搜索结果</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            {query || "输入一个西语关键词开始搜索"}
          </h1>
        </div>

        {videos.length === 0 ? (
          <EmptyState
            action={{ href: "/", label: "浏览频道" }}
            description="试试别的关键词或浏览推荐频道"
            kind="empty"
            title="没找到相关视频"
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link className="text-sm text-brand-600 hover:underline" href="/">
            ← 返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
