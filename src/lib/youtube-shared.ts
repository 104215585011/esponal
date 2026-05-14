export type YouTubeVideoPayload = {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
  publishedAt: string;
};

export function formatVideoDurationBadge(duration: string) {
  const hours = Number.parseInt(duration.match(/(\d+)H/)?.[1] ?? "0", 10);
  const minutes = Number.parseInt(duration.match(/(\d+)M/)?.[1] ?? "0", 10);
  const seconds = Number.parseInt(duration.match(/(\d+)S/)?.[1] ?? "0", 10);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
