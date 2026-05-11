import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuBadgeCheck,
  LuBookOpen,
  LuBox,
  LuBrush,
  LuChevronRight,
  LuCircleHelp,
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
  }
];

const viewerNavigationSlides = getViewerTourDocumentationSlides();

const faqItems = [
  {
    question: "What is the fastest way to load a large file?",
    answer: "Use the CLI with `lorax --file path/to/file.trees`, or mount data into the Docker container. This avoids slow browser uploads for large datasets."
  },
  {
    question: "Which browsers work best?",
    answer: "Use a modern Chromium, Firefox, or Safari release with WebGL enabled. Hardware acceleration helps with large visualizations."
  },
  {
    question: "What if port 80 is already in use?",
    answer: "Map the container to another host port, for example `docker run -it -p 5173:80 lorax`, then open `http://localhost:5173`."
  }
];

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
            Learn how to install Lorax, load ancestry graph data, navigate the viewer, and use metadata and mutation tools to explore local genealogies.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#quick-start"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Start with Quick Start <LuChevronRight />
            </a>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Load data on the landing page
            </Link>
          </div>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {featureCards.map(({ icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                {React.createElement(icon, { className: "mb-3 text-2xl text-emerald-600" })}
                <h2 className="font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
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

          <Section id="quick-start" eyebrow="First run" title="Quick Start">
            <p>
              Install the Python package, start Lorax, and open the web interface. For large files, pass the file path directly so the backend can load it without browser upload overhead.
            </p>
            <CodeBlock label="Install and run">
              {`pip install lorax-arg
lorax

# Preferred for large files
lorax --file path/to/your.trees`}
            </CodeBlock>
            <p>
              You can also open the landing page and click <strong>Load File</strong> to upload `.trees`, `.trees.tsz`, or CSV files from your machine.
            </p>
          </Section>

          <Section id="installation" eyebrow="Setup" title="Installation Options">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                  <LuPackage className="text-emerald-600" /> Python package
                </div>
                <CodeBlock>{`pip install lorax-arg
lorax --port 3000`}</CodeBlock>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                  <LuBox className="text-emerald-600" /> Docker
                </div>
                <CodeBlock>{`docker pull pratikkatte7/lorax
docker run -it -p 80:80 lorax`}</CodeBlock>
              </div>
            </div>
            <p>
              For local development from source, build the website and install the backend/app Python packages from the repository.
            </p>
            <CodeBlock label="Build from source">
              {`npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python -m pip install -e packages/backend
python -m pip install -e packages/app
lorax --port 3000`}
            </CodeBlock>
          </Section>

          <Section id="supported-inputs" eyebrow="Formats" title="Supported Input Files">
            <SupportedInputFormatsTabs />
          </Section>

          <Section id="loading-data" eyebrow="Data flow" title="Loading Your ARG Data">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Web upload", "Best for small files and quick tests. Use the landing page Load File button or drag a file onto the logo card."],
                ["Direct CLI", "Best for large local files. Start Lorax with `lorax --file path/to/file.trees`."],
                ["Docker volume", "Best for container workflows. Mount your data folder into `/app/UPLOADS` and open it from the interface."]
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
            <CodeBlock label="Mount data with Docker">
              {`docker run -it -p 80:80 \\
  -v $(pwd)/ts_files:/app/UPLOADS/ts_files \\
  lorax`}
            </CodeBlock>
          </Section>

          <Section id="navigating-viewer" eyebrow="Viewer basics" title="Navigating the Viewer">
            <p>
              Lorax follows the interaction patterns users expect from genome and phylogeny browsers: a main canvas for exploration, a genomic position control, and contextual panels for details.
            </p>
            <ViewerNavigationSlideshow slides={viewerNavigationSlides} />
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
          </Section>

          <Section id="sharing" eyebrow="URLs" title="File URLs and Sharing">
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
          </Section>

          <Section id="environment" eyebrow="Runtime" title="Environment Variables">
            <div className="grid gap-3">
              {[
                ["LORAX_LOAD_FILE_MAX_CONCURRENCY", "Maximum concurrent CPU-heavy file loads."],
                ["LORAX_LOAD_FILE_MAX_QUEUE", "Maximum queued file-load requests."],
                ["LORAX_LOAD_FILE_QUEUE_TIMEOUT_SEC", "Queue timeout for file-load requests."],
                ["LORAX_INMEM_TTL_SEC", "Idle lifetime for in-memory session and graph caches."],
                ["LORAX_MODE", "Set to `local` for local-only mode."]
              ].map(([name, description]) => (
                <div key={name} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[260px_1fr]">
                  <code className="text-sm font-semibold text-slate-900">{name}</code>
                  <p className="text-sm leading-6 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="troubleshooting" eyebrow="FAQ" title="Troubleshooting">
            <div className="space-y-3">
              {faqItems.map(({ question, answer }) => (
                <details key={question} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                    <span className="flex items-center gap-2">
                      <LuCircleHelp className="text-emerald-600" />
                      {question}
                    </span>
                    <LuChevronRight className="shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{answer}</p>
                </details>
              ))}
            </div>
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
