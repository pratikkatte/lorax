import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import useFileUpload from './hooks/useFileUpload';
import './index.css';

function App() {
  const [statusMessage, setStatusMessage] = useState(null);

  const upload = useFileUpload({
    statusMessage,
    setStatusMessage
  });

  return (
    <LandingPage upload={upload} />
  );
}

export default App;
