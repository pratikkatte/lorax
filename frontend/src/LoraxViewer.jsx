// src/components/ViewerScreen.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, Navigate } from "react-router-dom";
import { BsFillKanbanFill } from "react-icons/bs";
import { FaGear, FaCamera } from "react-icons/fa6";
import Lorax from './Lorax.jsx'
import Info from './components/Info.jsx'
import Settings from './components/Settings.jsx'
import useLoraxConfig from './globalconfig.js'
import LoraxMessage from "./components/loraxMessage";
import { fetchUCGBConfig } from "./services/api.js";

export default function LoraxViewer({ backend, config, settings, setSettings, project, setProject, ucgbMode, statusMessage, setStatusMessage, loadFile }) {

  const { tsconfig, setConfig, handleConfigUpdate } = config;
  const { file } = useParams();
  const { API_BASE } = useLoraxConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  // UI state
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [gettingDetails, setGettingDetails] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [qp, setQp] = useState(null);
  const [visibleTrees, setVisibleTrees] = useState([]);
  const [lineagePaths, setLineagePaths] = useState({});
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState(null);
  const [highlightedNodes, setHighlightedNodes] = useState({});
  const [clickedGenomeInfo, setClickedGenomeInfo] = useState(null);
  const [highlightedMutationNode, setHighlightedMutationNode] = useState(null);

  const deckRef = useRef();
  const captureRef = useRef();

  // SVG capture callback - uses captureRef exposed by Deck component
  const handleScreenshot = useCallback(() => {
    if (captureRef.current && captureRef.current.captureSVG) {
      captureRef.current.captureSVG();
    }
  }, []);


  useEffect(() => {
    if (backend && backend.isConnected) {
      const hasSearchTerm = config.searchTerm && config.searchTerm.trim() !== "";
      const hasSearchTags = config.searchTags && config.searchTags.length > 0;
      const showLineages = settings && settings.display_lineage_paths;

      // Common logic to resolve search terms -> sample names
      let sampleNames = [];
      if (hasSearchTerm || hasSearchTags) {
        // Convert search terms to actual sample names based on colorBy
        const colorBy = config.populationFilter?.colorBy;
        const sampleDetails = config.sampleDetails;

        // Helper function to get sample names that match a search term
        const getSampleNamesForTerm = (term) => {
          if (!term || !colorBy || !sampleDetails) return [term];

          const lowerTerm = term.trim().toLowerCase();
          const matchingSamples = [];
          for (const [sampleName, details] of Object.entries(sampleDetails)) {
            const val = details?.[colorBy];
            if (val !== undefined && val !== null && String(val).toLowerCase() === lowerTerm) {
              matchingSamples.push(sampleName);
            }
          }

          // If we found matching samples, return them; otherwise return original term
          return matchingSamples.length > 0 ? matchingSamples : [term];
        };

        if (hasSearchTerm) {
          sampleNames.push(...getSampleNamesForTerm(config.searchTerm));
        }

        if (hasSearchTags) {
          for (const tag of config.searchTags) {
            sampleNames.push(...getSampleNamesForTerm(tag));
          }
        }
      }


      // If lineages are disabled, clear lineage paths immediately
      if (!showLineages) {
        setLineagePaths({});
      }

      // Combined search
      if (sampleNames.length > 0) { // Check sampleNames instead of hasSearchTerm to capture mapped tags

        const sampleColors = {};
        if (config.populationFilter?.colorBy && config.sampleDetails && config.metadataColors && config.metadataColors[config.populationFilter.colorBy]) {
          const colorBy = config.populationFilter.colorBy;
          for (const sample of sampleNames) {
            const val = config.sampleDetails[sample]?.[colorBy];
            if (val !== undefined && val !== null) {
              const c = config.metadataColors[colorBy][String(val)];
              if (c) {
                sampleColors[sample.toLowerCase()] = c;
              }
            }
          }
        }

        backend.search(config.searchTerm, sampleNames, { showLineages, sampleColors }).then((results) => {
          if (results) {
            // Only set lineage paths if showLineages is still enabled
            if (showLineages) {
              setLineagePaths(results.lineage || {});
            }
            setHighlightedNodes(results.highlights || {});
          } else {
            if (showLineages) {
              setLineagePaths({});
            }
            setHighlightedNodes({});
          }
        });
      } else {
        // No search terms - clear all search-related data
        setLineagePaths({});
        setHighlightedNodes({});
      }
    }
  }, [config.searchTerm, config.searchTags, config.populationFilter?.colorBy, config.sampleDetails, backend.isConnected, backend, visibleTrees, settings, statusMessage?.status]);

  // Separate effect to immediately clear data when lineage is disabled or no search, independent of search timing
  useEffect(() => {
    const showLineages = settings && settings.display_lineage_paths;
    const hasSearchTerm = config.searchTerm && config.searchTerm.trim() !== "";
    const hasSearchTags = config.searchTags && config.searchTags.length > 0;

    // Immediately clear lineage paths if the feature is disabled
    if (!showLineages) {
      setLineagePaths({});
    }

    // Clear highlighted nodes if there's no active search
    if (!hasSearchTerm && !hasSearchTags) {
      setHighlightedNodes({});
      setLineagePaths({});
    }
  }, [settings?.display_lineage_paths, config.searchTerm, config.searchTags]);

  useEffect(() => {
    const qp = {
      file: file,
      project: searchParams.get("project"),
      chrom: searchParams.get("chrom"),
      genomiccoordstart: searchParams.get("genomiccoordstart"),
      genomiccoordend: searchParams.get("genomiccoordend"),
      sid: searchParams.get("sid")
    }

    if (file && file === 'ucgb') {
      ucgbMode.current = true;
      handleUCGBMode(qp);
    } else {
      ucgbMode.current = false;
      handleNormalMode(qp);
    }
  }, [file]);



  // return to home page.
  if (!file && !searchParams.get("chrom")) {
    return <Navigate to="/" replace />;
  }

  const handleInfoClick = () => {
    // setIsChatbotVisible(false);
    setShowSettings(false);
    setShowInfo(true);
  };

  const handleSettingsClick = () => {
    // setIsChatbotVisible(false);
    setShowInfo(false);
    setShowSettings(true);
  };

  const handleUCGBMode = useCallback((qp) => {
    if (ucgbMode.current) {
      fetchUCGBConfig(API_BASE, qp.chrom, qp.genomiccoordstart, qp.genomiccoordend).then(data => {
        // console.log("response", response)

        handleConfigUpdate(data.config);

        if (data.error) {
          console.log("error", data.error)
        } else {
          setConfig({ ...tsconfig, chrom: qp.chrom, value: [qp.genomiccoordstart, qp.genomiccoordend] });
        }
      })
    }
  }, [ucgbMode, API_BASE, handleConfigUpdate, setConfig, tsconfig]);

  const handleNormalMode = useCallback((qp) => {
    console.log("qp", qp);
    if (qp.project && !tsconfig) {

      // loadfile

      loadFile({
        file: qp.file,
        project: qp.project,
        share_sid: qp.sid,
        value: (qp.genomiccoordstart && qp.genomiccoordend) ? [qp.genomiccoordstart, qp.genomiccoordend] : null
      });
      setProject(qp.project);
    }
  }, [ucgbMode, tsconfig, loadFile, setProject]);

  return (
    <>
      <div
        className="fixed top-0 right-0 h-full w-8 hover:w-12 bg-slate-900 border-l border-slate-800 text-slate-400 z-[101] flex flex-col items-center py-4 space-y-4 shadow-2xl transition-all duration-200">

        {/* Logo or top spacer could go here */}

        <div
          className={`group relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${showInfo ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'hover:bg-slate-800 hover:text-slate-200'}`}
          onClick={handleInfoClick}
          data-testid="info-button"
          onMouseDown={(e) => e.preventDefault()}
        >
          <BsFillKanbanFill size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700">
            Info & Filters
          </span>
        </div>

        <div
          className={`group relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${showSettings ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'hover:bg-slate-800 hover:text-slate-200'}`}
          onClick={handleSettingsClick}
          onMouseDown={(e) => e.preventDefault()}
        >
          <FaGear size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700">
            Settings
          </span>
        </div>

        <div
          className="group relative p-3 rounded-xl transition-all duration-200 cursor-pointer hover:bg-slate-800 hover:text-slate-200"
          onClick={handleScreenshot}
          onMouseDown={(e) => e.preventDefault()}
        >
          <FaCamera size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700">
            Export SVG
          </span>
        </div>

        <div className="flex-1" /> {/* Spacer */}
      </div >

      <div className="flex flex-row h-screen w-full z-40 bg-slate-50">
        <div className="w-[calc(100%-2rem)] h-full">
          {statusMessage?.status === "file-load" && <LoraxMessage status={statusMessage.status} message={statusMessage.message} />}
          <div className="w-full h-full relative rounded-r-2xl overflow-hidden shadow-2xl border-r border-slate-200 bg-white">

            <Lorax backend={backend} config={config} settings={settings} setSettings={setSettings} project={project} ucgbMode={ucgbMode} statusMessage={statusMessage} setStatusMessage={setStatusMessage} setVisibleTrees={setVisibleTrees} lineagePaths={lineagePaths} highlightedNodes={highlightedNodes} deckRef={deckRef} captureRef={captureRef} hoveredTreeIndex={hoveredTreeIndex} setHoveredTreeIndex={setHoveredTreeIndex} clickedGenomeInfo={clickedGenomeInfo} setClickedGenomeInfo={setClickedGenomeInfo} highlightedMutationNode={highlightedMutationNode} />
          </div>
        </div>

        <div className={`fixed top-0 right-8 h-full bg-white border-l border-slate-200 shadow-xl transition-transform duration-300 ease-in-out z-50 ${showInfo ? 'translate-x-0 w-[25%]' : 'translate-x-full w-[25%] hidden'}`}>
          <Info backend={backend} gettingDetails={gettingDetails} setGettingDetails={setGettingDetails} setShowInfo={setShowInfo} config={config} setConfig={setConfig} selectedFileName={selectedFileName} setSelectedFileName={setSelectedFileName} visibleTrees={visibleTrees} settings={settings} setSettings={setSettings} hoveredTreeIndex={hoveredTreeIndex} setHoveredTreeIndex={setHoveredTreeIndex} setClickedGenomeInfo={setClickedGenomeInfo} setHighlightedMutationNode={setHighlightedMutationNode} />
        </div>

        <div className={`fixed top-0 right-8 h-full bg-white border-l border-slate-200 shadow-xl transition-transform duration-300 ease-in-out z-50 ${showSettings ? 'translate-x-0 w-[25%]' : 'translate-x-full w-[25%] hidden'}`}>
          <Settings settings={settings} setSettings={setSettings} showSettings={showSettings} setShowSettings={setShowSettings} />
        </div>

      </div>
    </>
  );
}