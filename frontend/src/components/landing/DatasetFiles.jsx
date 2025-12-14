import React, { useState, useMemo } from "react";
import FilePill from "./FilePill";

export default function DatasetFiles({ project, files = [], loadFile, loadingFile, setLoadingFile, isConnected}) {
  const [q, setQ] = useState("");
  
  const visible = useMemo(() => {
    const sorted = [...files]
      .map(f => (typeof f === "string" ? f : f?.name ?? "unnamed"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return q ? sorted.filter(n => n.toLowerCase().includes(q.toLowerCase())) : sorted;
  }, [files, q]);

  return (
    <>
      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter files…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-400"
        />
      </div>

      {visible.length ? (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {visible.map((name) => (
            <li key={name}>
              <FilePill
                name={name}
                loading={loadingFile === name}
                onClick={e => {
                  e.currentTarget.disabled = loadingFile?true:false;
                  setLoadingFile(name);
                  loadFile?.({ project, file: name});
                }}
              />
              
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No matching files.</p>
      )}
    </>
  );
}
