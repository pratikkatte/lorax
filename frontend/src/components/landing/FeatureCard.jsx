import React from "react";

export default function FeatureCard({ icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-xl grid place-items-center bg-emerald-50 text-emerald-700">
          <span className="text-xl">{icon}</span>
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-slate-600">{desc}</p>
    </div>
  );
}
