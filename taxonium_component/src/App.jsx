import { useState, useEffect } from 'react'
import './App.css'
import Taxonium from './Taxonium.jsx'
import Chatbot from './ChatBot.jsx'
import { BsChatDots } from "react-icons/bs";
import { BsFillKanbanFill } from "react-icons/bs";
import Info from './components/Info.jsx'
import useConfig from "./hooks/useConfig";

import useConnect from './hooks/useConnect.jsx'

function App() {
  const [userName, setUserName] = useState("");
  const [isChatbotVisible, setIsChatbotVisible] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [gettingDetails, setGettingDetails] = useState(false);
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


  return (
    <>
      {/* Hover-sensitive area */}
      <div
        className="fixed top-0 right-0 h-full w-5 z-[100] pointer-events-auto"
        onMouseEnter={() => setShowSidebar(true)}
      />

      {/* Sidebar */}
      {showSidebar && (
        <div
          className="fixed top-0 right-0 h-full w-10 bg-gray-800 text-white z-[101] p-3 shadow-lg flex flex-col items-center space-y-6"
          onMouseLeave={(e) => {
            setShowSidebar(false);
          }}
        >
          <div 
            className="text-2xl hover:text-gray-300 transition-colors cursor-pointer p-2 hover:bg-gray-700 rounded" 
            onClick={handleChatClick}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus issues
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

      {/* Main UI - lower z-index */}
      <div className="flex flex-row h-screen w-full z-40">
        {/* Main Panel */}
        <div className={`${(isChatbotVisible || showInfo) ? (showSidebar ? 'w-[73%]' : 'w-3/4') : 'w-full'} transition-all duration-200`}>
          <Taxonium backend={backend} config={config} />
        </div>

        {/* Chatbot */}
        {isChatbotVisible && (
          <div className={`transition-all relative duration-200 shadow-2xl ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
            <Chatbot userName={userName} backend={backend} config={config} setConfig={setConfig}/>
          </div>
        )}
        <div className={`transition-all ${showInfo ? '' : 'hidden'} shadow-2xl bg-gray-100 duration-200 ${showSidebar ? 'w-[25%]' : 'w-1/4'}`}>
            <Info backend={backend} gettingDetails={gettingDetails} setGettingDetails={setGettingDetails} setShowInfo={setShowInfo}/>
          </div>
        
      </div>
    </>
  );
}

export default App;