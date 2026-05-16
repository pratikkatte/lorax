import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { createViewState } from '@jbrowse/react-linear-genome-view2';
import { useLorax } from '@lorax/core';
import { LuArrowLeft, LuDna } from 'react-icons/lu';
import LoraxPlugin from 'jbrowse-plugin-lorax';
import EmbeddedJBrowseWithDrawer from './EmbeddedJBrowseWithDrawer.jsx';
import { apiBase, isProd } from '../config/runtime.js';
import {
  buildJBrowseDefaultSession,
  buildJBrowseRoute,
  buildLoraxJBrowseTrack,
  getDefaultJBrowseLocation,
  getJBrowseAssembly,
  resolveJBrowseAssemblyName
} from '../config/jbrowseConfig.js';

function JBrowseFileView() {
  const { file } = useParams();
  const [searchParams] = useSearchParams();
  const { loraxSid } = useLorax();

  const project = searchParams.get('project') || '1000Genomes';
  const requestedAssembly = searchParams.get('assembly');
  const assemblyName = resolveJBrowseAssemblyName(requestedAssembly, project);
  const sid = searchParams.get('sid') || undefined;
  const genomiccoordstart = searchParams.get('genomiccoordstart');
  const genomiccoordend = searchParams.get('genomiccoordend');
  const currentFile = file || '';

  const location = useMemo(() => getDefaultJBrowseLocation({
    project,
    file: currentFile,
    genomiccoordstart,
    genomiccoordend
  }), [currentFile, genomiccoordend, genomiccoordstart, project]);

  const loraxRoute = useMemo(() => {
    if (!currentFile) return '/';
    const params = new URLSearchParams();
    params.set('project', project);
    if (genomiccoordstart && genomiccoordend) {
      params.set('genomiccoordstart', genomiccoordstart);
      params.set('genomiccoordend', genomiccoordend);
    }
    if (sid) params.set('sid', sid);
    return `/view/${encodeURIComponent(currentFile)}?${params.toString()}`;
  }, [currentFile, genomiccoordend, genomiccoordstart, project, sid]);

  const viewState = useMemo(() => {
    if (!currentFile || !loraxSid || !assemblyName) return null;

    const track = buildLoraxJBrowseTrack({
      project,
      file: currentFile,
      assembly: assemblyName,
      apiBase,
      loraxSid,
      shareSid: sid,
      isProd
    });

    return createViewState({
      assembly: getJBrowseAssembly(assemblyName, project),
      tracks: [track],
      plugins: [LoraxPlugin],
      location,
      configuration: {
        rpc: {
          defaultDriver: 'MainThreadRpcDriver'
        }
      },
      defaultSession: buildJBrowseDefaultSession(track.trackId)
    });
  }, [assemblyName, currentFile, location, loraxSid, project, sid]);

  if (!currentFile) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50 text-slate-600">
        Missing file.
      </div>
    );
  }

  if (!assemblyName) {
    return (
      <div className="flex h-screen min-h-0 flex-col bg-white text-slate-900">
        <header className="flex min-h-[56px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              title="Back to projects"
              aria-label="Back to projects"
            >
              <LuArrowLeft aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <LuDna className="shrink-0 text-emerald-600" aria-hidden="true" />
                <span className="truncate">{currentFile}</span>
              </div>
              <p className="truncate text-xs text-slate-500">
                {project} · {location}
              </p>
            </div>
          </div>
          <Link
            to={loraxRoute}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Lorax viewer
          </Link>
        </header>

        <main className="grid min-h-0 flex-1 place-items-center bg-slate-50 px-6 text-center">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              No JBrowse assembly is configured for this project.
            </h1>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Open this file in Lorax, or provide an assembly explicitly in the JBrowse URL.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white text-slate-900">
      <header className="flex min-h-[56px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            title="Back to projects"
            aria-label="Back to projects"
          >
            <LuArrowLeft aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <LuDna className="shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="truncate">{currentFile}</span>
            </div>
            <p className="truncate text-xs text-slate-500">
              {project} · {assemblyName} · {location}
            </p>
          </div>
        </div>
        <Link
          to={loraxRoute}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        >
          Lorax viewer
        </Link>
      </header>

      <main className="min-h-0 flex-1">
        {viewState ? (
          <EmbeddedJBrowseWithDrawer viewState={viewState} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-500">
            Initializing JBrowse...
          </div>
        )}
      </main>
    </div>
  );
}

export default JBrowseFileView;

export function getJBrowseRouteForFile(options) {
  return buildJBrowseRoute(options);
}
