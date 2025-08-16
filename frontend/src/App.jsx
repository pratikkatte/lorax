import { useState, useEffect } from 'react'
import './App.css'
import Lorax from './Lorax.jsx'

import Info from './components/Info.jsx'
import useConfig from "./hooks/useConfig";
import useLoraxConfig from './globalconfig.js'
import useConnect from './hooks/useConnect.jsx'
import useSettings from './hooks/useSettings.jsx'
import Settings from './components/Settings.jsx'
import LandingPage from "./components/LandingPage.jsx";
import useFileUpload from './hooks/useFileUpload.jsx'
import { Routes, Route } from 'react-router-dom'
import LoraxViewer from './LoraxViewer.jsx'

function App() {
  const [userName, setUserName] = useState("");
  const [isChatbotVisible, setIsChatbotVisible] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const [chatbotEnabled, setChatbotEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gettingDetails, setGettingDetails] = useState(false);

  const {API_BASE} = useLoraxConfig();
  const {settings, setSettings} = useSettings();

  const backend = useConnect({setGettingDetails, settings});
  const {config, setConfig} = useConfig({backend});

  const upload = useFileUpload({
    config,
    setConfig,
  });


  return (
    <>
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            config={config}
            setConfig={setConfig}
            onStartDemo={async () => {
              // const demo = await fetch(`${API_BASE}/demo`).then(r=>r.json());
              // setConfig(demo);
            }}
            onOpenDocs={() => window.open("https://your-docs.example", "_blank")}
            upload={upload}
            onSelectFile={(file) => {
              console.log("Selected file:", file);
            }}
          />
        }
      />
      <Route
        path="/:file"
        element={
          <LoraxViewer
            backend={backend}
            config={config}
            setConfig={setConfig}
            settings={settings}
            setSettings={setSettings}
          />
        }
      />
      </Routes>
      
    </>
  );
}

export default App;