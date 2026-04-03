"use client";

// Only renders when NEXT_PUBLIC_APP_ENV === 'development'
// Fixed bottom-left badge showing DEV + branch name with pulsing dot

export default function DevBadge() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "development") {
    return null;
  }

  const branch = "dev";

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 rounded-md border border-amber-500/30 bg-neutral-950/80 px-3 py-1.5 shadow-lg backdrop-blur-sm select-none"
    >
      {/* Pulsing indicator dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
      </span>

      {/* DEV label */}
      <span className="font-mono text-xs font-bold tracking-widest text-amber-400">
        DEV
      </span>

      {/* Divider */}
      <span className="h-3 w-px bg-amber-500/40" />

      {/* Git branch icon + branch name */}
      <span className="flex items-center gap-1">
        {/* Inline SVG git-branch icon — no external libs */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-500/70"
          aria-hidden="true"
        >
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
        <span className="font-mono text-xs text-amber-300/80">{branch}</span>
      </span>
    </div>
  );
}
