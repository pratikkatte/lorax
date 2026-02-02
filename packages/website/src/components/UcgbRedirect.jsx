import React, { useMemo } from 'react';
import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { resolveUcgbFilename } from '../config/ucgbChromMap';

const DEFAULT_PROJECT = '1000Genomes';
const EXCLUDED_PARAMS = new Set(['chrom', 'regionstart', 'regionend']);

function buildSearchParams(searchParams) {
  const project = searchParams.get('project') || DEFAULT_PROJECT;
  const genomiccoordstart = searchParams.get('genomiccoordstart') || searchParams.get('regionstart');
  const genomiccoordend = searchParams.get('genomiccoordend') || searchParams.get('regionend');

  const nextParams = new URLSearchParams();
  if (project) {
    nextParams.set('project', project);
  }

  if (genomiccoordstart && genomiccoordend) {
    nextParams.set('genomiccoordstart', genomiccoordstart);
    nextParams.set('genomiccoordend', genomiccoordend);
  }

  for (const [key, value] of searchParams.entries()) {
    if (EXCLUDED_PARAMS.has(key)) continue;
    if (nextParams.has(key)) continue;
    nextParams.set(key, value);
  }

  return nextParams;
}

export default function UcgbRedirect() {
  const [searchParams] = useSearchParams();

  const { filename, params } = useMemo(() => {
    const chrom = searchParams.get('chrom');
    const resolved = resolveUcgbFilename(chrom);
    return {
      filename: resolved,
      params: buildSearchParams(searchParams),
    };
  }, [searchParams]);

  if (!filename) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Invalid UCGB link</h2>
          <p className="mt-2 text-sm text-slate-600">
            Missing or invalid chromosome parameter. Please check the URL and try again.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const query = params.toString();
  const search = query ? `?${query}` : '';
  const target = `/view/${encodeURIComponent(filename)}${search}`;
  return <Navigate to={target} replace />;
}
