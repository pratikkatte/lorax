import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_VIEW_CONFIG } from '@lorax/core';

const STORAGE_KEY = 'lorax-viewport-dimensions';

const DEFAULT_VIEWPORT = {
  top: '1%',
  left: '5%',
  width: '95%',
  height: '85%'
};

/**
 * Hook for managing viewport and view dimensions with localStorage persistence
 *
 * @returns {Object} Dimension state and update functions
 */
export function useViewportDimensions() {
  const [dimensions, setDimensions] = useState(() => {
    // TEMP: Force clear localStorage to use new defaults
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }

    return {
      viewport: DEFAULT_VIEWPORT,
      views: { ...DEFAULT_VIEW_CONFIG }
    };
  });

  // Persist to localStorage whenever dimensions change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dimensions));
    }
  }, [dimensions]);

  /**
   * Update the main viewport container dimensions
   */
  const updateViewport = useCallback((newDimensions) => {
    setDimensions(prev => ({
      ...prev,
      viewport: { ...prev.viewport, ...newDimensions }
    }));
  }, []);

  /**
   * Update a specific view's dimensions
   * @param {string} viewKey - One of: 'ortho', 'genomeInfo', 'genomePositions', 'treeTime'
   * @param {Object} newDimensions - Partial dimensions to update
   */
  const updateView = useCallback((viewKey, newDimensions) => {
    console.log('updateView called:', viewKey, newDimensions);
    setDimensions(prev => {
      const updated = {
        ...prev,
        views: {
          ...prev.views,
          [viewKey]: { ...prev.views[viewKey], ...newDimensions }
        }
      };
      console.log('Updated dimensions:', updated.views);
      return updated;
    });
  }, []);

  /**
   * Reset all dimensions to defaults
   */
  const resetToDefaults = useCallback(() => {
    setDimensions({
      viewport: DEFAULT_VIEWPORT,
      views: { ...DEFAULT_VIEW_CONFIG }
    });
  }, []);

  return {
    viewport: dimensions.viewport,
    views: dimensions.views,
    updateViewport,
    updateView,
    resetToDefaults
  };
}
