import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import Taxonium from './Taxonium.jsx'
import Chatbot from './ChatBot.jsx'
import TreeSequenceUploader from './components/TreeSequenceUploader'
import {ChatbotCloseButton, ChatbotOpenButton} from './ChatbotToggleButton.jsx'
import useConnect from './hooks/useConnect.jsx'


function App() {
    const [userName, setUserName] = useState("");
    const [isChatbotVisible, setIsChatbotVisible] = useState(true);

    const backend = useConnect();
    // const {socketRef} = useConnect();
    const {socketRef} = backend;
    
  return (
    <>
      <div className="flex flex-row w-full">
        <div className={`${isChatbotVisible ? 'w-4/5' : 'w-full'} transition-all duration-300`}>
          <Taxonium backend={backend}/>
          
        </div>

        {isChatbotVisible && (
          <div className="w-1/5 relative">
            <ChatbotCloseButton onClick={() => setIsChatbotVisible(false)} />
            <Chatbot userName={userName} socketRef={socketRef} />
          </div>
        )}
        {!isChatbotVisible && (
          <ChatbotOpenButton onClick={() => setIsChatbotVisible(true)} />
        )}
      </div>
    </>
  )
}

export default App

