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

  const deckRef = useRef();

  // ... (screenshot callback) ...

  const handleScreenshot = useCallback(() => {
    if (deckRef.current && deckRef.current.deck && deckRef.current.deck.canvas) {
      const canvas = deckRef.current.deck.canvas;
      const data = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'lorax-screenshot.png';
      link.href = data;
      link.click();
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
            setLineagePaths(showLineages ? (results.lineage || {}) : {});
            setHighlightedNodes(results.highlights || {});
          } else {
            setLineagePaths({});
            setHighlightedNodes({});
          }
        });
      } else {
        setLineagePaths({});
        setHighlightedNodes({});
      }
    }
  }, [config.searchTerm, config.searchTags, config.populationFilter?.colorBy, config.sampleDetails, backend.isConnected, backend, visibleTrees, settings, statusMessage?.status]);

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
        className="fixed top-0 right-0 h-full w-10 bg-gray-800 text-white z-[101] p-3 shadow-lg flex flex-col items-center space-y-6">
        <div
          className="text-2xl hover:text-gray-300 transition-colors cursor-pointer p-2 hover:bg-gray-700 rounded"
          onClick={handleInfoClick}
          data-testid="info-button"
          onMouseDown={(e) => e.preventDefault()}
        >
          <BsFillKanbanFill />
        </div>
        <div
          className="text-2xl hover:text-gray-300 transition-colors cursor-pointer p-2 hover:bg-gray-700 rounded"
          onClick={handleSettingsClick}
          onMouseDown={(e) => e.preventDefault()}
        >
          <FaGear />
        </div>
        <div
          className="text-2xl hover:text-gray-300 transition-colors cursor-pointer p-2 hover:bg-gray-700 rounded"
          onClick={handleScreenshot}
          onMouseDown={(e) => e.preventDefault()}
          title="Take Screenshot"
        >
          <FaCamera />
        </div>
      </div >

      <div className="flex flex-row h-screen w-full z-40">

        <div className={`${(showInfo || showSettings) ? (showSidebar ? 'w-[73%]' : 'w-3/4') : (showSidebar ? 'w-[97%]' : 'w-full')} transition-all duration-200`}>
          {statusMessage?.status === "file-load" && <LoraxMessage status={statusMessage.status} message={statusMessage.message} />}
          <Lorax backend={backend} config={config} settings={settings} setSettings={setSettings} project={project} ucgbMode={ucgbMode} statusMessage={statusMessage} setStatusMessage={setStatusMessage} setVisibleTrees={setVisibleTrees} lineagePaths={lineagePaths} highlightedNodes={highlightedNodes} deckRef={deckRef} hoveredTreeIndex={hoveredTreeIndex} setHoveredTreeIndex={setHoveredTreeIndex} />
        </div>
        <div className={`transition-all relative ${showInfo ? '' : 'hidden'} shadow-2xl bg-gray-100 duration-200 ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
          <Info backend={backend} gettingDetails={gettingDetails} setGettingDetails={setGettingDetails} setShowInfo={setShowInfo} config={config} setConfig={setConfig} selectedFileName={selectedFileName} setSelectedFileName={setSelectedFileName} visibleTrees={visibleTrees} settings={settings} setSettings={setSettings} hoveredTreeIndex={hoveredTreeIndex} setHoveredTreeIndex={setHoveredTreeIndex} />
        </div>
        <div className={`transition-all relative ${showSettings ? '' : 'hidden'} shadow-2xl bg-gray-100 duration-200 ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
          <Settings settings={settings} setSettings={setSettings} showSettings={showSettings} setShowSettings={setShowSettings} />
        </div>
      </div>
    </>
  );
}