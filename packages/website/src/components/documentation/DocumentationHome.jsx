import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuBadgeCheck,
  LuBookOpen,
  LuBrush,
  LuChevronRight,
  LuDna,
  LuExternalLink,
  LuLayers,
  LuPackage,
  LuPanelRight,
  LuSearch,
  LuSparkles,
  LuTrees
} from "react-icons/lu";
import CodeBlock from "./CodeBlock.jsx";
import Section from "./Section.jsx";
import ViewerNavigationSlideshow from "./ViewerNavigationSlideshow.jsx";
import { documentationSections } from "./sections.js";
import { getViewerTourDocumentationSlides } from "../../data/viewerTourNarration.js";

const featureCards = [
  {
    icon: LuLayers,
    title: "Scalable ARG rendering",
    description: "Interactive WebGL views keep large ancestry graphs smooth while you pan, zoom, and inspect local trees."
  },
  {
    icon: LuTrees,
    title: "Genome-wide navigation",
    description: "Move across genomic coordinates and recombination intervals to compare local genealogies side by side."
  },
  {
    icon: LuSparkles,
    title: "Mutation-aware views",
    description: "Search variant positions, inspect mutation details, and trace where variants sit in local genealogies."
  },
  {
    icon: LuBrush,
    title: "Metadata integration",
    description: "Color, filter, and subset samples by population labels, phenotypes, or custom metadata columns."
  },
  {
    icon: LuDna,
    title: "JBrowse integration",
    description: "Launch Lorax inside JBrowse Web with --jbrowse to overlay ARG tracks on a full genome browser with reference sequence and annotations."
  }
];

const viewerNavigationSlides = getViewerTourDocumentationSlides();


function Toc({ activeSection }) {
  return (
    <nav className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-28">
      <p className="px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
        On this page
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
        {documentationSections.map(({ id, label, icon }) => {
          const isActive = activeSection === id;

          return (
            <a
              key={id}
              href={`#${id}`}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors lg:w-full ${
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {React.createElement(icon, { className: "text-base" })}
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function LinkCard({ href, title, description, external = true }) {
  const content = (
    <div className="flex h-full items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40">
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {external ? <LuExternalLink className="mt-1 shrink-0 text-slate-400" /> : <LuChevronRight className="mt-1 shrink-0 text-slate-400" />}
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return <Link to={href}>{content}</Link>;
}

function SupportedInputFormatsTabs() {
  const [tab, setTab] = useState("trees");
  const treesTabId = "supported-inputs-tab-trees";
  const csvTabId = "supported-inputs-tab-csv";
  const treesPanelId = "supported-inputs-panel-trees";
  const csvPanelId = "supported-inputs-panel-csv";

  const tabBtn =
    "min-h-[44px] flex-1 px-4 py-3 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div
        role="tablist"
        aria-label="Supported file formats"
        className="flex w-full overflow-x-auto border-b border-slate-200 bg-slate-50"
      >
        <button
          type="button"
          role="tab"
          id={treesTabId}
          aria-selected={tab === "trees"}
          aria-controls={treesPanelId}
          onClick={() => setTab("trees")}
          className={`${tabBtn} border-b-2 md:text-center ${
            tab === "trees"
              ? "border-emerald-600 bg-white text-emerald-800"
              : "border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
          }`}
        >
          <span className="font-mono">.trees</span> / <span className="font-mono">.trees.tsz</span>
        </button>
        <button
          type="button"
          role="tab"
          id={csvTabId}
          aria-selected={tab === "csv"}
          aria-controls={csvPanelId}
          onClick={() => setTab("csv")}
          className={`${tabBtn} border-b-2 md:text-center ${
            tab === "csv"
              ? "border-emerald-600 bg-white text-emerald-800"
              : "border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
          }`}
        >
          <span className="font-mono">.csv</span>
        </button>
      </div>

      <div
        role="tabpanel"
        id={treesPanelId}
        aria-labelledby={treesTabId}
        hidden={tab !== "trees"}
        className="w-full px-4 py-4 text-sm leading-6 text-slate-700"
      >
        <p>
          <span className="font-mono text-slate-900">.trees</span> files are tskit tree sequences: the standard format for local genealogies and ARG-style visualization in Lorax.{" "}
          <span className="font-mono text-slate-900">.trees.tsz</span> is the same data with tszip compression, which shrinks large datasets on disk and transfers faster.
        </p>
      </div>

      <div
        role="tabpanel"
        id={csvPanelId}
        aria-labelledby={csvTabId}
        hidden={tab !== "csv"}
        className="w-full px-4 py-4 text-sm leading-6 text-slate-700"
      >
        <p className="mb-3">
          CSV input is one row per recombination interval. Each row gives the genomic start of that interval and the local tree in Newick form. Vertical scaling in the viewer uses branch lengths from the Newick string unless you supply explicit per-tree heights (see optional columns below).
        </p>
        <p className="mb-2 font-medium text-slate-900">Mandatory columns</p>
        <ul className="mb-4 list-disc space-y-1 pl-5">
          <li>
            <span className="font-mono text-slate-900">genomic_positions</span> — integer start position of the interval along the genome (rows are sorted by this column on load).
          </li>
          <li>
            <span className="font-mono text-slate-900">newick</span> — Newick string for the local tree at that interval.
          </li>
        </ul>
        <p className="mb-2 font-medium text-slate-900">Optional columns</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-mono text-slate-900">max_branch_length</span> — per-tree maximum branch length (root-to-tip height) for scaling and layout; if omitted, Lorax estimates it from the Newick string.
          </li>
          <li>
            <span className="font-mono text-slate-900">tree_info</span> or <span className="font-mono text-slate-900">tree info</span> — per-tree notes passed to the UI.
          </li>
          <li>
            Additional columns placed <em>after</em> <span className="font-mono text-slate-900">max_branch_length</span> are treated as file-level metadata when that column is present (metadata-only rows have empty tree fields).
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function DocumentationHome() {
  const [activeSection, setActiveSection] = useState(documentationSections[0].id);

  useEffect(() => {
    const nodes = documentationSections
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0.1, 0.25, 0.5] }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative z-10">
      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:py-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            ARG visualization at scale
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Lorax documentation
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            A guide to install and use lorax
          </p>
          <div className="mt-8">
            <a
              href="#install-and-quick-start"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Install and Quick Start <LuChevronRight />
            </a>
          </div>
        </div>
        <div className="flex items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <img
            src="/lorax-logo.png"
            alt="Lorax"
            className="w-[22rem] h-auto object-contain"
          />
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-16 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside>
          <Toc activeSection={activeSection} />
        </aside>

        <div className="space-y-8">
          <Section id="introduction" eyebrow="Overview" title="What Lorax Provides">
            <p>
              Lorax is an interactive web viewer for Ancestral Recombination Graphs (ARGs). It helps researchers move from genome-wide ancestry data to local genealogies, mutations, and sample-level metadata without leaving the browser.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <LuBookOpen className="mb-3 text-2xl text-emerald-600" />
                <h3 className="font-semibold text-slate-900">Understand structure</h3>
                <p className="mt-1 text-sm text-slate-500">Inspect local trees and transitions across recombination intervals.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <LuSearch className="mb-3 text-2xl text-emerald-600" />
                <h3 className="font-semibold text-slate-900">Find signals</h3>
                <p className="mt-1 text-sm text-slate-500">Navigate from genomic positions, variants, or metadata to the graph region that matters.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <LuPanelRight className="mb-3 text-2xl text-emerald-600" />
                <h3 className="font-semibold text-slate-900">Inspect details</h3>
                <p className="mt-1 text-sm text-slate-500">Use details, mutations, and metadata panels to connect graph structure to samples.</p>
              </div>
            </div>
          </Section>

          <Section id="install-and-quick-start" eyebrow="Setup" title="Install and Quick Start">
            <p>
              Install the Python package, start Lorax, and open the web interface in your browser. For large files, pass the file path on the command line so the backend can load data without browser upload overhead—use <strong>JBrowse interface</strong> below for genome-browser mode.
            </p>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                <LuPackage className="text-emerald-600" /> Python package
              </div>
              <CodeBlock>{`pip install lorax-arg
lorax --port 3000`}</CodeBlock>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-sm leading-6 text-slate-600">
                Run <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">lorax</code> to open the default viewer, or pass <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">--file</code> (or a single existing file path) to load an ARG file directly.
              </p>
              <CodeBlock label="Install and run">
                {`pip install lorax-arg
lorax

# Preferred for large files
lorax --file path/to/your.trees`}
              </CodeBlock>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                You can also open the landing page and click <strong>Load File</strong> to upload <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">.trees</code>, <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">.trees.tsz</code>, or CSV files from your machine.
              </p>
            </div>

            <details
              id="supported-inputs"
              className="group mt-6 scroll-mt-28 rounded-2xl border border-slate-200 bg-slate-50/80 open:bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <LuChevronRight className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
                <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Formats</span>
                  <span className="font-semibold text-slate-900">Supported input formats</span>
                </span>
              </summary>
              <div className="border-t border-slate-200 px-4 pb-4 pt-4">
                <SupportedInputFormatsTabs />
              </div>
            </details>

            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                <LuSparkles className="text-emerald-600" /> JBrowse interface
              </div>
              <p className="mb-3 text-sm leading-6 text-slate-600">
                Add <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">--jbrowse</code> to launch Lorax inside{" "}
                <strong>JBrowse Web</strong> instead of the default viewer. JBrowse opens directly to a Linear Genome View with the Lorax track pre-configured and ready to use.
              </p>
              <CodeBlock label="Launch with JBrowse">
                {`# hg19 (GRCh37) by default
lorax --file path/to/your.trees --jbrowse

# Specify a different assembly
lorax --file path/to/your.trees --jbrowse --assembly hg38`}
              </CodeBlock>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-xl border border-emerald-100 bg-white/70 p-3">
                  <p className="font-medium text-slate-800 mb-1">Built-in assemblies</p>
                  <p className="text-slate-500 leading-6">
                    <code className="font-mono text-xs">hg19</code> (GRCh37, default),{" "}
                    <code className="font-mono text-xs">hg38</code> (GRCh38), and{" "}
                    <code className="font-mono text-xs">mm10</code> (GRCm38) are pre-configured with hosted reference files. Other assemblies can be added from within JBrowse.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white/70 p-3">
                  <p className="font-medium text-slate-800 mb-1">How it works</p>
                  <p className="text-slate-500 leading-6">
                    The same Lorax backend serves both the Lorax plugin bundle and the JBrowse static app on port 3000. No separate server or install is needed.
                  </p>
                </div>
              </div>

              <details className="group mt-5 rounded-xl border border-emerald-200/90 bg-white/60 open:bg-white/80">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  <LuChevronRight className="size-4 shrink-0 text-emerald-700 transition-transform group-open:rotate-90" />
                  JBrowse launch — <code className="font-mono text-sm font-semibold text-slate-800">--jbrowse</code>, assemblies, and{" "}
                  <code className="font-mono text-sm font-semibold text-slate-800">config.json</code>
                </summary>
                <div className="space-y-3 border-t border-emerald-200/80 px-4 pb-4 pt-3 text-sm leading-6 text-slate-600">
                  <p>
                    With <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-800">--jbrowse</code>, one Lorax process serves the static JBrowse app and the backend API on the same port. JBrowse loads configuration from{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">/config.json</code> on that server — this endpoint is <strong>generated at request time</strong> (it is not a static file baked into the wheel). It registers the Lorax plugin, optional built-in reference assemblies, and — when you started with{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">--file</code> — a Lorax track wired to your uploaded file.
                  </p>
                  <p className="font-medium text-slate-800">Assembly names and <code className="font-mono text-xs font-normal text-slate-800">assemblyNames</code></p>
                  <p>
                    The CLI flag <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">--assembly</code> chooses which <em>built-in</em> genome is included in that JSON (hosted reference for{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">hg19</code>,{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">hg38</code>, or{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">mm10</code>). The Lorax track definition uses{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">&quot;assemblyNames&quot;: [&quot;&lt;that name&gt;&quot;]</code> so the track lines up with that assembly. For genomes not in that list, supply your own JBrowse assembly entries in a custom config (below) so <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">assemblyNames</code> on the Lorax track match your assembly <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">name</code>.
                  </p>
                  <p className="font-medium text-slate-800">Providing a custom <code className="font-mono text-xs font-normal text-slate-800">config.json</code></p>
                  <p>
                    JBrowse Web can load a config from another URL via the <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">config</code> query parameter. After starting Lorax (with or without <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">--jbrowse</code>), open something like:
                  </p>
                  <CodeBlock label="Custom config URL">
                    {`http://127.0.0.1:3000/?config=https://example.com/my/lorax-jbrowse-config.json`}
                  </CodeBlock>
                  <p>
                    Your JSON must still list the <strong>Lorax</strong> plugin with a <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">url</code> that resolves to this server&apos;s plugin bundle (typically{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">http://&lt;host&gt;:&lt;port&gt;/lorax-plugin.js</code>
                    ). Lorax tracks should use a <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">LoraxAdapter</code> whose <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">apiBase</code> points at{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">http://&lt;host&gt;:&lt;port&gt;/api</code> and whose <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">filePath</code> matches the absolute path the backend expects for your ARG file (the same layout the server uses after <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">--file</code>). If the config is hosted on a <em>different origin</em> than JBrowse, ensure CORS allows your Lorax origin to fetch it.
                  </p>
                  <p>
                    For structure and examples of assemblies, reference tracks, and plugin registration, start from the sample{" "}
                    <code className="rounded bg-white px-1 font-mono text-xs text-slate-800">jbrowse_config.json</code> in the <strong>lorax-plugin</strong> source tree and rewrite URLs to match your running Lorax server.
                  </p>
                </div>
              </details>
            </div>

            <div className="mt-6">
              <details className="group rounded-2xl border border-slate-200 bg-slate-50/80 open:bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  <LuChevronRight className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
                  Launching from pip (CLI reference)
                </summary>
                <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3 text-sm leading-6 text-slate-600">
                  <p>
                    After <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">pip install lorax-arg</code>, run{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">lorax</code>. The server starts on{" "}
                    <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--host</code> /{" "}
                    <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--port</code>; once{" "}
                    <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">/api/health</code> responds, your browser opens to the app (default viewer or JBrowse when using{" "}
                    <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--jbrowse</code>).
                  </p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--file PATH</code> — Copy the given file into the server upload area and open it (good for large ARG files). Same effect as passing a single existing file path as the first argument without{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--file</code> (for example{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">lorax path/to/data.trees</code>
                      ).
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--host</code> — Bind address (default{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">127.0.0.1</code>). If you use{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">0.0.0.0</code>, the auto-opened browser URL still uses{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">127.0.0.1</code> so it works from the same machine.
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--port</code> — Port (default{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">3000</code>).
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--jbrowse</code> — Serve the bundled <strong>JBrowse Web</strong> app instead of the default Lorax UI. See <strong>JBrowse interface</strong> above for examples; expand <strong>JBrowse launch</strong> in that block for <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">config.json</code> and assembly details.
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--assembly</code> — In JBrowse mode, selects the built-in assembly name (default{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">hg19</code>
                      ; also <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">hg38</code>,{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">mm10</code>). Ignored for the default viewer.
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">-h</code> /{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--help</code> — Full usage.
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--version</code> — Package version.
                    </li>
                  </ul>
                  <p className="text-slate-500">
                    Your install always matches the compiled CLI; when in doubt, run:
                  </p>
                  <CodeBlock label="CLI help">{`lorax --help`}</CodeBlock>
                </div>
              </details>
            </div>

          </Section>

          <Section id="key-features" eyebrow="Analysis tools" title="Key Features and Workflows">
            <div className="grid gap-4 md:grid-cols-2">
              {featureCards.map(({ icon, title, description }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  {React.createElement(icon, { className: "mb-3 text-2xl text-emerald-600" })}
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
              <div className="flex items-start gap-3">
                <LuBadgeCheck className="mt-1 shrink-0 text-emerald-700" />
                <p className="text-sm leading-6 text-emerald-900">
                  The right-side info panel groups exploration into Details, Mutations, and Metadata tabs, so users can inspect selected nodes, search variants, and apply metadata-driven coloring or filters without changing context.
                </p>
              </div>
            </div>

            <div id="sharing" className="scroll-mt-28 space-y-5 border-t border-slate-200 pt-8">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">URLs</p>
                <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  File URLs and sharing
                </h3>
              </div>
              <p>
                Loaded files open under the viewer route, using `/view/:file`. Legacy file-style links are redirected to this route so older URLs continue to work.
              </p>
              <CodeBlock label="Viewer URL">
                {`/view/example.trees
/view/example.trees?presetfeature=population`}
              </CodeBlock>
              <p>
                Query parameters can be used by Lorax features to open the viewer in a guided state, such as jumping into metadata preset workflows.
              </p>
            </div>
          </Section>

          <Section id="loading-data" eyebrow="Data flow" title="Loading &amp; Navigating">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["Web upload", "Best for small files and quick tests. Use the landing page Load File button or drag a file onto the logo card."],
                ["Direct CLI", "Best for large local files. Start Lorax with `lorax --file path/to/file.trees`."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
            <p>
              Lorax follows the interaction patterns users expect from genome and phylogeny browsers: a main canvas for exploration, a genomic position control, and contextual panels for details.
            </p>
            <ViewerNavigationSlideshow slides={viewerNavigationSlides} />
          </Section>

          <Section id="usecases" eyebrow="Examples" title="Use cases">
            <p className="mb-4 text-sm leading-6 text-slate-600">
              These short write-ups live inside the documentation. Each page explains the biology and dataset, then links into the viewer with the matching feature preset (metadata coloring and genomic focus).
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <LinkCard
                href="/documentation/usecases/lactase-persistence"
                title="Lactase persistence"
                description="1000 Genomes chr2 at the lactase locus—read the article, then open the tree sequence with the preset."
                external={false}
              />
              <LinkCard
                href="/documentation/usecases/heliconius"
                title="Heliconius butterfly"
                description="Chromosome 2 inversion region from project CSV—read the article, then open the guided viewer."
                external={false}
              />
            </div>
            <p className="mt-6">
              If you use Lorax in research, cite: <span className="font-medium text-slate-900">Lorax: Interactive visualization of Ancestral Recombination Graphs.</span>
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
