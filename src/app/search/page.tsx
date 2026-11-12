import Link from "next/link";
import EmptyState from "@/app/components/ui/EmptyState";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { VideoCard } from "@/app/components/web/VideoCard";
import { getSiteUrl } from "@/lib/site-url";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { normalizeSearchOrder, normalizeRegionCode } from "@/lib/youtube-search-params";

export const dynamic = "force-dynamic";

type SearchQuery = {
  q: string;
  order: string;
  region: string;
  page: string;
  fresh: string;
};

type SearchPageProps = {
  searchParams?: Partial<SearchQuery>;
};

type SearchMeta = {
  stale: boolean;
  fromCache: boolean;
  fetchedAt: number;
  order: string;
  region: string;
  cacheTtlSeconds: number;
};

type SearchResult = {
  videos: YouTubeVideoPayload[];
  nextPageToken: string;
  prevPageToken: string;
  meta?: SearchMeta;
  error?: "quota_exceeded" | "rate_limited" | "upstream";
};

const ORDER_LABELS = [
  { value: "relevance", label: "相关度" },
  { value: "date", label: "最新" },
  { value: "viewCount", label: "播放量" },
  { value: "rating", label: "评分" }
];

const REGION_LABELS = [
  { value: "", label: "默认地区" },
  { value: "ES", label: "西班牙" },
  { value: "MX", label: "墨西哥" },
  { value: "US", label: "美国" }
];

function buildApiUrl(baseUrl: string, query: SearchQuery) {
  const params = new URLSearchParams({
    q: query.q,
    maxResults: "20"
  });

  if (query.order && query.order !== "relevance") {
    params.set("order", query.order);
  }
  if (query.region) {
    params.set("region", query.region);
  }
  if (query.page) {
    params.set("page", query.page);
  }
  if (query.fresh) {
    params.set("fresh", query.fresh);
  }

  return `${baseUrl}/api/youtube/search?${params.toString()}`;
}

async function fetchSearchVideos(query: SearchQuery): Promise<SearchResult> {
  const empty: SearchResult = {
    videos: [],
    nextPageToken: "",
    prevPageToken: ""
  };

  if (!query.q) {
    return empty;
  }

  let response: Response;

  try {
    response = await fetch(buildApiUrl(getSiteUrl(), query), {
      cache: "no-store"
    });
  } catch {
    return { ...empty, error: "upstream" };
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    const error =
      payload.error === "quota_exceeded"
        ? "quota_exceeded"
        : payload.error === "rate_limited"
          ? "rate_limited"
          : "upstream";

    return { ...empty, error };
  }

  const payload = (await response.json().catch(() => null)) as
    | YouTubeVideoPayload[]
    | {
        videos?: YouTubeVideoPayload[];
        nextPageToken?: string;
        prevPageToken?: string;
        meta?: SearchMeta;
      }
    | null;

  // Older deployments still return a bare array.
  if (Array.isArray(payload)) {
    return { ...empty, videos: payload };
  }

  return {
    videos: Array.isArray(payload?.videos) ? payload.videos : [],
    nextPageToken: payload?.nextPageToken ?? "",
    prevPageToken: payload?.prevPageToken ?? "",
    meta: payload?.meta
  };
}

function searchHref(
  query: SearchQuery,
  overrides: Partial<SearchQuery> = {}
) {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams({ q: merged.q });

  if (merged.order && merged.order !== "relevance") {
    params.set("order", merged.order);
  }
  if (merged.region) {
    params.set("region", merged.region);
  }
  if (merged.page) {
    params.set("page", merged.page);
  }
  if (merged.fresh) {
    params.set("fresh", merged.fresh);
  }

  return `/search?${params.toString()}`;
}

function describeFetchedAt(timestamp: number) {
  if (!timestamp) {
    return "未知";
  }

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));

  if (minutes < 1) {
    return "刚刚";
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }

  const hours = Math.round(minutes / 60);

  return hours < 48 ? `${hours} 小时前` : `${Math.round(hours / 24)} 天前`;
}

function ErrorState({ error }: { error: NonNullable<SearchResult["error"]> }) {
  const copy = {
    quota_exceeded: {
      title: "今日搜索配额已用完",
      description:
        "YouTube 搜索接口每天有调用上限。稍后再试，或使用排序 / 地区切换查看已缓存的关键词。"
    },
    rate_limited: {
      title: "搜索太频繁了",
      description: "请稍等片刻再试。这个限制是为了保护每日搜索配额。"
    },
    upstream: {
      title: "搜索服务暂时不可用",
      description:
        "连接 YouTube 时出错，不是没有匹配结果。请稍后重试或换个关键词。"
    }
  }[error];

  return (
    <EmptyState
      action={{ href: "/watch", label: "浏览推荐频道" }}
      description={copy.description}
      kind="error"
      title={copy.title}
    />
  );
}

function FilterLink({
  active,
  children,
  href
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white text-zinc-600 hover:bg-zinc-100"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query: SearchQuery = {
    q: searchParams?.q?.trim() ?? "",
    order: normalizeSearchOrder(searchParams?.order),
    region: normalizeRegionCode(searchParams?.region),
    page: (searchParams?.page ?? "").trim(),
    fresh: (searchParams?.fresh ?? "").trim()
  };

  const result = await fetchSearchVideos(query);
  const canRefresh = process.env.NODE_ENV !== "production";

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader initialQuery={query.q} />
      <div className="mx-auto w-full max-w-screen-xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm text-gray-400">搜索结果</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            {query.q || "输入一个西语关键词开始搜索"}
          </h1>
        </div>

        {query.q ? (
          <div className="mb-6 space-y-3 rounded-2xl border border-zinc-200/70 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-zinc-400">排序</span>
              {ORDER_LABELS.map((item) => (
                <FilterLink
                  active={query.order === item.value}
                  href={searchHref(query, { order: item.value, page: "", fresh: "" })}
                  key={item.value}
                >
                  {item.label}
                </FilterLink>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-zinc-400">地区</span>
              {REGION_LABELS.map((item) => (
                <FilterLink
                  active={query.region === item.value}
                  href={searchHref(query, { region: item.value, page: "", fresh: "" })}
                  key={item.value || "default"}
                >
                  {item.label}
                </FilterLink>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
              <span>
                {result.videos.length} 个视频
                {result.meta?.fetchedAt
                  ? ` · 结果更新于${describeFetchedAt(result.meta.fetchedAt)}`
                  : ""}
                {result.meta?.stale ? " · 上游调用失败，当前为缓存的旧结果" : ""}
              </span>
              {canRefresh ? (
                <Link
                  className="font-medium text-brand-600 hover:underline"
                  href={searchHref(query, { fresh: "1" })}
                >
                  跳过缓存刷新（仅本地可用）
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {result.error ? (
          <ErrorState error={result.error} />
        ) : result.videos.length === 0 ? (
          <EmptyState
            action={{ href: "/", label: "浏览频道" }}
            description="试试别的关键词或浏览推荐频道"
            kind="empty"
            title="没找到相关视频"
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {result.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}

        {!result.error && (result.prevPageToken || result.nextPageToken || query.page) ? (
          <div className="mt-8 flex items-center justify-between gap-3">
            {result.prevPageToken ? (
              <Link
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                href={searchHref(query, { page: result.prevPageToken, fresh: "" })}
              >
                ← 上一页
              </Link>
            ) : query.page ? (
              <Link
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                href={searchHref(query, { page: "", fresh: "" })}
              >
                ← 返回第一页
              </Link>
            ) : (
              <span />
            )}
            {result.nextPageToken ? (
              <Link
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                href={searchHref(query, { page: result.nextPageToken, fresh: "" })}
              >
                下一页 →
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8">
          <Link className="text-sm text-brand-600 hover:underline" href="/">
            ← 返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
