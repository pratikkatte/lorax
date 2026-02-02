import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import FileView from './components/FileView';
import useFileUpload from './hooks/useFileUpload';
import UcgbRedirect from './components/UcgbRedirect';
import './index.css';

function LegacyFileRedirect() {
  const { file } = useParams();
  const location = useLocation();
  const search = location.search || '';

  if (!file) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={`/view/${encodeURIComponent(file)}${search}`} replace />;
}

function App() {
  const [statusMessage, setStatusMessage] = useState(null);

  const upload = useFileUpload({
    statusMessage,
    setStatusMessage
  });

  return (
    <Routes>
      <Route path="/" element={<LandingPage upload={upload} />} />
      <Route path="/view/:file" element={<FileView />} />
      <Route path="/ucgb" element={<UcgbRedirect />} />
      <Route path="/:file" element={<LegacyFileRedirect />} />
    </Routes>
  );
}

export default App;
