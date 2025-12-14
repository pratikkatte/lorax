import React, { useState, useEffect } from "react";

// Simple SVG placeholder illustrating ARG edges + genome band
function ARGIillustrationInner() {
  return (
    <svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" className="w-full h-[300px]">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopOpacity="0.08" />
          <stop offset="100%" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="360" fill="url(#g)" />
      {/* genome band */}
      <rect x="40" y="300" width="560" height="10" rx="5" fill="#10b981" opacity="0.3" />
      {/* local trees (stylized) */}
      {[
        { x: 70 },
        { x: 200 },
        { x: 330 },
        { x: 460 },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x},0)`}>
          <path d="M40 280 L80 220 L120 280" stroke="#0ea5e9" strokeWidth="2" fill="none" />
          <path d="M80 220 L60 160" stroke="#0ea5e9" strokeWidth="2" fill="none" />
          <path d="M80 220 L100 170" stroke="#0ea5e9" strokeWidth="2" fill="none" />
          {/* recombination arcs */}
          <path d="M60 160 C 100 120, 120 120, 100 170" stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

function ARGIillustrationSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-slate-100 h-[300px] w-full" />
  );
}

function ARGIillustrationWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
    };
  }, []); // run only once after mount

  if (!mounted) return <ARGIillustrationSkeleton />;
  return <ARGIillustrationInner />;
}

export default function ARGIllustration() { return <ARGIillustrationWrapper />; }
