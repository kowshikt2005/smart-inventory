"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { motion } from "motion/react";

const PARTICLE_POSITIONS = [
  { x: 8, y: 12, duration: 5, delay: 0.2 },
  { x: 22, y: 68, duration: 4.5, delay: 1.1 },
  { x: 35, y: 25, duration: 6, delay: 0.5 },
  { x: 48, y: 82, duration: 3.8, delay: 1.8 },
  { x: 62, y: 45, duration: 5.5, delay: 0.3 },
  { x: 75, y: 18, duration: 4, delay: 1.4 },
  { x: 88, y: 55, duration: 6.5, delay: 0.8 },
  { x: 15, y: 90, duration: 4.2, delay: 1.6 },
  { x: 42, y: 35, duration: 5.8, delay: 0.1 },
  { x: 55, y: 72, duration: 3.5, delay: 1.2 },
  { x: 70, y: 8, duration: 4.8, delay: 0.6 },
  { x: 30, y: 58, duration: 5.2, delay: 1.9 },
  { x: 82, y: 38, duration: 6.2, delay: 0.4 },
  { x: 18, y: 48, duration: 4.6, delay: 1.0 },
  { x: 95, y: 78, duration: 5.4, delay: 0.7 },
];

export function AnimatedGridBackground({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 relative overflow-hidden",
        className
      )}
    >
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-0 -left-40 w-80 h-80 bg-indigo-200/40 rounded-full blur-3xl"
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl"
        animate={{
          x: [0, -80, 0],
          y: [0, -60, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-20 left-1/3 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl"
        animate={{
          x: [0, 60, 0],
          y: [0, -40, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(100, 116, 139, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(100, 116, 139, 0.06) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Floating particles — deterministic positions to avoid hydration mismatch */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {PARTICLE_POSITIONS.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-indigo-400/50 rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
