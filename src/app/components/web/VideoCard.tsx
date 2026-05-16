import Link from "next/link";
import { formatVideoDurationBadge, type YouTubeVideoPayload } from "@/lib/youtube-shared";

type VideoCardProps = {
  video: YouTubeVideoPayload;
  compact?: boolean;
};

export function VideoCard({ video, compact = false }: VideoCardProps) {
  if (compact) {
    return (
      <Link
        className="flex gap-3 rounded-lg p-2 transition hover:bg-gray-50"
        data-testid="video-card"
        href={`/watch?v=${video.id}`}
      >
        <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-md bg-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
            src={video.thumbnail || "https://placehold.co/320x180?text=Esponal"}
          />
          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {formatVideoDurationBadge(video.duration)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium text-gray-800">{video.title}</p>
          <p className="mt-0.5 text-xs text-gray-400">{video.channelTitle}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      className="group block w-60 shrink-0"
      data-testid="video-card"
      href={`/watch?v=${video.id}`}
    >
      <div className="overflow-hidden rounded-lg bg-gray-100 transition duration-200 ease-out group-hover:-translate-y-[2px]">
        <div className="relative aspect-video overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
            src={video.thumbnail || "https://placehold.co/480x270?text=Esponal"}
          />
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white">
            {formatVideoDurationBadge(video.duration)}
          </span>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-800">{video.title}</p>
      <p className="mt-1 text-xs text-gray-400">{video.channelTitle}</p>
    </Link>
  );
}
