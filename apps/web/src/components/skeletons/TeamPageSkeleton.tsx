import { NewsCardSkeleton } from './NewsCardSkeleton';

export function TeamPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats card placeholder */}
      <div className="skeleton h-32 w-full rounded-2xl" />
      {/* Reels strip placeholder */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-36 shrink-0 rounded-xl" />
        ))}
      </div>
      {/* News section title */}
      <div className="skeleton h-5 w-32" />
      {/* News grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <NewsCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
