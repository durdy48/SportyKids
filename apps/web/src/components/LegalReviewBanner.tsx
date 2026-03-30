export function LegalReviewBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
      {children}
    </div>
  );
}
