import React, { useMemo, useState } from 'react';
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
  buildCustomJBrowseAssembly,
  buildLoraxJBrowseTrack,
  getDefaultJBrowseLocation,
  getJBrowseAssembly,
  resolveJBrowseAssemblyName
} from '../config/jbrowseConfig.js';

function CustomAssemblyChooser({
  currentFile,
  project,
  location,
  loraxRoute,
  searchParams,
  setSearchParams
}) {
  const [selectedAssembly, setSelectedAssembly] = useState('hg19');
  const [locationInput, setLocationInput] = useState(location);
  const [customName, setCustomName] = useState('');
  const [customFastaUri, setCustomFastaUri] = useState('');
  const [customFaiUri, setCustomFaiUri] = useState('');
  const [customGziUri, setCustomGziUri] = useState('');

  const isCustom = selectedAssembly === 'custom';

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    const trimmedLocation = locationInput.trim();
    const assemblyName = isCustom ? customName.trim() : selectedAssembly;

    if (!assemblyName) return;
    if (isCustom && !customFastaUri.trim()) return;

    nextParams.set('assembly', assemblyName);
    if (trimmedLocation) {
      nextParams.set('location', trimmedLocation);
    } else {
      nextParams.delete('location');
    }

    if (isCustom) {
      nextParams.set('customFastaUri', customFastaUri.trim());
      if (customFaiUri.trim()) {
        nextParams.set('customFaiUri', customFaiUri.trim());
      } else {
        nextParams.delete('customFaiUri');
      }
      if (customGziUri.trim()) {
        nextParams.set('customGziUri', customGziUri.trim());
      } else {
        nextParams.delete('customGziUri');
      }
    } else {
      nextParams.delete('customFastaUri');
      nextParams.delete('customFaiUri');
      nextParams.delete('customGziUri');
    }

    setSearchParams(nextParams, { replace: true });
  };

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

      <main className="min-h-0 flex-1 bg-slate-50">
        <form
          onSubmit={handleSubmit}
          className="border-b border-slate-200 bg-white px-6 py-8 shadow-sm"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-3">
            <label className="flex min-w-[180px] flex-col gap-1 text-xs text-slate-500">
              Assembly
              <select
                value={selectedAssembly}
                onChange={(event) => setSelectedAssembly(event.target.value)}
                className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="hg19">hg19</option>
                <option value="hg38">hg38</option>
                <option value="custom">Custom URL</option>
              </select>
              <span>Select assembly to view</span>
            </label>

            <label className="flex min-w-[270px] flex-1 flex-col gap-1 text-xs text-slate-500">
              Location
              <input
                value={locationInput}
                onChange={(event) => setLocationInput(event.target.value)}
                className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="chr1 or chr1:1..100000"
              />
              <span>Enter sequence name, feature name, or location</span>
            </label>

            <button
              type="submit"
              className="mt-[18px] inline-flex h-9 items-center rounded bg-slate-900 px-5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-slate-800"
            >
              Open
            </button>
          </div>

          {isCustom && (
            <div className="mx-auto mt-5 grid max-w-6xl gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                Assembly name
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="myAssembly"
                  required={isCustom}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                FASTA URL
                <input
                  value={customFastaUri}
                  onChange={(event) => setCustomFastaUri(event.target.value)}
                  className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="https://example.org/reference.fa.gz"
                  required={isCustom}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                FAI URL
                <input
                  value={customFaiUri}
                  onChange={(event) => setCustomFaiUri(event.target.value)}
                  className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="https://example.org/reference.fa.gz.fai"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                GZI URL
                <input
                  value={customGziUri}
                  onChange={(event) => setCustomGziUri(event.target.value)}
                  className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="https://example.org/reference.fa.gz.gzi"
                />
              </label>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}

function JBrowseFileView() {
  const { file } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loraxSid } = useLorax();

  const project = searchParams.get('project') || '1000Genomes';
  const requestedAssembly = searchParams.get('assembly');
  const customAssembly = useMemo(() => buildCustomJBrowseAssembly({
    name: requestedAssembly,
    fastaUri: searchParams.get('customFastaUri'),
    faiUri: searchParams.get('customFaiUri'),
    gziUri: searchParams.get('customGziUri')
  }), [requestedAssembly, searchParams]);
  const assemblyName = resolveJBrowseAssemblyName(requestedAssembly, project, {
    allowCustom: Boolean(customAssembly)
  });
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
  const requestedLocation = searchParams.get('location');
  const jbrowseLocation = requestedLocation || location;

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
      assembly: customAssembly || getJBrowseAssembly(assemblyName, project),
      tracks: [track],
      plugins: [LoraxPlugin],
      location: jbrowseLocation,
      configuration: {
        rpc: {
          defaultDriver: 'MainThreadRpcDriver'
        }
      },
      defaultSession: buildJBrowseDefaultSession(track.trackId)
    });
  }, [assemblyName, currentFile, customAssembly, jbrowseLocation, loraxSid, project, sid]);

  if (!currentFile) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50 text-slate-600">
        Missing file.
      </div>
    );
  }

  if (!assemblyName) {
    return (
      <CustomAssemblyChooser
        currentFile={currentFile}
        project={project}
        location={jbrowseLocation}
        loraxRoute={loraxRoute}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />
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
              {project} · {assemblyName} · {jbrowseLocation}
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
