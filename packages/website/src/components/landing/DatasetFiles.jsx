import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Logomark } from "@jbrowse/core/ui";
import { buildJBrowseRoute } from "../../config/jbrowseConfig.js";

const isJBrowseLandingEnabled = (project) =>
    String(project || "").toLowerCase() !== "heliconius";

// Inline FilePill for simplicity if not needing separate file
function FilePill({ project, name, onOpen, loading }) {
    const canOpenJBrowse = isJBrowseLandingEnabled(project);
    const jbrowseTo = canOpenJBrowse ? buildJBrowseRoute({ project, file: name }) : null;
    const fileHoverPadding = canOpenJBrowse
        ? "group-hover/file:pr-24 group-focus-within/file:pr-24"
        : "group-hover/file:pr-14 group-focus-within/file:pr-14";

    return (
        <div className={`group/file relative flex min-h-[52px] items-center rounded-lg border p-2 text-sm transition-all duration-200 ${
            loading
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:shadow-sm"
        }`}>
            <span className={`min-w-0 flex-1 truncate px-2 pr-4 font-medium transition-[padding] ${fileHoverPadding}`} title={name}>
                {name}
            </span>
            <div
                data-testid="file-launch-actions"
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2 opacity-0 transition-opacity group-hover/file:opacity-100 group-focus-within/file:opacity-100"
            >
                <button
                    onClick={onOpen}
                    disabled={loading}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-wait disabled:opacity-70 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-600"
                    aria-label={`Open ${name} in Lorax`}
                >
                    {loading ? (
                        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    ) : (
                        <img
                            src="/logo.png"
                            alt=""
                            aria-hidden="true"
                            data-testid="lorax-launch-icon"
                            className="h-5 w-5 rounded-sm object-contain"
                        />
                    )}
                </button>
                {canOpenJBrowse ? (
                    <Link
                        to={jbrowseTo}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                        title={`Open ${name} in JBrowse`}
                        aria-label={`Open ${name} in JBrowse`}
                    >
                        <span
                            aria-hidden="true"
                            data-testid="jbrowse-launch-icon"
                            className="flex h-5 w-5 items-center [&_svg]:h-full [&_svg]:w-full"
                        >
                            <Logomark />
                        </span>
                    </Link>
                ) : null}
            </div>
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
