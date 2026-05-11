import React, { useState } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";

export default function CodeBlock({ children, label }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).trim();

  const copyCode = async () => {
    if (!navigator?.clipboard) return;

    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
      {label && (
        <div className="border-b border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={copyCode}
        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 opacity-0 transition-opacity hover:bg-slate-800 group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? <LuCheck className="text-emerald-400" /> : <LuCopy />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 pr-24 text-sm leading-6 text-slate-100 custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}
