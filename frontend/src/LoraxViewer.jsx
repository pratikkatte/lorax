// src/components/ViewerScreen.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, useFetcher, useSearchParams } from "react-router-dom";
import Chatbot from './ChatBot.jsx'
import { BsChatDots } from "react-icons/bs";
import { BsFillKanbanFill } from "react-icons/bs";
import { FaGear } from "react-icons/fa6";
import Lorax from './Lorax.jsx'
import Info from './components/Info.jsx'
import Settings from './components/Settings.jsx'
import useLoraxConfig from './globalconfig.js'
import axios from 'axios';
// import Info from "../components/Info.jsx";
// import Settings from "../components/Settings.jsx";

export default function LoraxViewer({ backend, config, setConfig, settings, setSettings, project, setProject}) {

  const { file } = useParams();

  const {API_BASE} = useLoraxConfig();

  const [searchParams, setSearchParams] = useSearchParams();

  console.log("file it's here", file, searchParams.get("project"), searchParams.get("start"), searchParams.get("end"))

  const navigate = useNavigate();

  const [isChatbotVisible, setIsChatbotVisible] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [gettingDetails, setGettingDetails] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");


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

  // Ensure config matches URL param (handles refresh/direct link)
  useEffect(() => {
    const fileName = decodeURIComponent(file || "");
    if (!fileName) {
      navigate("/", { replace: true });
      return;
    }

    if (searchParams.get("project") && searchParams.get("start") && searchParams.get("end") && !config) {
      setProject(searchParams.get("project"));
      
      axios.get(`${API_BASE}/${file}?project=${searchParams.get("project")}&start=${searchParams.get("start")}&end=${searchParams.get("end")}`).then(response => {
        console.log("response", response)
      })
      setConfig({...config, project: searchParams.get("project"), value: [searchParams.get("start"), searchParams.get("end")]});

    } 

    if (config && config.value && !searchParams.get("project") && !searchParams.get("start") && !searchParams.get("end")) {
      console.log("project", project);
      setSearchParams({project: project, start: config.value[0], end: config.value[1]});
    }

    // create an alternative to this, where set config based on the searchparams in the urls. 
    // socketref from ucsconnect , --> sent message to server, server sends back the config via websocket --> set config. 


    // if (!config?.file || config.file !== fileName) {
    //   // If needed, hydrate more fields by fetching metadata for fileName
    //   setConfig(prev => ({ ...(prev ?? {}), file: fileName }));
    // }
  }, [file, config, navigate]);

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
          <Lorax backend={backend} config={config} setConfig={setConfig} settings={settings} setSettings={setSettings} project={project} />
        </div>
          {/* <div className={`transition-all relative ${isChatbotVisible ? '' : 'hidden'} duration-200 shadow-2xl ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
            <Chatbot userName={userName} 
                setIsChatbotVisible={setIsChatbotVisible} 
                backend={backend}
                config={config}
                setConfig={setConfig}
                chatbotEnabled={chatbotEnabled}
                setChatbotEnabled={setChatbotEnabled}
                selectedFileName={selectedFileName}
                setSelectedFileName={setSelectedFileName}
            />
          </div> */}
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
