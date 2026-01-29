import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LoraxProvider } from '@lorax/core'
import App from './App.jsx'
import './index.css'

const isProd = import.meta.env.PROD;
// In the bundled single-port app, the backend is mounted under same-origin `/api`.
// Keep localhost:8080 as the default for non-prod dev usage.
const apiBase = import.meta.env.VITE_API_BASE || (isProd ? '/api' : 'http://localhost:8080');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LoraxProvider
        apiBase={apiBase}
        isProd={isProd}
        enableConfig={true}
        enableMetadataFilter={true}
      >
        <App />
      </LoraxProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
