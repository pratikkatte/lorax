import React, { useCallback, useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

/**
 * @param {{ slides: Array<{ id: string; title: string; content: string; imageSrc: string }> }} props
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
