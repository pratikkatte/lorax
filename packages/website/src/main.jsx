import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LoraxProvider } from '@lorax/core'
import App from './App.jsx'
import './index.css'

const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const isProd = import.meta.env.PROD;

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
