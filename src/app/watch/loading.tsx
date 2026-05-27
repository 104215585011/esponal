import { SiteHeader } from "@/app/components/web/SiteHeader";
import Skeleton from "@/app/components/ui/Skeleton";

export default function WatchLoading() {
  return (
    <main className="bg-app min-h-screen">
      <SiteHeader />
      <div className="mx-auto w-full max-w-app-shell px-4 py-12 sm:px-6 lg:px-8">
        {/* Header Title Skeleton */}
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Channels Skeletons */}
        <div className="space-y-12">
          {[1, 2, 3].map((row) => (
            <section key={row} className="border-t border-zinc-100 dark:border-zinc-800 pt-8 first:border-t-0 first:pt-0">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>

              {/* Horizontal Scroll Cards Skeletons */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3, 4].map((card) => (
                  <div key={card} className="w-[280px] shrink-0 space-y-3">
                    <Skeleton className="aspect-video w-full rounded-surface" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
