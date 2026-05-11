import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BsGithub } from "react-icons/bs";
import {
  LuArrowLeft,
  LuBadgeCheck,
  LuBookOpen,
  LuBox,
  LuBrush,
  LuChevronRight,
  LuCircleHelp,
  LuExternalLink,
  LuLayers,
  LuMousePointer2,
  LuPackage,
  LuPanelRight,
  LuSearch,
  LuSparkles,
  LuTrees
} from "react-icons/lu";
import { PiPackage } from "react-icons/pi";
import CodeBlock from "./documentation/CodeBlock.jsx";
import Section from "./documentation/Section.jsx";
import { documentationSections } from "./documentation/sections.js";

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

const viewerTips = [
  "Pan the canvas to move across the visible tree layout.",
  "Use two-finger scroll or mouse-wheel gestures to zoom vertically.",
  "Hold Ctrl while scrolling to zoom the genomic axis horizontally.",
  "Open the right-side info panel for Details, Mutations, and Metadata tools."
];

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

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-slate-100">
            <img src="/logo.png" alt="Lorax Logo" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-xl font-bold tracking-tight text-slate-900">LORAX</p>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Documentation</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="hidden items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:inline-flex"
          >
            <LuArrowLeft /> Home
          </Link>
          <a
            href="https://pypi.org/project/lorax-arg/"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 md:inline-flex"
          >
            <PiPackage className="text-xl opacity-70" />
            PyPI
          </a>
          <a
            href="https://github.com/pratikkatte/lorax/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <BsGithub className="opacity-70" /> GitHub
          </a>
        </div>
      </div>
    </header>
  );
}

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

export default function DocumentationPage() {
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />
      <Header />

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
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full border-collapse bg-white text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Format</th>
                      <th className="px-4 py-3 font-semibold">Use</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3 font-mono text-slate-900">.trees</td>
                      <td className="px-4 py-3">Tskit tree sequence files for local genealogies and ARG visualization.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono text-slate-900">.trees.tsz</td>
                      <td className="px-4 py-3">Tszip-compressed tskit tree sequences.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono text-slate-900">.csv</td>
                      <td className="px-4 py-3">One row per recombination interval with genomic position, Newick tree, depth, and optional metadata.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
              <div className="grid gap-3 md:grid-cols-2">
                {viewerTips.map((tip) => (
                  <div key={tip} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <LuMousePointer2 className="mt-1 shrink-0 text-emerald-600" />
                    <p className="text-sm leading-6 text-slate-600">{tip}</p>
                  </div>
                ))}
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

            <Section id="resources" eyebrow="Next steps" title="Resources">
              <div className="grid gap-4 md:grid-cols-2">
                <LinkCard
                  href="https://github.com/pratikkatte/lorax/"
                  title="GitHub repository"
                  description="Browse source code, open issues, and follow Lorax development."
                />
                <LinkCard
                  href="https://pypi.org/project/lorax-arg/"
                  title="PyPI package"
                  description="Install the published `lorax-arg` package and check release metadata."
                />
                <LinkCard
                  href="/"
                  title="Landing page"
                  description="Load an ARG file or open one of the inferred project library examples."
                  external={false}
                />
                <LinkCard
                  href="https://github.com/pratikkatte/lorax/blob/main/INSTALL.md"
                  title="Full installation guide"
                  description="Read source installation, Docker, environment, and deployment details."
                />
              </div>
              <p>
                If you use Lorax in research, cite: <span className="font-medium text-slate-900">Lorax: Interactive visualization of Ancestral Recombination Graphs.</span>
              </p>
            </Section>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-100 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Lorax</p>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <Link to="/" className="hover:text-slate-900">Home</Link>
            <a href="https://github.com/pratikkatte/lorax/" target="_blank" rel="noreferrer" className="hover:text-slate-900">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
