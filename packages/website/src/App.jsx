import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import FileView from './components/FileView';
import useFileUpload from './hooks/useFileUpload';
import './index.css';

function App() {
  const [statusMessage, setStatusMessage] = useState(null);

  const upload = useFileUpload({
    statusMessage,
    setStatusMessage
  });

  return (
    <Routes>
      <Route path="/" element={<LandingPage upload={upload} />} />
      <Route path="/:file" element={<FileView />} />
    </Routes>
  );
}

export default App;
