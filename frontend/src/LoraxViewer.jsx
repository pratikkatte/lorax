// src/components/ViewerScreen.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, useFetcher, useSearchParams, Navigate } from "react-router-dom";
import Chatbot from './ChatBot.jsx'
import { BsChatDots } from "react-icons/bs";
import { BsFillKanbanFill } from "react-icons/bs";
import { FaGear } from "react-icons/fa6";
import Lorax from './Lorax.jsx'
import Info from './components/Info.jsx'
import Settings from './components/Settings.jsx'
import useLoraxConfig from './globalconfig.js'
import axios from 'axios';

export default function LoraxViewer({ backend, config, setConfig, settings, setSettings, project, setProject, ucgbMode}) {


  const { file } = useParams();
  const {API_BASE} = useLoraxConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // UI state
  const [isChatbotVisible, setIsChatbotVisible] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [gettingDetails, setGettingDetails] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");

  if (file==='ucgb') {
    ucgbMode.current = true;
  }

  // useEffect(() => {
  //   while (!backend.isConnected) {
  //     // console.log("backend", backend)
  //   }
  // }, [backend])

  const qp = {
    file: file,
    project: searchParams.get("project"),
    chrom: searchParams.get("chrom"),
    genomiccoordstart: searchParams.get("genomiccoordstart"),
    genomiccoordend: searchParams.get("genomiccoordend")
  }


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

  useEffect(() => {

    const fileName = decodeURIComponent(file || "");
    if (!fileName) {
      navigate("/", { replace: true });
      return;
    }
    if (ucgbMode.current) {
      axios.get(`${API_BASE}/ucgb?chrom=${qp.chrom}&genomiccoordstart=${qp.genomiccoordstart}&genomiccoordend=${qp.genomiccoordend}`).then(response => {
        console.log("response", response)

        if (response.data.error) {
          console.log("error", response.data.error)
        } else {
          setConfig({...config, chrom: qp.chrom, value: [qp.genomiccoordstart,qp.genomiccoordend]});
        }
      })

    }else {
      if (qp.project && (qp.genomiccoordstart && qp.genomiccoordend) && !config) {

        setProject(qp.project);

        axios.get(`${API_BASE}/${file}?project=${qp.project}&genomiccoordstart=${qp.genomiccoordstart}&genomiccoordend=${qp.genomiccoordend}`).then(response => {
          console.log("response", response)

          if (response.data.error) {
            console.log("error", response.data.error)
          } else {
            setConfig({...config, project: qp.project, value: [qp.genomiccoordstart,qp.genomiccoordend]});
          }
        })

      }
      if (config && config.value && !qp.project && !qp.genomiccoordstart && !qp.genomiccoordend) {
        setSearchParams(...searchParams, { project: qp.project, genomiccoordstart: config.value[0], genomiccoordend: config.value[1]});
    }

  }

  }, [file, ucgbMode]);



  return (
    <>
        <div
          className="fixed top-0 right-0 h-full w-10 bg-gray-800 text-white z-[101] p-3 shadow-lg flex flex-col items-center space-y-6"
          onMouseLeave={(e) => {
          }}
        >
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
        <div className={`${(isChatbotVisible || showInfo || showSettings) ? (showSidebar ? 'w-[73%]' : 'w-3/4') :  (showSidebar ? 'w-[97%]' : 'w-full')} transition-all duration-200`}>
          <Lorax backend={backend} config={config} setConfig={setConfig} settings={settings} setSettings={setSettings} project={project} ucgbMode={ucgbMode} />
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
