import React from "react";
import { Link, Outlet } from "react-router-dom";
import { BsGithub } from "react-icons/bs";
import { LuArrowLeft } from "react-icons/lu";
import { PiPackage } from "react-icons/pi";

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

export default function DocumentationLayout() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />
      <Header />
      <Outlet />
      <footer className="relative z-10 border-t border-slate-100 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Lorax</p>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <Link to="/" className="hover:text-slate-900">
              Home
            </Link>
            <a href="https://github.com/pratikkatte/lorax/" target="_blank" rel="noreferrer" className="hover:text-slate-900">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
