// src/components/ViewerScreen.jsx
import { useEffect, useState , useCallback, useRef} from "react";
import { useParams, useSearchParams, Navigate } from "react-router-dom";
import { BsFillKanbanFill } from "react-icons/bs";
import { FaGear, FaCamera } from "react-icons/fa6";
import Lorax from './Lorax.jsx'
import Info from './components/Info.jsx'
import Settings from './components/Settings.jsx'
import useLoraxConfig from './globalconfig.js'
import LoraxMessage from "./components/loraxMessage";
import { fetchUCGBConfig } from "./services/api.js";

export default function LoraxViewer({ backend, config, settings, setSettings, project, setProject, ucgbMode, statusMessage, setStatusMessage, loadFile}) {

  const {tsconfig, setConfig, handleConfigUpdate} = config;
  const { file } = useParams();
  const {API_BASE} = useLoraxConfig();
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

  const deckRef = useRef();

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
        
        if ((hasSearchTerm || hasSearchTags) && showLineages) {
            backend.searchLineage(config.searchTerm, config.searchTags || []).then(data => {
                setLineagePaths(data);
            });
        } else {
            setLineagePaths({});
        }
    }
  }, [config.searchTerm, config.searchTags, backend.isConnected, backend, visibleTrees, settings]);

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
    }else{
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
          setConfig({...tsconfig, chrom: qp.chrom, value: [qp.genomiccoordstart, qp.genomiccoordend]});
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
        </div>
      
      <div className="flex flex-row h-screen w-full z-40">

        <div className={`${(showInfo || showSettings) ? (showSidebar ? 'w-[73%]' : 'w-3/4') :  (showSidebar ? 'w-[97%]' : 'w-full')} transition-all duration-200`}>
        {statusMessage?.status === "file-load" && <LoraxMessage status={statusMessage.status} message={statusMessage.message} />}
        <Lorax backend={backend} config={config} settings={settings} setSettings={setSettings} project={project} ucgbMode={ucgbMode} statusMessage={statusMessage} setStatusMessage={setStatusMessage} setVisibleTrees={setVisibleTrees} lineagePaths={lineagePaths} deckRef={deckRef} />
        </div>
        <div className={`transition-all relative ${showInfo ? '' : 'hidden'} shadow-2xl bg-gray-100 duration-200 ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
            <Info backend={backend} gettingDetails={gettingDetails} setGettingDetails={setGettingDetails} setShowInfo={setShowInfo} config={config} setConfig={setConfig} selectedFileName={selectedFileName} setSelectedFileName={setSelectedFileName} visibleTrees={visibleTrees}/>
        </div>
        <div className={`transition-all relative ${showSettings ? '' : 'hidden'} shadow-2xl bg-gray-100 duration-200 ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
            <Settings settings={settings} setSettings={setSettings} showSettings={showSettings} setShowSettings={setShowSettings}/>
        </div>
      </div>
      </>
  );
}