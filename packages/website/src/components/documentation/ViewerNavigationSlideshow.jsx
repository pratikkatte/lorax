import React, { useCallback, useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

/**
 * @param {{ animation?: { type: string; label: string } }} props
 */
function DescriptionAnimation({ animation }) {
  if (!animation) {
    return null;
  }

  if (animation.type === "pan-x") {
    return (
      <div className="mt-3 w-full max-w-[260px] rounded-lg border border-slate-200 bg-white p-2">
        <svg
          className="viewer-doc-gesture-animation"
          viewBox="0 0 220 64"
          role="img"
          aria-label={animation.label}
        >
          <path d="M32 32H188" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
          <path
            d="M32 32L48 20M32 32L48 44"
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M188 32L172 20M188 32L172 44"
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g className="viewer-doc-pan-dot">
            <circle cx="110" cy="32" r="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="106" cy="28" r="4" fill="#ffffff" opacity="0.9" />
          </g>
        </svg>
      </div>
    );
  }

  if (animation.type === "scroll-y") {
    return (
      <div className="mt-3 w-full max-w-[260px] rounded-lg border border-slate-200 bg-white p-2">
        <svg
          className="viewer-doc-gesture-animation"
          viewBox="0 0 220 64"
          role="img"
          aria-label={animation.label}
        >
          <path d="M110 12V52" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
          <path
            d="M110 12L98 26M110 12L122 26"
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M110 52L98 38M110 52L122 38"
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g className="viewer-doc-scroll-dots">
            <circle cx="88" cy="32" r="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="132" cy="32" r="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="84" cy="28" r="3.5" fill="#ffffff" opacity="0.9" />
            <circle cx="128" cy="28" r="3.5" fill="#ffffff" opacity="0.9" />
          </g>
        </svg>
      </div>
    );
  }

  if (animation.type === "zoom-both") {
    return (
      <div className="mt-3 w-full max-w-[300px] rounded-lg border border-slate-200 bg-white p-2">
        <svg
          className="viewer-doc-gesture-animation"
          viewBox="0 0 280 64"
          role="img"
          aria-label={animation.label}
        >
          <text x="18" y="17" fontSize="9" fontWeight="700" fill="#64748b">
            VERTICAL
          </text>
          <path d="M68 23V52" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
          <path
            d="M68 23L56 37M68 23L80 37"
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M68 52L56 38M68 52L80 38"
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g className="viewer-doc-scroll-dots">
            <circle cx="50" cy="38" r="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="86" cy="38" r="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="46" cy="34" r="3.5" fill="#ffffff" opacity="0.9" />
            <circle cx="82" cy="34" r="3.5" fill="#ffffff" opacity="0.9" />
          </g>

          <path d="M140 10V54" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />

          <text x="164" y="17" fontSize="9" fontWeight="700" fill="#64748b">
            HORIZONTAL
          </text>
          <rect x="218" y="6" width="34" height="16" rx="8" fill="#f1f5f9" stroke="#cbd5e1" />
          <text x="235" y="17" fontSize="9" fontWeight="700" fill="#64748b" textAnchor="middle">
            Ctrl
          </text>
          <path d="M208 23V52" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
          <path
            d="M208 23L196 37M208 23L220 37"
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M208 52L196 38M208 52L220 38"
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g className="viewer-doc-scroll-dots">
            <circle cx="190" cy="38" r="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="226" cy="38" r="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="186" cy="34" r="3.5" fill="#ffffff" opacity="0.9" />
            <circle cx="222" cy="34" r="3.5" fill="#ffffff" opacity="0.9" />
          </g>
        </svg>
      </div>
    );
  }

  return null;
}

/**
 * @param {{ slides: Array<{ id: string; title: string; content: string; imageSrc: string; animation?: { type: string; label: string } }> }} props
 */
export default function ViewerNavigationSlideshow({ slides }) {
  const [index, setIndex] = useState(0);
  const n = slides.length;
  const displayIndex = n === 0 ? 0 : ((index % n) + n) % n;
  const slide = n > 0 ? slides[displayIndex] : null;

  const go = useCallback(
    (delta) => {
      if (n === 0) return;
      setIndex((i) => (i + delta + n) % n);
    },
    [n]
  );

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    },
    [go]
  );

  if (!slide) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="Viewer navigation guide"
      tabIndex={0}
    >
      <style>{`
        .viewer-doc-gesture-animation {
          display: block;
          height: 64px;
          width: 100%;
        }

        .viewer-doc-pan-dot {
          animation: viewer-doc-pan-x 1.4s ease-in-out infinite alternate;
          transform-origin: 110px 32px;
        }

        .viewer-doc-scroll-dots {
          animation: viewer-doc-scroll-y 1.2s ease-in-out infinite alternate;
          transform-origin: center;
        }

        @keyframes viewer-doc-pan-x {
          from { transform: translateX(-48px); }
          to { transform: translateX(48px); }
        }

        @keyframes viewer-doc-scroll-y {
          from { transform: translateY(-12px); }
          to { transform: translateY(12px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .viewer-doc-pan-dot,
          .viewer-doc-scroll-dots {
            animation: none;
          }
        }
      `}</style>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex max-h-[min(56vh,420px)] min-h-[200px] items-center justify-center bg-slate-100/80 p-2">
          <img
            src={slide.imageSrc}
            alt={`${slide.title}: illustration for the Lorax viewer`}
            className="max-h-[min(52vh,400px)] w-full object-contain"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{slide.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{slide.content}</p>
          <DescriptionAnimation animation={slide.animation} />
          <p className="mt-3 text-xs text-slate-400">
            Step {displayIndex + 1} of {n}
            <span className="sr-only">. Use arrow keys when this panel is focused to change slides.</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => go(-1)}
            aria-label="Previous step"
          >
            <LuChevronLeft className="text-lg" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => go(1)}
            aria-label="Next step"
          >
            <LuChevronRight className="text-lg" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Slide indicators">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === displayIndex}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === displayIndex ? "bg-emerald-600" : "bg-slate-300 hover:bg-slate-400"
            }`}
            onClick={() => setIndex(i)}
            aria-label={`Go to step ${i + 1}: ${s.title}`}
          />
        ))}
      </div>
    </div>
  );
}
