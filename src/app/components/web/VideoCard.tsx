// Timestamp: 2026-11-17 16:22
import Link from "next/link";
import { formatVideoDurationBadge, type YouTubeVideoPayload } from "@/lib/youtube-shared";

type VideoCardProps = {
  video: YouTubeVideoPayload;
  compact?: boolean;
  fullWidth?: boolean;
};

const LEVEL_BADGE_STYLE: Record<string, string> = {
  A1: "bg-emerald-500/90 text-white",
  A2: "bg-sky-500/90 text-white",
  B1: "bg-amber-500/90 text-white"
};

export function VideoCard({ video, compact = false, fullWidth = false }: VideoCardProps) {
  const href =
    video.language && video.language !== "es"
      ? `/watch?v=${video.id}&lang=${video.language}`
      : `/watch?v=${video.id}`;
  const levelClass = video.level ? (LEVEL_BADGE_STYLE[video.level] ?? "bg-zinc-900/80 text-white") : "";

  if (compact) {
    return (
      <Link
        className="flex gap-3 rounded-lg p-2 transition hover:bg-gray-50 dark:hover:bg-zinc-800/60"
        data-testid="video-card"
        href={href}
      >
        <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
            src={video.thumbnail || "https://placehold.co/320x180?text=LinguaMind"}
          />
          {video.level ? (
            <span className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${levelClass}`}>
              {video.level}
            </span>
          ) : null}
          {video.duration ? (
            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {formatVideoDurationBadge(video.duration)}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium text-gray-800 dark:text-zinc-100">
            {video.title}
          </p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-zinc-400">{video.channelTitle}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      className={fullWidth ? "group block w-full" : "group block w-60 shrink-0"}
      data-testid="video-card"
      href={href}
    >
      <div className="overflow-hidden rounded-lg bg-gray-100 transition duration-200 ease-out group-hover:-translate-y-[2px] dark:bg-zinc-800">
        <div className="relative aspect-video overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
            src={video.thumbnail || "https://placehold.co/480x270?text=LinguaMind"}
          />
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
          {video.level ? (
            <span
              className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-bold shadow-sm ${levelClass}`}
            >
              {video.level}
            </span>
          ) : null}
          {video.duration ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white">
              {formatVideoDurationBadge(video.duration)}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-800 dark:text-zinc-100">
        {video.title}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-400">
        <span className="truncate">{video.channelTitle}</span>
        {video.topic ? (
          <>
            <span>·</span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {video.topic}
            </span>
          </>
        ) : null}
      </div>
    </Link>
  );
}
