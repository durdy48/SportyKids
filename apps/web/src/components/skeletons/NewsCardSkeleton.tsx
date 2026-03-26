export function NewsCardSkeleton() {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden border border-[var(--color-border)]">
      {/* Image placeholder */}
      <div className="skeleton h-44 w-full rounded-none" />

      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="skeleton h-5 w-3/4" />
        {/* Summary lines */}
        <div className="space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-2/3" />
        </div>
        {/* Footer: source + date */}
        <div className="flex items-center gap-3">
          <div className="skeleton h-3 w-1/4" />
          <div className="skeleton h-3 w-1/5" />
        </div>
        {/* Button placeholder */}
        <div className="skeleton h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
