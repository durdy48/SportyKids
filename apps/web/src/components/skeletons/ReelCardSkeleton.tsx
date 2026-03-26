export function ReelCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
      {/* Video area */}
      <div className="skeleton aspect-video w-full rounded-none" />
      {/* Info area */}
      <div className="p-3 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <div className="skeleton h-3 w-1/4" />
          <div className="skeleton h-3 w-1/5" />
        </div>
      </div>
    </div>
  );
}
