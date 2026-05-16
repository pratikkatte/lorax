import React, { useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { createViewState } from '@jbrowse/react-linear-genome-view2';
import { useLorax } from '@lorax/core';
import { Logomark } from '@jbrowse/core/ui';
import { LuArrowLeft } from 'react-icons/lu';
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
  getProjectJBrowseTracks,
  inferChromosomeFromFilename,
  resolveJBrowseAssemblyName
} from '../config/jbrowseConfig.js';

function chromosomeFromLocation(location, file) {
  const candidate = String(location || '').split(':')[0].trim();
  return candidate || inferChromosomeFromFilename(file);
}

function JBrowseHeaderTitle({ currentFile, project }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span
          aria-hidden="true"
          data-testid="jbrowse-header-logo"
          className="flex h-4 w-4 shrink-0 text-emerald-600 [&_svg]:h-full [&_svg]:w-full"
        >
          <Logomark />
        </span>
        <span className="truncate">{currentFile}</span>
      </div>
      <p className="truncate text-xs text-slate-500">
        {project}
      </p>
    </div>
  );
}

function CustomAssemblyChooser({
  currentFile,
  project,
  location,
  loraxRoute,
  searchParams,
  setSearchParams,
  onUseLocalAssembly
}) {
  const defaultChromosome = chromosomeFromLocation(location, currentFile);
  const [selectedAssembly, setSelectedAssembly] = useState('hg19');
  const [chromosomeInput, setChromosomeInput] = useState(defaultChromosome);
  const [customSource, setCustomSource] = useState('url');
  const [customFastaUri, setCustomFastaUri] = useState('');
  const [customFaiUri, setCustomFaiUri] = useState('');
  const [customGziUri, setCustomGziUri] = useState('');
  const customFastaFileRef = useRef(null);
  const customFaiFileRef = useRef(null);
  const customGziFileRef = useRef(null);

  const isCustom = selectedAssembly === 'custom';
  const isUpload = customSource === 'upload';

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    const chromosome = chromosomeInput.trim();

    if (isCustom && isUpload) {
      const assembly = buildCustomJBrowseAssembly({
        fastaLocation: customFastaFileRef.current,
        faiLocation: customFaiFileRef.current,
        gziLocation: customGziFileRef.current
      });
      if (!assembly) return;
      if (chromosome) {
        onUseLocalAssembly?.(assembly, chromosome);
        return;
      }
      onUseLocalAssembly?.(assembly, '');
      return;
    }

    const assemblyName = isCustom
      ? buildCustomJBrowseAssembly({ fastaUri: customFastaUri })?.name
      : selectedAssembly;

    if (!assemblyName) return;

    nextParams.set('assembly', assemblyName);
    if (chromosome) {
      nextParams.set('location', chromosome);
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
          <JBrowseHeaderTitle currentFile={currentFile} project={project} />
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
              Chromosome
              <input
                value={chromosomeInput}
                onChange={(event) => setChromosomeInput(event.target.value)}
                className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="chr1"
              />
              <span>Enter chromosome or sequence name</span>
            </label>

            <button
              type="submit"
              className="mt-[18px] inline-flex h-9 items-center rounded bg-slate-900 px-5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-slate-800"
            >
              Open
            </button>
          </div>

          {isCustom && (
            <div className="mx-auto mt-5 max-w-6xl">
              <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="custom-assembly-source"
                    value="url"
                    checked={customSource === 'url'}
                    onChange={() => setCustomSource('url')}
                  />
                  URL
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="custom-assembly-source"
                    value="upload"
                    checked={customSource === 'upload'}
                    onChange={() => setCustomSource('upload')}
                  />
                  Upload
                </label>
              </div>

              {isUpload ? (
                <div key="upload-fields" className="grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                    FASTA file
                    <input
                      type="file"
                      onChange={(event) => {
                        customFastaFileRef.current = event.target.files?.[0] || null;
                      }}
                      className="h-9 rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                    FAI file
                    <input
                      type="file"
                      onChange={(event) => {
                        customFaiFileRef.current = event.target.files?.[0] || null;
                      }}
                      className="h-9 rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                    GZI file
                    <input
                      type="file"
                      onChange={(event) => {
                        customGziFileRef.current = event.target.files?.[0] || null;
                      }}
                      className="h-9 rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                </div>
              ) : (
                <div key="url-fields" className="grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                    FASTA URL
                    <input
                      value={customFastaUri}
                      onChange={(event) => setCustomFastaUri(event.target.value)}
                      className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="https://example.org/reference.fa.gz"
                      required={isCustom && !isUpload}
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
  const [localCustomAssembly, setLocalCustomAssembly] = useState(null);
  const [localCustomLocation, setLocalCustomLocation] = useState(null);

  const project = searchParams.get('project') || '1000Genomes';
  const requestedAssembly = searchParams.get('assembly');
  const urlCustomAssembly = useMemo(() => buildCustomJBrowseAssembly({
    name: requestedAssembly,
    fastaUri: searchParams.get('customFastaUri'),
    faiUri: searchParams.get('customFaiUri'),
    gziUri: searchParams.get('customGziUri')
  }), [requestedAssembly, searchParams]);
  const customAssembly = localCustomAssembly || urlCustomAssembly;
  const assemblyName = resolveJBrowseAssemblyName(requestedAssembly, project, {
    allowCustom: Boolean(customAssembly)
  }) || customAssembly?.name || null;
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
  const jbrowseLocation = localCustomLocation || requestedLocation || location;

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
    const projectTracks = getProjectJBrowseTracks({
      project,
      assembly: assemblyName
    });

    return createViewState({
      assembly: customAssembly || getJBrowseAssembly(assemblyName, project),
      tracks: [track, ...projectTracks],
      plugins: [LoraxPlugin],
      location: jbrowseLocation,
      configuration: {
        rpc: {
          defaultDriver: 'MainThreadRpcDriver'
        }
      },
      defaultSession: buildJBrowseDefaultSession(track.trackId, projectTracks)
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
        onUseLocalAssembly={(assembly, nextLocation) => {
          setLocalCustomAssembly(assembly);
          setLocalCustomLocation(nextLocation || null);
        }}
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
          <JBrowseHeaderTitle currentFile={currentFile} project={project} />
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
