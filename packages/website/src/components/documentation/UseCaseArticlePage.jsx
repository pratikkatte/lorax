import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { getUseCaseArticle } from "./useCaseArticles.js";

export default function UseCaseArticlePage() {
  const { slug } = useParams();
  const article = slug ? getUseCaseArticle(slug) : null;

  if (!article) {
    return <Navigate to="/documentation#usecases" replace />;
  }

  return (
    <main className="relative z-10">
      <div className="mx-auto max-w-3xl px-6 pb-16 pt-8">
        <Link
          to="/documentation#usecases"
          className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          <LuChevronLeft className="text-base" aria-hidden />
          Back to use cases
        </Link>

        <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">{article.eyebrow}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{article.title}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">{article.summary}</p>

          <div className="mt-8 space-y-4 text-sm leading-7 text-slate-700">
            {article.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Dataset: </span>
            {article.dataset}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to={article.viewerTo}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Open in viewer <LuChevronRight className="text-base" aria-hidden />
            </Link>
            <Link
              to="/documentation"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Full documentation
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
