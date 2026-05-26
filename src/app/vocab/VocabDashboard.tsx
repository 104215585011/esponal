import type { VocabStats } from "@/lib/vocab";

type VocabDashboardProps = {
  stats: VocabStats;
};

const getRepeatLearnerCount = (stats: VocabStats) =>
  stats.encounterBuckets
    .filter((bucket) => bucket.min >= 3)
    .reduce((sum, bucket) => sum + bucket.count, 0);

export default function VocabDashboard({ stats }: VocabDashboardProps) {
  const repeatLearnerCount = getRepeatLearnerCount(stats);
  const maxBucketCount = Math.max(...stats.encounterBuckets.map((bucket) => bucket.count), 1);

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-card border border-gray-100 bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.totalSaved}</p>
          <p className="mt-1 text-xs text-gray-500">已收藏</p>
        </div>
        <div className="rounded-card border border-gray-100 bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{repeatLearnerCount}</p>
          <p className="mt-1 text-xs text-gray-500">遇到 3+ 次</p>
        </div>
        <div className="rounded-card border border-gray-100 bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.weeklyNew}</p>
          <p className="mt-1 text-xs text-gray-500">本周新增</p>
        </div>
      </div>

      <div className="space-y-3">
        {stats.encounterBuckets.map((bucket) => (
          <div className="flex items-center gap-3" key={bucket.label}>
            <span className="w-20 shrink-0 text-sm text-gray-500">{bucket.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-brand-100">
              <div
                className="h-1.5 rounded-full bg-brand-500"
                style={{ width: `${(bucket.count / maxBucketCount) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm text-gray-500">{bucket.count}</span>
          </div>
        ))}
      </div>

      {stats.bySource.length > 0 ? (
        <p className="mt-5 text-sm text-gray-500">
          {stats.bySource.map((source, index) => (
            <span key={source.type}>
              {index > 0 ? <span className="mx-2 text-gray-300">·</span> : null}
              {source.label} {source.count}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
