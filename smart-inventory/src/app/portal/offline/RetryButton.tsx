'use client';

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-2 px-6 py-2.5 rounded-lg bg-amber-400 text-[#1A1740] text-sm font-semibold hover:bg-amber-300 active:scale-95 transition-all"
    >
      Try Again
    </button>
  );
}
