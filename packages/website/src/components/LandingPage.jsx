import React, { useState } from "react";
import { BsCloudUpload, BsGithub } from "react-icons/bs";
import { LuFileText, LuFolder } from "react-icons/lu";
import { BsChevronDown } from "react-icons/bs";
import ErrorAlert from "./ErrorAlert.jsx";
import DatasetFiles from "./landing/DatasetFiles.jsx";

// Minimal Badge Component
function Badge({ children, pill }) {
    return (
        <span className={["inline-flex items-center border border-slate-200 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider", pill ? "rounded-full px-3 py-1" : "rounded-md px-2 py-1"].join(" ")}>{children}</span>
    );
}

export default function LandingPage({
    upload,
    version = "pre‑release",
}) {

    const { projects } = upload;
    const [expandedId, setExpandedId] = useState(null);
    // We don't use navigate() here anymore because loadFile in useFileUpload handles redirection
    // via window.location.href to the Viewer app.

    return (
        <div className="min-h-screen w-full flex flex-col bg-slate-50 relative selection:bg-emerald-100 selection:text-emerald-900 font-sans">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-40 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            </div>

            {/* Header */}
            <header className="w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
                <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Logo placeholder or image if available in public */}
                        <div className="w-10 h-10 grid place-items-center bg-slate-100 rounded-full overflow-hidden">
                            <img src="/logo.png" alt="Lorax Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="leading-tight">
                            <h1 className="font-display font-bold text-xl tracking-tight text-slate-900">LORAX</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge pill>{version}</Badge>
                        <a
                            href="https://github.com/pratikkatte/lorax/" target="_blank" rel="noreferrer"
                            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 hover:text-slate-900 text-slate-600 transition-colors"
                        >
                            <BsGithub className="opacity-70" /> GitHub
                        </a>
                    </div>
                </div>
            </header>

            {/* Main content wrapper */}
            <main className="flex-1 z-10 relative">
                {upload.error && (
                    <div className="mx-auto max-w-2xl mt-6 px-6">
                        <ErrorAlert
                            message={upload.error}
                            onDismiss={upload.dismissError}
                            fullText
                        />
                    </div>
                )}

                {/* Hero Section */}
                <section
                    className="mx-auto max-w-7xl px-6 pt-8 pb-6 grid lg:grid-cols-2 gap-8 items-center"
                    data-tour="landing-hero"
                >
                    <div className="max-w-xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-3 py-1 text-xs font-medium text-emerald-800 backdrop-blur-sm mb-6">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            ARG Visualization at scale
                        </div>
                        <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-slate-900 mb-6">
                            The Genome is a forest.<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-500">The Lorax speaks for every tree.</span>
                        </h2>
                        <p className="text-slate-600 text-lg leading-relaxed mb-8">
                            Lorax enables smooth, interactive exploration of local genealogies and ancestral recombination graphs directly from tree-sequence data.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={upload.browse}
                                data-tour="landing-upload"
                                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-white font-medium shadow-xl shadow-slate-900/10 hover:bg-slate-800 hover:shadow-2xl hover:shadow-slate-900/20 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0"
                                disabled={upload.isUploading}
                            >
                                <BsCloudUpload className="text-lg group-hover:scale-110 transition-transform" />
                                {upload.isUploading && (
                                    <span
                                        className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent"
                                        aria-hidden="true"
                                    />
                                )}
                                {upload.isUploading ? upload.uploadStatus : "Load File"}
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-400 font-medium uppercase tracking-wide">
                            Supports .trees, .tszip and csv files
                        </p>

                        {upload.selectedFileName && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 inline-block">
                                <LuFileText />
                                <span>Selected: <span className="font-semibold">{upload.selectedFileName}</span></span>
                            </div>
                        )}

                        {/* Hidden input handled by the hook */}
                        <input {...upload.getInputProps()} />
                    </div>

                    {/* Lorax Logo - Drag & Drop Area */}
                    <div className="relative group" {...upload.getDropzoneProps()} data-tour="landing-dropzone">
                        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-sm">
                            <img
                                src="/lorax-logo.png"
                                alt="Lorax - Genome Analysis"
                                className="w-[22rem] h-auto object-contain"
                            />
                        </div>
                    </div>
                </section>

                {/* Existing Files Section */}
                <section className="mx-auto max-w-7xl px-6 py-4" data-tour="landing-library">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-display text-2xl font-bold text-slate-900">Inferred Project Library</h2>
                        <div className="h-px flex-1 bg-slate-200 ml-6"></div>
                    </div>

                    <ul className="flex flex-col gap-4 max-w-4xl mx-auto">
                        {Object.keys(projects ?? {}).map((p) => {
                            const project_details = projects[p] ?? {};
                            const id = p;
                            const isOpen = expandedId === id;
                            const files = Array.isArray(project_details?.files) ? project_details.files : [];
                            const name = p;
                            const description = project_details?.description ?? "No description available.";

                            if (files.length === 0) return null;

                            return (
                                <li
                                    key={id}
                                    className={`group/project rounded-2xl border bg-white shadow-sm transition-all duration-200 ${isOpen ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'border-slate-200 hover:border-emerald-300'}`}
                                >
                                    <button
                                        className="w-full flex items-center gap-5 p-5 text-left"
                                        onClick={() => setExpandedId(isOpen ? null : id)}
                                        aria-expanded={isOpen}
                                    >
                                        <div className={`shrink-0 p-3 rounded-xl transition-colors ${isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 group-hover/project:bg-emerald-50 group-hover/project:text-emerald-600'}`}>
                                            <LuFolder size={24} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-display text-lg font-bold text-slate-900 truncate" title={name}>{name}</h3>
                                                <span className="shrink-0 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                                                    {files.length} {files.length === 1 ? 'file' : 'files'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 truncate">
                                                {description}
                                            </p>
                                        </div>

                                        <div className={`shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-600' : 'group-hover/project:text-emerald-500'}`}>
                                            <BsChevronDown size={20} />
                                        </div>
                                    </button>

                                    {/* Body for files */}
                                    <div
                                        className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${isOpen ? "max-h-96" : "max-h-0"
                                            }`}
                                    >
                                        <div className="bg-slate-50/50 p-4 border-t border-slate-100/80 mx-1 mb-1 rounded-b-xl">
                                            <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                                <DatasetFiles project={project_details.folder} files={files} loadFile={upload.loadFile} loadingFile={upload.loadingFile} setLoadingFile={upload.setLoadingFile} />
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-100 bg-white py-8">
                <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-slate-400">© {new Date().getFullYear()} Lorax</p>
                </div>
            </footer>

        </div>
    );
}
