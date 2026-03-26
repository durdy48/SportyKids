export function StickerCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border-3 border-[var(--color-border)]">
      {/* Square image area */}
      <div className="skeleton aspect-square w-full rounded-none" />
      {/* Info area */}
      <div className="p-2 bg-[var(--color-surface)] space-y-2">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-1/3" />
      </div>
    </div>
  );
}
