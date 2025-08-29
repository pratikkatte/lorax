import { useState, useEffect, useRef } from 'react'
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
import { Routes, Route, useSearchParams, useParams } from 'react-router-dom'
import LoraxViewer from './LoraxViewer.jsx'
import axios from 'axios';

function App() {

  const {API_BASE} = useLoraxConfig();
  const [project, setProject] = useState();
  const ucgbMode = useRef(false);


  const {settings, setSettings} = useSettings();
  const [gettingDetails, setGettingDetails] = useState(false);
  const backend = useConnect({setGettingDetails, settings});
  const {config, setConfig} = useConfig({backend});

  const upload = useFileUpload({
    config,
    setConfig,
    setProject,
  });

  return (
    <>
    <Routes>
      {/* <Route path="/:filename" element={<Trees />} /> */}
      <Route
        path="/"
        element={
          <LandingPage
            API_BASE={API_BASE}
            upload={upload}
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
            project={project}
            setProject={setProject}
            ucgbMode={ucgbMode}
            
          />
        }
      />
      </Routes>
      
    </>
  );
}

export default App;