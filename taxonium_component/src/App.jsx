import { useState, useEffect } from 'react'
import './App.css'
import Taxonium from './Taxonium.jsx'
import Chatbot from './ChatBot.jsx'
import { BsChatDots } from "react-icons/bs";
import { BsFillKanbanFill } from "react-icons/bs";
import Info from './components/Info.jsx'
import useConfig from "./hooks/useConfig";
import useLoraxConfig from './globalconfig.js'
import useConnect from './hooks/useConnect.jsx'

function App() {
  const [userName, setUserName] = useState("");
  const [isChatbotVisible, setIsChatbotVisible] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");

  const [chatbotEnabled, setChatbotEnabled] = useState(false);
  
  const [gettingDetails, setGettingDetails] = useState(false);

  const {API_BASE} = useLoraxConfig();
  const backend = useConnect({setGettingDetails});
  const {config, setConfig} = useConfig({backend});

  const handleChatClick = () => {
    setIsChatbotVisible(true);
    setShowInfo(false);
  };

  const handleInfoClick = () => {
    setIsChatbotVisible(false);
    setShowInfo(true);
  };

  useEffect(() => {
    if (showInfo) {
      setIsChatbotVisible(false);
    }
  }, [showInfo]);
  
  useEffect(() => {
    if (isChatbotVisible) {
      setShowInfo(false);
    }
  }, [isChatbotVisible]);

  // useEffect(() => {

  //   console.log("chatbotEnabled", chatbotEnabled);
  // }, [chatbotEnabled]);

  return (
    <>
      <div
        className="fixed top-0 right-0 h-full w-5 z-[100] pointer-events-auto"
        onMouseEnter={() => setShowSidebar(true)}
      />
      {!config && (
        <div>
          <button onClick={async () => {
            const response = await fetch(`${API_BASE}/test`);
            console.log(response);
          }}>
            Load file
          </button>
        </div>
      )}
      {showSidebar && (
        <div
          className="fixed top-0 right-0 h-full w-10 bg-gray-800 text-white z-[101] p-3 shadow-lg flex flex-col items-center space-y-6"
          onMouseLeave={(e) => {
            // setShowSidebar(false);
          }}
        >
          <div 
            className="text-2xl hover:text-gray-300 transition-colors cursor-pointer p-2 hover:bg-gray-700 rounded" 
            onClick={handleChatClick}
            onMouseDown={(e) => e.preventDefault()}
          >
            <BsChatDots />
          </div>
          <div 
            className="text-2xl hover:text-gray-300 transition-colors cursor-pointer p-2 hover:bg-gray-700 rounded" 
            onClick={handleInfoClick}
            onMouseDown={(e) => e.preventDefault()}
          >
            <BsFillKanbanFill />
          </div>
        </div>
      )}

      <div className="flex flex-row h-screen w-full z-40">
        <div className={`${(isChatbotVisible || showInfo) ? (showSidebar ? 'w-[73%]' : 'w-3/4') :  (showSidebar ? 'w-[97%]' : 'w-full')} transition-all duration-200`}>
          <Taxonium backend={backend} config={config} />
        </div>
          <div className={`transition-all relative ${isChatbotVisible ? '' : 'hidden'} duration-200 shadow-2xl ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
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
          </div>
        <div className={`transition-all relative ${showInfo ? '' : 'hidden'} shadow-2xl bg-gray-100 duration-200 ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
            <Info backend={backend} gettingDetails={gettingDetails} setGettingDetails={setGettingDetails} setShowInfo={setShowInfo} config={config} setConfig={setConfig} selectedFileName={selectedFileName} setSelectedFileName={setSelectedFileName}/>
        </div>
      </div>
    </>
  );
}

export default App;