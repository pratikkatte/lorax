import { useState , useMemo, useEffect} from "react";
import { BsCloudUpload,BsArrowDown, BsGithub } from "react-icons/bs";
import { LuFileText } from "react-icons/lu";
import { FaMagnifyingGlassChart } from "react-icons/fa6";
import { LuTreePine } from "react-icons/lu";
import { RiRobot2Line } from "react-icons/ri";
import { BsChevronDown } from "react-icons/bs";
import axios from "axios";
import useLoraxConfig from "../globalconfig.js";
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

function DatasetFiles({ project, files = [], loadFile}) {
  const [q, setQ] = useState("");
  const [loadingFile, setLoadingFile] = useState(null);
  
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
                  e.currentTarget.disabled = true;
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

function FilePill({ name, onClick, loading = false }) {
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
        {loading ? "Loading…" : "Load"}
      </span>
    </button>
  );
}

function getProjects(API_BASE) {
  return axios.get(`${API_BASE}/projects`)
    .then(response => response.data.projects)
    .catch(error => {
      console.error('Error fetching projects:', error);
      return [];
    });
}


export default function LandingPage({
  upload,
  version = "pre‑release",
}) {

  const {API_BASE} = useLoraxConfig();

  const [projects, setProjects] = useState([]);
  
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if(projects.length === 0) {
      getProjects(API_BASE).then(projectsData => {
        setProjects(projectsData);
      })
      .catch(error => {
        console.error('Failed to load projects:', error);
      });
    }
  },[projects])

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
            <span className="text-emerald-600"> Visualize and Analyze </span> Ancestral Recombination Graphs
            </h2>
            <p className="mt-4 text-slate-600 text-lg">
              Lorax enables smooth, pan-and-zoom exploration of local genealogies across the genome from tree-sequence data.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={upload.browse}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-white font-medium shadow-sm hover:bg-emerald-700"
                disabled={upload.isUploading}
              >
                <BsCloudUpload className="text-lg" /> {upload.isUploading ? `${upload.uploadProgress}%` : "Load a .trees file"}
              </button>
              {/* <button
                onClick={onStartDemo}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 font-medium hover:bg-slate-50"
              >
                <BsPlayCircle className="text-lg" /> 
              </button> */}
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
              Supports tree sequences (.trees).
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-6 pt-4 pb-16">
  <h2 className="text-2xl font-semibold mb-4">Load Existing Inferred ARGs</h2>

  <ul className="space-y-4">
    {projects.map((p) => {
      const id = p.id ?? p.slug ?? p.name;
      const isOpen = expandedId === id;
      const files = Array.isArray(p.files) ? p.files : (p.files ? [p.files] : []);

      return (
        <li
          key={id}
          className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        >
          {/* Header */}
          <button
            className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
            onClick={() => setExpandedId(isOpen ? null : id)}
            aria-expanded={isOpen}
          >
            <div className="min-w-0">
              <h3 className="text-xl font-semibold tracking-tight">{p.name}</h3>
              {p.description && (
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                  {p.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                {files.length} file{files.length === 1 ? "" : "s"}
              </span>
              <BsChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {/* Body */}
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-6 pb-6 pt-1">
                {/* Optional inline file filter */}
                <DatasetFiles project={p.folder} files={files} loadFile={upload.loadFile}/>
              </div>
            </div>
          </div>
        </li>
      );
    })}
  </ul>
</section>


        {/* Features */}
        <section className="mx-auto max-w-7xl px-6 pt-4 pb-16">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<LuTreePine />}
              title="Local trees, global context"
              desc="Scroll through local genealogies, jump to recombination breakpoints, and keep orientation with a timeline strip."
            />
            {/* <FeatureCard
              icon={<FaMagnifyingGlassChart />}
              title="Read‑level evidence"
              desc="Inspect pileups, unaccounted alleles, and haplotype placements to validate signals from wastewater or clinical data."
            />
            <FeatureCard
              icon={<RiRobot2Line />}
              title="LLM‑assisted analysis"
              desc="Ask natural‑language questions and let the assistant generate code or compute quick stats on the fly."
            /> */}
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