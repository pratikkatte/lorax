import { useState, useEffect, useRef } from 'react'
import './App.css'
import useConfig from "./hooks/useConfig";
import useLoraxConfig from './globalconfig.js'
import useConnect from './hooks/useConnect.jsx'
import useSettings from './hooks/useSettings.jsx'
import LandingPage from "./components/LandingPage.jsx";
import useFileUpload from './hooks/useFileUpload.jsx'
import { Routes, Route } from 'react-router-dom'
import LoraxViewer from './LoraxViewer.jsx'

function App() {

  const { API_BASE } = useLoraxConfig();
  const [project, setProject] = useState();
  const ucgbMode = useRef(false);

  const { settings, setSettings } = useSettings();
  const [gettingDetails, setGettingDetails] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const backend = useConnect({ setGettingDetails, settings, statusMessage, setStatusMessage });

  const timeRef = useRef(null);

  const config = useConfig({ backend, setStatusMessage, timeRef });

  const upload = useFileUpload({
    config,
    setProject,
    backend,
    statusMessage,
    setStatusMessage
  });

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              API_BASE={API_BASE}
              upload={upload}
              statusMessage={statusMessage}
            />
          }
        />
        <Route
          path="/:file"
          element={
            <LoraxViewer
              backend={backend}
              config={config}
              settings={settings}
              setSettings={setSettings}
              project={project}
              setProject={setProject}
              ucgbMode={ucgbMode}
              statusMessage={statusMessage}
              setStatusMessage={setStatusMessage}
              loadFile={upload.loadFile}
            />

          }
        />
      </Routes>

    </>
  );
}

export default App;