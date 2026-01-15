import React, { createContext, useContext } from 'react';
import { useLoraxConnection } from '../hooks/useLoraxConnection.jsx';

export const LoraxContext = createContext(null);

export function LoraxProvider({ children, apiBase, isProd = false, setGettingDetails }) {
  const connection = useLoraxConnection({ apiBase, isProd, setGettingDetails });

  return (
    <LoraxContext.Provider value={connection}>
      {children}
    </LoraxContext.Provider>
  );
}

export function useLorax() {
  const context = useContext(LoraxContext);
  if (!context) {
    throw new Error('useLorax must be used within a LoraxProvider');
  }
  return context;
}
