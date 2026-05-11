import React from "react";
import { LuHash } from "react-icons/lu";

export default function Section({ id, eyebrow, title, children }) {
  return (
    <section
      id={id}
      data-doc-section
      className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            {eyebrow}
          </p>
        )}
        <a href={`#${id}`} className="group inline-flex items-center gap-2">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h2>
          <LuHash className="mt-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
      </div>
      <div className="space-y-5 text-sm leading-7 text-slate-600 sm:text-base">
        {children}
      </div>
    </section>
  );
}
