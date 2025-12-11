// src/components/ViewerScreen.jsx
import { useEffect, useState , useCallback} from "react";
import { useParams, useSearchParams, Navigate } from "react-router-dom";
import { BsFillKanbanFill } from "react-icons/bs";
import { FaGear } from "react-icons/fa6";
import Lorax from './Lorax.jsx'
import Info from './components/Info.jsx'
import Settings from './components/Settings.jsx'
import useLoraxConfig from './globalconfig.js'
import axios from 'axios';
import LoraxMessage from "./components/loraxMessage";

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
      handleUCGBMode();
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

  const handleUCGBMode = useCallback(() => {
    if (ucgbMode.current) {
      axios.get(`${API_BASE}/ucgb?chrom=${qp.chrom}&genomiccoordstart=${qp.genomiccoordstart}&genomiccoordend=${qp.genomiccoordend}`).then(response => {
        // console.log("response", response)

        handleConfigUpdate(response.data.config);
        
        if (response.data.error) {
          console.log("error", response.data.error)
        } else {
          setConfig({...tsconfig, chrom: qp.chrom, value: [qp.genomiccoordstart, qp.genomiccoordend]});
        }
      })
    }
  }, [ucgbMode]);

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
  }, [ucgbMode]);

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
        </div>
      
      <div className="flex flex-row h-screen w-full z-40">

        <div className={`${(showInfo || showSettings) ? (showSidebar ? 'w-[73%]' : 'w-3/4') :  (showSidebar ? 'w-[97%]' : 'w-full')} transition-all duration-200`}>
        {statusMessage?.status === "file-load" && <LoraxMessage status={statusMessage.status} message={statusMessage.message} />}
        <Lorax backend={backend} config={config} settings={settings} setSettings={setSettings} project={project} ucgbMode={ucgbMode} statusMessage={statusMessage} setStatusMessage={setStatusMessage} />
        </div>
        <div className={`transition-all relative ${showInfo ? '' : 'hidden'} shadow-2xl bg-gray-100 duration-200 ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
            <Info backend={backend} gettingDetails={gettingDetails} setGettingDetails={setGettingDetails} setShowInfo={setShowInfo} config={config} setConfig={setConfig} selectedFileName={selectedFileName} setSelectedFileName={setSelectedFileName}/>
        </div>
        <div className={`transition-all relative ${showSettings ? '' : 'hidden'} shadow-2xl bg-gray-100 duration-200 ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
            <Settings settings={settings} setSettings={setSettings} showSettings={showSettings} setShowSettings={setShowSettings}/>
        </div>
      </div>
      </>
  );
}
