export function QuizSkeleton() {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center py-8 space-y-6">
      {/* Emoji circle */}
      <div className="skeleton w-20 h-20 rounded-full" />
      {/* Title */}
      <div className="skeleton h-6 w-1/2" />
      {/* Subtitle */}
      <div className="skeleton h-4 w-1/3" />
      {/* Score box */}
      <div className="skeleton h-24 w-full rounded-2xl" />
      {/* Button */}
      <div className="skeleton h-12 w-40 rounded-2xl" />
    </div>
  );
}
