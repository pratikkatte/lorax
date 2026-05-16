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

function LoadingNavigationTabs() {
  const [tab, setTab] = useState("lorax");
  const loraxTabId = "loading-navigation-tab-lorax";
  const jbrowseTabId = "loading-navigation-tab-jbrowse";
  const loraxPanelId = "loading-navigation-panel-lorax";
  const jbrowsePanelId = "loading-navigation-panel-jbrowse";

  const tabBtn =
    "min-h-[44px] flex-1 px-4 py-3 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div
        role="tablist"
        aria-label="Loading and navigation views"
        className="flex w-full overflow-x-auto border-b border-slate-200 bg-slate-50"
      >
        <button
          type="button"
          role="tab"
          id={loraxTabId}
          aria-selected={tab === "lorax"}
          aria-controls={loraxPanelId}
          onClick={() => setTab("lorax")}
          className={`${tabBtn} border-b-2 md:text-center ${
            tab === "lorax"
              ? "border-emerald-600 bg-white text-emerald-800"
              : "border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
          }`}
        >
          Lorax view
        </button>
        <button
          type="button"
          role="tab"
          id={jbrowseTabId}
          aria-selected={tab === "jbrowse"}
          aria-controls={jbrowsePanelId}
          onClick={() => setTab("jbrowse")}
          className={`${tabBtn} border-b-2 md:text-center ${
            tab === "jbrowse"
              ? "border-emerald-600 bg-white text-emerald-800"
              : "border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
          }`}
        >
          JBrowse view
        </button>
      </div>

      <div
        role="tabpanel"
        id={loraxPanelId}
        aria-labelledby={loraxTabId}
        hidden={tab !== "lorax"}
        className="p-4"
      >
        <p className="mb-4 text-sm leading-6 text-slate-600">
          Use the Lorax viewer to move across local genealogies, inspect tree details, and adjust display settings.
        </p>
        <ViewerNavigationSlideshow slides={viewerNavigationSlides} />
      </div>

      <div
        role="tabpanel"
        id={jbrowsePanelId}
        aria-labelledby={jbrowseTabId}
        hidden={tab !== "jbrowse"}
        className="p-4"
      >
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <LuSparkles className="text-emerald-600" /> Launch with JBrowse
          </div>
          <p className="mb-3 text-sm leading-6 text-slate-600">
            Lorax can be launched inside JBrowse Web to overlay ARG tracks on a full genome browser with reference sequence and annotations. JBrowse launches require an assembly.
          </p>
          <CodeBlock label="Launch with JBrowse">
            {`# Built-in assemblies
lorax --file path/to/your.trees --jbrowse --assembly hg19
lorax --file path/to/your.trees --jbrowse --assembly hg38

# Local FASTA assembly
lorax --file path/to/your.trees --jbrowse --assembly /path/reference.fa.gz
lorax --file path/to/your.trees --jbrowse --assembly /path/reference-folder`}
          </CodeBlock>
        </div>
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
          <Section id="introduction" eyebrow="Overview" title="What is Lorax?">
            <p>
            Lorax is an interactive browser-based viewer for ancestral recombination graphs. It lets researchers load ARG data, navigate local genealogies across the genome, and explore how mutations, recombination, and sample metadata relate across the genome.
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
                <p className="mt-1 text-sm text-slate-500">Use metadata panels to connect graph structure to samples.</p>
              </div>
            </div>
          </Section>

          <Section id="install-and-quick-start" eyebrow="Setup" title="Install and Quick Start">
            <p>
              Lorax can be used{" "}
              <Link
                to="/"
                className="font-medium text-emerald-700 underline decoration-emerald-200 underline-offset-2 hover:text-emerald-800"
              >
                directly in the browser
              </Link>{" "}
              or run locally through the Python package.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                <LuPackage className="text-emerald-600" /> Python package
                <a
                  href="https://pypi.org/project/lorax-arg/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-700 underline decoration-emerald-200 underline-offset-2 hover:text-emerald-800"
                >
                  https://pypi.org/project/lorax-arg/
                  <LuExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
                .
              </div>
              <CodeBlock label="open the default viewer">
                {`pip install lorax-arg
lorax --port 3000`}</CodeBlock>
            </div>

            <div className="mt-6">
              <CodeBlock label="open and exisisting file">
                {`
# Preferred for large files
lorax --file path/to/your.trees`}
              </CodeBlock>
              
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

            <div className="mt-6">
              <details className="group rounded-2xl border border-slate-200 bg-slate-50/80 open:bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  <LuChevronRight className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
                  Launching from pip (CLI reference)
                </summary>
                <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3 text-sm leading-6 text-slate-600">
                  <ul className="list-disc space-y-2 pl-5">
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--file PATH</code> — copies the given file into the server upload area and loads it (good for large ARG files).
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--host</code> — Bind address (default{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">127.0.0.1</code>).
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--port</code> — Port (default{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">3000</code>).
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--jbrowse</code> — Launch with JBrowse; requires <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--assembly</code>.
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--assembly</code> — Required in JBrowse mode. Accepts <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">hg19</code>, <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">hg38</code>, aliases <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">h19</code> / <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">h38</code>, <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">FASTA[,FAI[,GZI]]</code>, or an assembly folder.
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">-h</code> /{" "}
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--help</code> — Full usage.
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">--version</code> — Package version.
                    </li>
                  </ul>
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
          </Section>

          <Section id="loading-data" eyebrow="Data flow" title="Loading &amp; Navigating">
            <LoadingNavigationTabs />
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
