import React from "react";
import { LuFileText } from "react-icons/lu";

export default function FilePill({ name, onClick, loading = false }) {
  return (
    <button
      onClick={onClick}
      className="w-full group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-300 hover:bg-emerald-50/40"
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="grid place-items-center rounded-lg bg-slate-50 border border-slate-200 p-1">
          <LuFileText className="h-4 w-4 text-slate-500" />
        </span>
        <span className="truncate">{name}</span>
      </span>
      <span className={`text-emerald-700 text-xs ${!loading ? "opacity-0 group-hover:opacity-100" : ""}`}>
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-emerald-700 inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Loading…
          </>
        ) : "Load"}
      </span>
    </button>
  );
}
