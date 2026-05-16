import Link from "next/link";
import { buildVideoJumpHref } from "@/app/components/vocab/videoHref";
import type {
  ContinueCourseEncounter,
  ContinueVideoEncounter
} from "@/lib/continueLearning";

type ContinueLearningProps = {
  videoEncounter: ContinueVideoEncounter | null;
  courseEncounter: ContinueCourseEncounter | null;
  fallback?: boolean;
};

function formatTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function ContinueLearning({
  videoEncounter,
  courseEncounter,
  fallback = false
}: ContinueLearningProps) {
  if (!videoEncounter && !courseEncounter) {
    if (!fallback) {
      return null;
    }

    return (
      <section className="mb-10 rounded-hero bg-surface px-6 py-6 shadow-card sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          继续学习
        </p>
        <div className="mt-4 rounded-card border border-gray-100 p-5">
          <p className="text-base font-semibold text-gray-900">先从一个单元开始</p>
          <p className="mt-2 text-sm text-gray-500">
            暂时没有取到上次的位置，可以先回到课程总览。
          </p>
          <Link
            className="mt-4 inline-flex rounded-card bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            href="/learn"
          >
            开始学习
          </Link>
        </div>
      </section>
    );
  }

  const videoHref = videoEncounter
    ? buildVideoJumpHref(`/watch?v=${videoEncounter.videoId}`, videoEncounter.timestampSec)
    : "";

  return (
    <section className="mb-10 rounded-hero bg-surface px-6 py-6 shadow-card sm:px-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          继续学习
        </p>
        <Link className="text-sm font-medium text-brand-600 hover:underline" href="/learn">
          查看课程
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {videoEncounter ? (
          <Link
            className="group rounded-card border border-gray-100 p-3 transition hover:border-brand-300 hover:shadow-card"
            href={videoHref}
          >
            <div className="flex gap-4">
              <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-card bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={videoEncounter.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={videoEncounter.thumbnail}
                />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-base font-semibold text-gray-900">
                  {videoEncounter.title}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  上次看到 {formatTimestamp(videoEncounter.timestampSec)} ·{" "}
                  {videoEncounter.relativeTime}
                </p>
                <p className="mt-2 line-clamp-1 text-sm text-gray-400">
                  {videoEncounter.originalSentence}
                </p>
                <span className="mt-4 inline-flex rounded-card bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-brand-600">
                  继续观看
                </span>
              </div>
            </div>
          </Link>
        ) : null}

        {courseEncounter ? (
          <Link
            className="group rounded-card border border-gray-100 p-5 transition hover:border-brand-300 hover:shadow-card"
            href={`/learn/${courseEncounter.slug}`}
          >
            <div className="flex h-full gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-50 text-2xl">
                课
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900">{courseEncounter.title}</p>
                <p className="mt-2 text-sm text-gray-500">
                  上次学习 {courseEncounter.relativeTime}
                </p>
                <p className="mt-2 line-clamp-1 text-sm text-gray-400">
                  {courseEncounter.courseRef}
                </p>
                <span className="mt-4 inline-flex rounded-card bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-brand-600">
                  继续单元
                </span>
              </div>
            </div>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
