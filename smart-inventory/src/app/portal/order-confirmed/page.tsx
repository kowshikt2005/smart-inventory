"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, ClipboardList } from "lucide-react";

/* ─── Confetti particle definitions ────────────────────────────────────── */
const PARTICLES: {
  color: string; w: number; h: number; round: boolean;
  tx: string; ty: string; rot: string; delay: string; dur: string;
}[] = [
  { color:"#F59E0B", w:9,  h:9,  round:true,  tx:"-138px", ty:"-170px", rot:"720deg",  delay:"0ms",  dur:"900ms" },
  { color:"#272462", w:6,  h:11, round:false, tx:"108px",  ty:"-190px", rot:"-540deg", delay:"35ms", dur:"860ms" },
  { color:"#10B981", w:10, h:10, round:true,  tx:"172px",  ty:"-110px", rot:"360deg",  delay:"15ms", dur:"950ms" },
  { color:"#F59E0B", w:5,  h:9,  round:false, tx:"195px",  ty:"55px",   rot:"900deg",  delay:"55ms", dur:"810ms" },
  { color:"#8B5CF6", w:8,  h:8,  round:true,  tx:"130px",  ty:"162px",  rot:"-720deg", delay:"8ms",  dur:"930ms" },
  { color:"#FBBF24", w:6,  h:10, round:false, tx:"-48px",  ty:"200px",  rot:"540deg",  delay:"48ms", dur:"875ms" },
  { color:"#10B981", w:9,  h:9,  round:true,  tx:"-162px", ty:"148px",  rot:"-360deg", delay:"28ms", dur:"980ms" },
  { color:"#F59E0B", w:5,  h:8,  round:false, tx:"-190px", ty:"28px",   rot:"630deg",  delay:"68ms", dur:"825ms" },
  { color:"#272462", w:10, h:10, round:true,  tx:"-95px",  ty:"-152px", rot:"-810deg", delay:"12ms", dur:"915ms" },
  { color:"#FCD34D", w:5,  h:9,  round:false, tx:"52px",   ty:"-210px", rot:"450deg",  delay:"42ms", dur:"845ms" },
  { color:"#8B5CF6", w:7,  h:7,  round:true,  tx:"210px",  ty:"-45px",  rot:"-630deg", delay:"22ms", dur:"965ms" },
  { color:"#10B981", w:5,  h:9,  round:false, tx:"88px",   ty:"210px",  rot:"720deg",  delay:"52ms", dur:"885ms" },
  { color:"#F59E0B", w:8,  h:8,  round:true,  tx:"-210px", ty:"-65px",  rot:"540deg",  delay:"32ms", dur:"935ms" },
  { color:"#FBBF24", w:7,  h:12, round:false, tx:"150px",  ty:"-162px", rot:"-900deg", delay:"62ms", dur:"870ms" },
  { color:"#272462", w:6,  h:6,  round:true,  tx:"-68px",  ty:"215px",  rot:"810deg",  delay:"5ms",  dur:"945ms" },
  { color:"#F59E0B", w:8,  h:13, round:false, tx:"32px",   ty:"225px",  rot:"-450deg", delay:"75ms", dur:"815ms" },
  { color:"#10B981", w:6,  h:6,  round:true,  tx:"-225px", ty:"-20px",  rot:"270deg",  delay:"18ms", dur:"905ms" },
  { color:"#8B5CF6", w:5,  h:8,  round:false, tx:"225px",  ty:"20px",   rot:"-270deg", delay:"58ms", dur:"855ms" },
];

/* ─── Counting hook ──────────────────────────────────────────────────────── */
function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4); }

function useCountUp(target: number, duration = 1300, startDelay = 1000) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const t = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / duration, 1);
        setValue(target * easeOutQuart(p));
        if (p < 1) raf.current = requestAnimationFrame(tick);
        else setValue(target);
      };
      raf.current = requestAnimationFrame(tick);
    }, startDelay);
    return () => { clearTimeout(t); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, startDelay]);

  return value;
}

/* ─── Main content ──────────────────────────────────────────────────────── */
function OrderConfirmedContent() {
  const searchParams = useSearchParams();
  const orderNumber  = searchParams.get("orderNumber") || "—";
  const totalRaw     = searchParams.get("total");
  const totalNum     = totalRaw ? Number(totalRaw) : 0;

  const counted = useCountUp(totalNum, 1300, 1050);

  const fmtINR = (n: number) =>
    n.toLocaleString("en-IN", { style:"currency", currency:"INR", minimumFractionDigits:2, maximumFractionDigits:2 });

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16 relative overflow-hidden">

      {/* ── Keyframes ────────────────────────────────────────────────── */}
      <style>{`
        /* confetti */
        @keyframes cfly {
          0%   { transform:translate(0,0) rotate(0deg) scale(1);   opacity:1; }
          75%  { opacity:.9; }
          100% { transform:translate(var(--tx),var(--ty)) rotate(var(--rot)) scale(.15); opacity:0; }
        }
        .cp {
          position:absolute; top:50%; left:50%;
          animation:cfly var(--dur) cubic-bezier(0.22,1,0.36,1) var(--delay) both;
          pointer-events:none; z-index:30;
        }

        /* icon pop — spring without bounce easing */
        @keyframes oc-pop {
          0%   { transform:scale(.25);  opacity:0; }
          55%  { transform:scale(1.1);  opacity:1; }
          75%  { transform:scale(.96);  }
          90%  { transform:scale(1.02); }
          100% { transform:scale(1);    opacity:1; }
        }
        /* ambient float after settled */
        @keyframes oc-float {
          0%,100% { transform:translateY(0);   }
          50%      { transform:translateY(-7px); }
        }
        /* burst ring expands and fades */
        @keyframes oc-burst {
          0%   { transform:scale(.6); opacity:.7; }
          100% { transform:scale(2);  opacity:0;  }
        }
        /* slow ambient ring pulse */
        @keyframes oc-pulse {
          0%,100% { transform:scale(1);    opacity:.22; }
          50%      { transform:scale(1.2);  opacity:.07; }
        }
        /* checkmark draw */
        @keyframes oc-draw {
          to { stroke-dashoffset:0; }
        }
        /* success flash — white overlay brightens then fades */
        @keyframes oc-flash {
          0%   { opacity:0; }
          35%  { opacity:.55; }
          100% { opacity:0; }
        }
        /* shimmer sweep on disc */
        @keyframes oc-shimmer {
          0%   { background-position:-220% 0; }
          100% { background-position: 220% 0; }
        }
        /* headline / copy */
        @keyframes oc-up {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        /* card snap in */
        @keyframes oc-card {
          0%   { opacity:0; transform:translateY(36px) scale(.96); }
          55%  { transform:translateY(-5px) scale(1.008); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }

        /* assignments */
        .oc-pop    { animation:oc-pop    .65s cubic-bezier(0.22,1,0.36,1) .12s both; }
        .oc-float  { animation:oc-float  3.8s ease-in-out 1.1s infinite; }
        .oc-burst  { animation:oc-burst  .9s  cubic-bezier(0.22,1,0.36,1) .5s  both; }
        .oc-pulse  { animation:oc-pulse  3.2s ease-in-out infinite; }
        .oc-check  {
          stroke-dasharray:104; stroke-dashoffset:104;
          animation:oc-draw .5s cubic-bezier(0.22,1,0.36,1) .68s forwards;
        }
        .oc-flash  { animation:oc-flash .55s ease-out 1.15s both; }
        .oc-shine  {
          background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.22) 50%,transparent 100%);
          background-size:220% 100%;
          animation:oc-shimmer 2.8s ease-in-out 1.5s infinite;
        }
        .oc-up-1   { animation:oc-up  .5s cubic-bezier(0.22,1,0.36,1) .84s both; }
        .oc-up-2   { animation:oc-up  .5s cubic-bezier(0.22,1,0.36,1) .98s both; }
        .oc-card   { animation:oc-card .6s cubic-bezier(0.22,1,0.36,1) 1.1s both; }
        .oc-up-3   { animation:oc-up  .5s cubic-bezier(0.22,1,0.36,1) 1.28s both; }

        /* accessibility — instant/off for reduce-motion users */
        @media (prefers-reduced-motion:reduce) {
          .cp,.oc-pop,.oc-float,.oc-burst,.oc-pulse,.oc-flash,.oc-shine,
          .oc-up-1,.oc-up-2,.oc-card,.oc-up-3 {
            animation:none!important; opacity:1!important; transform:none!important;
          }
          .oc-check { animation:none!important; stroke-dashoffset:0!important; }
        }
      `}</style>

      {/* ── Confetti ─────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
           style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="cp"
            style={{
              "--tx": p.tx, "--ty": p.ty, "--rot": p.rot,
              "--delay": p.delay, "--dur": p.dur,
              width: `${p.w}px`,
              height: `${p.h}px`,
              marginTop:  `-${p.h / 2}px`,
              marginLeft: `-${p.w / 2}px`,
              borderRadius: p.round ? "50%" : "2px",
              backgroundColor: p.color,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="w-full max-w-sm text-center relative z-10">

        {/* Icon cluster */}
        <div className="relative flex items-center justify-center mb-10" style={{ height:"128px" }}>

          {/* slow ambient ring */}
          <div className="oc-pulse absolute w-44 h-44 rounded-full border border-amber-400/35" />

          {/* burst ring (one-shot expand on mount) */}
          <div className="oc-burst absolute w-28 h-28 rounded-full border-2 border-amber-500/50" />

          {/* disc: pop in, then float */}
          <div className="oc-pop absolute w-24 h-24">
            <div className="oc-float w-full h-full">
              <svg viewBox="0 0 96 96" fill="none" className="w-full h-full"
                   style={{ filter:"drop-shadow(0 12px 28px rgba(39,36,98,.4))" }}>
                <circle cx="48" cy="48" r="48" fill="#272462" />
                {/* amber dashed arc */}
                <circle cx="48" cy="48" r="44"
                        stroke="#F59E0B" strokeWidth="2.5"
                        strokeDasharray="64 214" strokeLinecap="round"
                        fill="none" transform="rotate(-90 48 48)" />
                {/* checkmark — draws itself */}
                <path className="oc-check"
                      d="M27 49 L42 64 L69 33"
                      stroke="white" strokeWidth="5.5"
                      strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>

              {/* white flash exactly when check finishes drawing */}
              <div className="oc-flash absolute inset-0 rounded-full bg-white pointer-events-none" />

              {/* shimmer sweep (idle) */}
              <div className="oc-shine absolute inset-0 rounded-full pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="oc-up-1">
          <p className="text-[10px] uppercase tracking-[.24em] font-bold text-amber-500 mb-2">
            Order Confirmed
          </p>
          <h1 className="text-[2rem] font-extrabold text-gray-900 leading-tight mb-2">
            You&rsquo;re all set!
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            We&rsquo;ve received your order.<br />
            Your sales representative will be in touch shortly.
          </p>
        </div>

        {/* Receipt card */}
        <div className="oc-card mt-8 rounded-2xl overflow-hidden border border-gray-100 shadow-lg">
          <div className="bg-[#272462] px-6 py-4 text-left">
            <p className="text-[10px] uppercase tracking-[.2em] text-white/40 font-semibold mb-1">
              Order Number
            </p>
            <p className="text-lg font-bold text-white tracking-wider font-mono">
              {orderNumber}
            </p>
          </div>

          {totalNum > 0 && (
            <div className="bg-white px-6 py-5 flex items-center justify-between">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                Order Total
              </p>
              {/* animated counter — starts at 0, counts to real value */}
              <p className="text-xl font-extrabold text-amber-500 tabular-nums"
                 aria-label={fmtINR(totalNum)}>
                {fmtINR(counted)}
              </p>
            </div>
          )}

          <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <p className="text-xs text-gray-500 font-medium">Processing your order</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="oc-up-3 mt-6 flex flex-col gap-2.5">
          <Link
            href="/portal/orders"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#272462] hover:bg-[#1E1B4B] active:scale-[.97] text-white font-bold rounded-xl text-sm transition-all duration-150"
          >
            <ClipboardList className="h-4 w-4" />
            View My Orders
          </Link>
          <Link
            href="/portal/shop"
            className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 hover:bg-gray-50 active:scale-[.97] text-gray-600 font-medium rounded-xl text-sm transition-all duration-150"
          >
            <ShoppingBag className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmedPage() {
  return (
    <Suspense>
      <OrderConfirmedContent />
    </Suspense>
  );
}
