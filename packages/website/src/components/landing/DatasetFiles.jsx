import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { LuDna } from "react-icons/lu";
import { buildJBrowseRoute } from "../../config/jbrowseConfig.js";

// Inline FilePill for simplicity if not needing separate file
function FilePill({ project, name, onOpen, loading }) {
    const jbrowseTo = buildJBrowseRoute({ project, file: name });

    return (
        <div className={`flex min-h-[52px] items-center gap-2 rounded-lg border p-2 text-sm transition-all duration-200 ${
            loading
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:shadow-sm"
        }`}>
            <button
                onClick={onOpen}
                disabled={loading}
                className="group flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:hover:bg-transparent"
            >
                <span className="truncate font-medium" title={name}>
                    {name}
                </span>
                {loading ? (
                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                ) : (
                    <span className="shrink-0 text-xs font-semibold text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
                        Open
                    </span>
                )}
            </button>
            <Link
                to={jbrowseTo}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                title={`Open ${name} in JBrowse`}
            >
                <LuDna className="h-4 w-4" aria-hidden="true" />
                JBrowse
            </Link>
        </div>
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
                                project={project}
                                name={name}
                                loading={loadingFile === name}
                                onOpen={() => {
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
