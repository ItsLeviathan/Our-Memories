/** Quiet skeleton while a private page loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className="h-4 w-28 rounded-full bg-surface-2" />
      <div className="mt-5 h-14 w-80 max-w-full rounded-2xl bg-surface-2 sm:h-16" />
      <div className="mt-5 h-5 w-56 rounded-full bg-surface-2" />
      <div className="mt-14 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[4/3] rounded-xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
