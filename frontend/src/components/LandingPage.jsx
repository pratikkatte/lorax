import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BsCloudUpload, BsGithub, BsArrowRight } from "react-icons/bs";
import { LuTreePine, LuActivity, LuSearch, LuFileText, LuFolder } from "react-icons/lu";
import { BsChevronDown } from "react-icons/bs";
import useLoraxConfig from "../globalconfig.js";
import ErrorAlert from "./ErrorAlert.jsx";
import LoraxMessage from "./loraxMessage.jsx";
import DatasetFiles from "./landing/DatasetFiles.jsx";
import FeatureCard from "./landing/FeatureCard.jsx";
import ARGIllustration from "./landing/ARGIllustration.jsx";

export default function LandingPage({
  upload,
  version = "pre‑release",
}) {

  const { API_BASE } = useLoraxConfig();

  const { projects } = upload;

  const [expandedId, setExpandedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (upload.statusMessage?.status === "processing-file" && upload.statusMessage?.filename) {
      navigate(`/${upload.statusMessage.filename}?project=${upload.statusMessage.project || 'Uploads'}`);
    }
  }, [upload.statusMessage, navigate]);

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
            <div className="w-10 h-10 grid place-items-center">
              <img src="/logo.png" alt="Lorax Logo" className="w-full h-full object-contain" />
            </div>
            <div className="leading-tight">
              <h1 className="font-display font-bold text-xl tracking-tight text-slate-900">Lorax</h1>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Genome Analysis</p>
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
            />
          </div>
        )}

        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 grid lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-3 py-1 text-xs font-medium text-emerald-800 backdrop-blur-sm mb-6">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              Fast, Local ARG Visualization
            </div>
            <h2 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-900 mb-6">
              Genome is a forest, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Lorax speaks for every tree.</span>
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed mb-8">
              Lorax enables smooth, interactive exploration of local genealogies and ancestral recombination graphs directly from tree-sequence data.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={upload.browse}
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-white font-medium shadow-xl shadow-slate-900/10 hover:bg-slate-800 hover:shadow-2xl hover:shadow-slate-900/20 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0"
                disabled={upload.isUploading}
              >
                <BsCloudUpload className="text-lg group-hover:scale-110 transition-transform" />
                {upload.isUploading ? upload.uploadStatus : "Load .trees File"}
              </button>
            </div>

            {upload.selectedFileName && (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 inline-block">
                <LuFileText />
                <span>Selected: <span className="font-semibold">{upload.selectedFileName}</span></span>
              </div>
            )}

            {/* Hidden input handled by the hook */}
            <input {...upload.getInputProps()} />
          </div>

          {/* Dropzone / Illustration */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div
              className={[
                "relative rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-xl p-8 transition-all duration-300",
                upload.dragOver ? "border-emerald-500 ring-4 ring-emerald-500/10" : "hover:border-emerald-300/50",
              ].join(" ")}
              {...upload.getDropzoneProps()}
            >
              <div className="pointer-events-none select-none overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50">
                <ARGIllustration />
              </div>

              <div className="absolute inset-0 grid place-items-center">
                <div className={`transition-all duration-300 transform ${upload.dragOver ? 'scale-110' : 'scale-100'}`}>
                  <div className="rounded-2xl bg-white/90 backdrop-blur shadow-xl border border-white/20 px-6 py-4 text-sm font-medium text-slate-600 flex flex-col items-center gap-2">
                    <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                      <BsCloudUpload size={20} />
                    </div>
                    {upload.isUploading ? upload.uploadStatus : "Drop file to analyze"}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-400 font-medium uppercase tracking-wide">
              Supports tskit tree sequences (.trees)
            </p>
          </div>
        </section>

        {/* Existing Files Section */}
        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-2xl font-bold text-slate-900">Inferred Project Library</h2>
            <div className="h-px flex-1 bg-slate-200 ml-6"></div>
          </div>

          {/* {upload.statusMessage && <div className="mb-6"><LoraxMessage status={upload.statusMessage.status} message={upload.statusMessage.message} /></div>} */}

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


        {/* Features */}
        <section className="mx-auto max-w-7xl px-6 py-12 border-t border-slate-200/60">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">Powerful Features for Genetics</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">Designed for researchers and bioinformaticians to visualize complex evolutionary histories.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<LuTreePine />}
              title="Interactive Topologies"
              desc="Seamlessly scroll through thousands of marginal trees."
            />
            <FeatureCard
              icon={<LuSearch />}
              title="Deep Metadata Inspection"
              desc="Click on any node to reveal population data and mutations."
            />
            <FeatureCard
              icon={<LuActivity />}
              title="Recombination Events"
              desc="Track recombination breakpoints across the genome."
            />
          </div>
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

function Badge({ children, pill }) {
  return (
    <span className={["inline-flex items-center border border-slate-200 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider", pill ? "rounded-full px-3 py-1" : "rounded-md px-2 py-1"].join(" ")}>{children}</span>
  );
}
