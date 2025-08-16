import { useState } from "react";
import { BsCloudUpload, BsPlayCircle, BsGithub } from "react-icons/bs";
import { FaMagnifyingGlassChart } from "react-icons/fa6";
import { LuTreePine } from "react-icons/lu";
import { RiRobot2Line } from "react-icons/ri";

/**
 * LandingPage integrated with useFileUpload
 *
 * Props:
 * - config, setConfig: pass-through to hook so it can set your app config after upload
 * - onStartDemo?: () => void
 * - onOpenDocs?: () => void
 * - onSelectFile?: (file: File) => void   // optional, called after successful upload
 * - version?: string
 */
export default function LandingPage({
  config,
  setConfig,
  onStartDemo,
  onOpenDocs,
  upload,
  onSelectFile,
  version = "pre‑release",
}) {
  

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Header */}
      <header className="w-full border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 grid place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <LuTreePine className="text-xl" />
            </div>
            <div className="leading-tight">
              <h1 className="font-semibold text-lg tracking-tight">Lorax</h1>
              <p className="text-xs text-slate-500">Interactive ARG visualization & analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge pill>{version}</Badge>
            <button
              onClick={onOpenDocs}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <FaMagnifyingGlassChart className="opacity-70" /> Docs
            </button>
            <a
              href="https://github.com/" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <BsGithub className="opacity-70" /> GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Main content wrapper */}
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 pt-10 pb-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
              Explore Ancestral Recombination Graphs <span className="text-emerald-600">at scale</span>
            </h2>
            <p className="mt-4 text-slate-600 text-lg">
              Lorax lets you load tree sequences, pan through local genealogies, inspect read‑level evidence, and
              ask an LLM for on‑the‑fly analysis—all in the browser.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={upload.browse}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-white font-medium shadow-sm hover:bg-emerald-700"
                disabled={upload.isUploading}
              >
                <BsCloudUpload className="text-lg" /> {upload.isUploading ? `${upload.uploadProgress}%` : "Load a file"}
              </button>
              <button
                onClick={onStartDemo}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 font-medium hover:bg-slate-50"
              >
                <BsPlayCircle className="text-lg" /> 
              </button>
            </div>

            {upload.selectedFileName && (
              <p className="mt-3 text-sm text-slate-500">
                Selected: <span className="font-medium">{upload.selectedFileName}</span>
                <button onClick={upload.remove} className="ml-3 text-rose-600 hover:underline">remove</button>
              </p>
            )}

            {/* Hidden input handled by the hook */}
            <input {...upload.getInputProps()} />
          </div>

          {/* Dropzone / Illustration */}
          <div>
            <div
              className={[
                "relative rounded-3xl border-2 border-dashed bg-white p-8 transition-all",
                upload.dragOver ? "border-emerald-500/70 shadow-lg" : "border-slate-200 shadow-sm",
              ].join(" ")}
              {...upload.getDropzoneProps()}
            >
              <div className="pointer-events-none select-none">
                <ARGIllustration />
              </div>
              <div className="absolute inset-0 grid place-items-center">
                <div className="rounded-2xl bg-white/80 backdrop-blur px-4 py-2 text-sm text-slate-600">
                  {upload.isUploading ? `Uploading… ${upload.uploadProgress}%` : "Drag & drop a file here"}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Supports tree sequences (.trees), Newick, and track files (BED/bigBed) used with the browser.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-6 pt-4 pb-16">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<LuTreePine />}
              title="Local trees, global context"
              desc="Scroll through local genealogies, jump to recombination breakpoints, and keep orientation with a timeline strip."
            />
            <FeatureCard
              icon={<FaMagnifyingGlassChart />}
              title="Read‑level evidence"
              desc="Inspect pileups, unaccounted alleles, and haplotype placements to validate signals from wastewater or clinical data."
            />
            <FeatureCard
              icon={<RiRobot2Line />}
              title="LLM‑assisted analysis"
              desc="Ask natural‑language questions and let the assistant generate code or compute quick stats on the fly."
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-auto">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} Lorax. All rights reserved.</p>
          <div className="text-xs text-slate-500">
            Built for interactive ARG exploration.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
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

function Badge({ children, pill }) {
  return (
    <span className={["inline-flex items-center border border-slate-200 bg-white text-slate-600 text-xs", pill ? "rounded-full px-3 py-1" : "rounded-md px-2 py-1"].join(" ")}>{children}</span>
  );
}

// Simple SVG placeholder illustrating ARG edges + genome band
function ARGIillustrationInner() {
  return (
    <svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" className="w-full h-[300px]">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopOpacity="0.08" />
          <stop offset="100%" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="360" fill="url(#g)" />
      {/* genome band */}
      <rect x="40" y="300" width="560" height="10" rx="5" fill="#10b981" opacity="0.3" />
      {/* local trees (stylized) */}
      {[
        { x: 70 },
        { x: 200 },
        { x: 330 },
        { x: 460 },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x},0)`}>
          <path d="M40 280 L80 220 L120 280" stroke="#0ea5e9" strokeWidth="2" fill="none" />
          <path d="M80 220 L60 160" stroke="#0ea5e9" strokeWidth="2" fill="none" />
          <path d="M80 220 L100 170" stroke="#0ea5e9" strokeWidth="2" fill="none" />
          {/* recombination arcs */}
          <path d="M60 160 C 100 120, 120 120, 100 170" stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

function ARGIillustrationSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-slate-100 h-[300px] w-full" />
  );
}

function ARGIillustrationWrapper() {
  const [mounted, setMounted] = useState(false);
  // avoid hydration mismatch if used in SSR later
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => { setMounted(true); });
  if (!mounted) return <ARGIillustrationSkeleton />;
  return <ARGIillustrationInner />;
}

// alias used above
function ARGIllustration() { return <ARGIillustrationWrapper />; }