import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LoraxProvider } from '@lorax/core'
import App from './App.jsx'
import { apiBase, isProd } from './config/runtime.js'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import './index.css'

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
