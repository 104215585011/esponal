"use client";

type SkeletonProps = {
  className?: string;
};

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded-card bg-zinc-200/40 dark:bg-zinc-800/40 ${className}`}
      data-testid="skeleton-loader"
    />
  );
}
