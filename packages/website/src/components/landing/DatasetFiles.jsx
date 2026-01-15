import React, { useState, useMemo } from "react";

// Inline FilePill for simplicity if not needing separate file
function FilePill({ name, onClick, loading }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`group flex items-center justify-between w-full p-3 rounded-lg border text-sm transition-all duration-200 
        ${loading
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 cursor-wait"
                    : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:shadow-sm"
                }`}
        >
            <span className="truncate font-medium flex-1 text-left" title={name}>
                {name}
            </span>
            {loading ? (
                <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin ml-2"></span>
            ) : (
                <span className="opacity-0 group-hover:opacity-100 text-emerald-500 font-medium ml-2 transition-opacity">
                    Open
                </span>
            )}
        </button>
    );
}

export default function DatasetFiles({ project, files = [], loadFile, loadingFile, setLoadingFile }) {
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-shadow"
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
                                    setLoadingFile(name);
                                    loadFile?.({ project, file: name });
                                }}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-slate-500 py-2">No matching files found.</p>
            )}
        </>
    );
}
