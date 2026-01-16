import { useState, useEffect } from 'react';
import { setGlobalControllers } from '../controllers/MyOrthographicController.js';

/**
 * Hook for managing deck.gl controller state (zoom axis and pan direction)
 * Sets up global controller callbacks for MyOrthographicController
 *
 * @returns {Object} Controller state and setters
 */
export function useDeckController() {
  const [zoomAxis, setZoomAxis] = useState('Y');
  const [panDirection, setPanDirection] = useState(null);

  // Set global controllers on mount
  useEffect(() => {
    setGlobalControllers(setZoomAxis, setPanDirection);
  }, []);

  return {
    zoomAxis,
    setZoomAxis,
    panDirection,
    setPanDirection
  };
}
