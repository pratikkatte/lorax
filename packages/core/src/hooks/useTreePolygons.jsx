import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  computePolygonVertices,
  isPolygonVisible,
  interpolateVertices,
  easingFunctions
} from '../utils/polygonProjection.js';

/**
 * useTreePolygons - Hook for computing and animating tree polygon overlays.
 *
 * @param {Object} options
 * @param {Map} options.localBins - Map of tree bins from useLocalData
 * @param {number} options.globalBpPerUnit - Base pairs per world unit from useLorax
 * @param {Object} options.viewState - deck.gl viewState (for triggering updates on pan/zoom)
 * @param {boolean} options.enabled - Toggle polygon computation (default: true)
 * @param {boolean} options.animate - Enable animation transitions (default: true)
 * @param {number} options.animationDuration - Animation duration in ms (default: 300)
 * @param {string} options.easing - Easing function name: 'linear'|'easeOut'|'easeInOut' (default: 'easeOut')
 * @param {Function} options.onPolygonHover - Callback when polygon is hovered
 * @param {Function} options.onPolygonClick - Callback when polygon is clicked
 *
 * @returns {Object}
 * @returns {Array} polygons - Array of { key, vertices, treeIndex, isHovered }
 * @returns {string|null} hoveredPolygon - Currently hovered polygon key
 * @returns {Function} setHoveredPolygon - Set hovered polygon key
 * @returns {boolean} isReady - True when viewports are cached and polygons can be computed
 * @returns {Function} _cacheViewports - Call from onAfterRender with deck instance
 */
export function useTreePolygons({
  localBins,
  globalBpPerUnit,
  viewState,
  enabled = true,
  animate = true,
  animationDuration = 300,
  easing = 'easeOut',
  onPolygonHover,
  onPolygonClick
} = {}) {
  // Cached viewports from deck.gl
  const viewportsRef = useRef({ ortho: null, genomeInfo: null });

  // Animation state
  const animationRef = useRef({
    startTime: null,
    startPolygons: null,
    targetPolygons: null,
    rafId: null
  });

  // Computed polygon state
  const [polygons, setPolygons] = useState([]);
  const [hoveredPolygon, setHoveredPolygonInternal] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Get easing function
  const easingFn = useMemo(() => {
    return easingFunctions[easing] || easingFunctions.easeOut;
  }, [easing]);

  // Store values in refs to avoid stale closures
  const localBinsRef = useRef(localBins);
  const globalBpPerUnitRef = useRef(globalBpPerUnit);
  const hoveredPolygonRef = useRef(hoveredPolygon);
  const enabledRef = useRef(enabled);
  const polygonsRef = useRef(polygons);

  useEffect(() => { localBinsRef.current = localBins; }, [localBins]);
  useEffect(() => { globalBpPerUnitRef.current = globalBpPerUnit; }, [globalBpPerUnit]);
  useEffect(() => { hoveredPolygonRef.current = hoveredPolygon; }, [hoveredPolygon]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { polygonsRef.current = polygons; }, [polygons]);

  /**
   * Compute target polygon vertices from current bins and viewports
   */
  const computeTargetPolygons = useCallback(() => {
    const { ortho, genomeInfo } = viewportsRef.current;
    const bins = localBinsRef.current;
    const bpPerUnit = globalBpPerUnitRef.current;
    const hovered = hoveredPolygonRef.current;

    if (!bins || !(bins instanceof Map) || !ortho || !genomeInfo || !bpPerUnit) {
      return [];
    }

    const width = ortho.width || 0;
    const height = ortho.height || 0;
    const result = [];

    for (const [key, bin] of bins) {
      const vertices = computePolygonVertices(bin, genomeInfo, ortho, bpPerUnit);
      if (vertices && isPolygonVisible(vertices, width, height)) {
        result.push({
          key,
          vertices,
          treeIndex: bin.global_index,
          isHovered: key === hovered
        });
      }
    }

    return result;
  }, []);

  /**
   * Animation loop using requestAnimationFrame
   */
  const runAnimation = useCallback(() => {
    const { startTime, startPolygons, targetPolygons } = animationRef.current;

    if (!startTime || !targetPolygons) {
      setPolygons(targetPolygons || []);
      return;
    }

    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    const easedProgress = easingFn(progress);

    // Interpolate each polygon
    const interpolated = targetPolygons.map(target => {
      const start = startPolygons?.find(p => p.key === target.key);
      if (start) {
        return {
          ...target,
          vertices: interpolateVertices(start.vertices, target.vertices, easedProgress)
        };
      }
      return target;
    });

    setPolygons(interpolated);

    if (progress < 1) {
      animationRef.current.rafId = requestAnimationFrame(runAnimation);
    } else {
      // Animation complete
      animationRef.current = {
        startTime: null,
        startPolygons: null,
        targetPolygons: null,
        rafId: null
      };
    }
  }, [animationDuration, easingFn]);

  /**
   * Update polygons - with or without animation
   */
  const updatePolygons = useCallback((forceNoAnimation = false) => {
    if (!enabledRef.current) {
      setPolygons([]);
      return;
    }

    const targetPolygons = computeTargetPolygons();
    const currentPolygons = polygonsRef.current;

    if (forceNoAnimation || !animate || currentPolygons.length === 0) {
      // No animation - instant update
      setPolygons(targetPolygons);
      return;
    }

    // Cancel any running animation
    if (animationRef.current.rafId) {
      cancelAnimationFrame(animationRef.current.rafId);
    }

    // Start new animation
    animationRef.current = {
      startTime: performance.now(),
      startPolygons: currentPolygons,
      targetPolygons,
      rafId: null
    };

    animationRef.current.rafId = requestAnimationFrame(runAnimation);
  }, [animate, computeTargetPolygons, runAnimation]);

  /**
   * Cache viewports - call from onAfterRender
   * Only caches viewport refs, does NOT trigger state updates to avoid render loops
   * Polygon updates are triggered by localBins changes instead
   */
  const _cacheViewports = useCallback((deckInstance) => {
    if (!deckInstance || !enabledRef.current) return;

    try {
      const viewports = deckInstance.getViewports();
      const orthoVP = viewports?.find(v => v.id === 'ortho');
      const genomeVP = viewports?.find(v => v.id === 'genome-info');

      if (orthoVP && genomeVP) {
        // Update viewport refs (no state update to avoid loops)
        viewportsRef.current = { ortho: orthoVP, genomeInfo: genomeVP };

        // Set isReady on first successful cache (this is the only state update)
        if (!isReady) {
          setIsReady(true);
        }
      }
    } catch (e) {
      // Deck may not be ready yet
    }
  }, [isReady]);

  /**
   * Handle hover with callback
   */
  const setHoveredPolygon = useCallback((key) => {
    setHoveredPolygonInternal(key);
    onPolygonHover?.(key);
  }, [onPolygonHover]);

  // Update polygons when bins change (with animation for bin changes)
  useEffect(() => {
    if (!enabled || !isReady) return;
    updatePolygons(false);
  }, [localBins, enabled, isReady, updatePolygons]);

  // Update polygons when viewState changes (instant update for pan/zoom)
  // Use a simple key derived from viewState to detect changes
  const viewStateKey = useMemo(() => {
    if (!viewState?.ortho) return null;
    const { target, zoom } = viewState.ortho;
    const t0 = target?.[0]?.toFixed?.(2) ?? '0';
    const t1 = target?.[1]?.toFixed?.(2) ?? '0';
    const z0 = Array.isArray(zoom) ? zoom[0]?.toFixed?.(2) : zoom?.toFixed?.(2);
    const z1 = Array.isArray(zoom) ? zoom[1]?.toFixed?.(2) : z0;
    return `${t0}-${t1}-${z0}-${z1}`;
  }, [viewState?.ortho?.target?.[0], viewState?.ortho?.target?.[1], viewState?.ortho?.zoom]);

  useEffect(() => {
    if (!enabled || !isReady || !viewStateKey) return;
    // Instant update for viewport changes (no animation)
    updatePolygons(true);
  }, [viewStateKey, enabled, isReady, updatePolygons]);

  // Update hover state in polygons
  useEffect(() => {
    setPolygons(prev => prev.map(p => ({
      ...p,
      isHovered: p.key === hoveredPolygon
    })));
  }, [hoveredPolygon]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current.rafId) {
        cancelAnimationFrame(animationRef.current.rafId);
      }
    };
  }, []);

  return {
    polygons,
    hoveredPolygon,
    setHoveredPolygon,
    isReady,
    _cacheViewports
  };
}

export default useTreePolygons;
