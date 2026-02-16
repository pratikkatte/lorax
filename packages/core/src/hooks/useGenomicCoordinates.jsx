import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getGenomicCoordsFromURL, setGenomicCoordsInURL } from '../utils/urlSync.js';
import { genomicToWorld, worldToGenomic, clampGenomicCoords } from '../utils/genomeCoordinates.js';

/**
 * Hook for managing genomic coordinate state with URL synchronization.
 *
 * Handles bidirectional sync between:
 * - Genomic coordinates [startBp, endBp]
 * - deck.gl viewState (target, zoom)
 * - URL search params
 *
 * Initialization priority:
 * 1. URL params (genomiccoordstart, genomiccoordend)
 * 2. tsconfigValue (backend's initial_position)
 * 3. null (let deck.gl use default viewState)
 *
 * @param {Object} params
 * @param {{ target: [number, number], zoom: [number, number] }} params.viewState - Current deck.gl ortho viewState
 * @param {number} params.deckWidth - Deck canvas width in pixels
 * @param {number} params.globalBpPerUnit - Base pairs per world unit
 * @param {number} params.genomeLength - Total genome length in base pairs
 * @param {[number, number]} params.tsconfigValue - Backend's initial_position [startBp, endBp]
 * @param {boolean} params.enabled - Whether coordinate management is enabled
 * @param {boolean} params.isInteracting - Whether viewport interaction is active
 * @param {number} params.interactionDebounceMs - Debounce while interacting (default: 80)
 * @param {number} params.idleDebounceMs - Debounce while idle (default: 300)
 * @returns {Object} Coordinate state and methods
 */
export function useGenomicCoordinates({
  viewState,
  deckWidth,
  globalBpPerUnit,
  genomeLength,
  tsconfigValue,
  enabled = true,
  isInteracting = false,
  interactionDebounceMs = 80,
  idleDebounceMs = 300
}) {
  // Genomic coordinates state [startBp, endBp]
  const [genomicCoords, setGenomicCoordsState] = useState(null);

  // Track initialization to prevent repeated URL reads
  const isInitialized = useRef(false);

  // Store initial viewState derived from URL or tsconfig
  const initialViewStateRef = useRef(null);

  // Debounce timer for viewState → genomic sync
  const debounceTimer = useRef(null);

  const debounceMs = useMemo(() => {
    const active = Number.isFinite(interactionDebounceMs) ? interactionDebounceMs : 80;
    const idle = Number.isFinite(idleDebounceMs) ? idleDebounceMs : 300;
    return Math.max(16, isInteracting ? active : idle);
  }, [isInteracting, interactionDebounceMs, idleDebounceMs]);

  // =========================================================================
  // Initialization Effect
  // Priority: URL params > tsconfigValue > null
  // Note: Only runs once when required values become available
  // =========================================================================
  useEffect(() => {
    if (!enabled || isInitialized.current) return;
    if (!globalBpPerUnit || !deckWidth) return; // Wait for required values

    // Try URL params first
    const urlCoords = getGenomicCoordsFromURL();

    let initialCoords = null;

    if (urlCoords) {
      // URL params take precedence
      initialCoords = clampGenomicCoords(urlCoords, genomeLength);
    } else if (tsconfigValue && Array.isArray(tsconfigValue) && tsconfigValue.length === 2) {
      // Fall back to backend's initial_position
      initialCoords = clampGenomicCoords(tsconfigValue, genomeLength);
    }

    if (initialCoords) {
      // Compute initial viewState for parent to apply
      // Use default Y values (0, 8) for initialization - parent will preserve existing Y
      const viewStateUpdate = genomicToWorld(
        initialCoords,
        deckWidth,
        globalBpPerUnit,
        0,  // Default Y target (parent will merge with existing)
        8   // Default Y zoom (parent will merge with existing)
      );

      if (viewStateUpdate) {
        initialViewStateRef.current = viewStateUpdate;
        setGenomicCoordsState(initialCoords);
      }
    }

    isInitialized.current = true;
    // Intentionally not including viewState - we only want to run this once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, globalBpPerUnit, deckWidth, genomeLength, tsconfigValue]);

  // =========================================================================
  // ViewState → Genomic Sync Effect (debounced)
  // Updates genomicCoords and URL when viewState changes
  // =========================================================================
  useEffect(() => {
    if (!enabled || !isInitialized.current) return;
    if (!viewState || !deckWidth || !globalBpPerUnit) return;

    // Clear existing debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const coords = worldToGenomic(viewState, deckWidth, globalBpPerUnit);

      if (coords) {
        const clamped = clampGenomicCoords(coords, genomeLength);

        // Only update if significantly different (avoid noise)
        setGenomicCoordsState(prev => {
          if (!prev) return clamped;

          // Skip update if change is tiny (< 1bp)
          const deltaStart = Math.abs(clamped[0] - prev[0]);
          const deltaEnd = Math.abs(clamped[1] - prev[1]);
          if (deltaStart < 1 && deltaEnd < 1) return prev;

          return clamped;
        });

        // Update URL
        setGenomicCoordsInURL(clamped);
      }
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [enabled, viewState, deckWidth, globalBpPerUnit, genomeLength, debounceMs]);

  // =========================================================================
  // Programmatic Setter
  // Called by PositionSlider to update genomic coords → viewState
  // =========================================================================
  const setGenomicCoords = useCallback((coords) => {
    if (!enabled) return null;
    if (!coords || coords.length !== 2) return null;
    if (!deckWidth || !globalBpPerUnit) return null;

    const clamped = clampGenomicCoords(coords, genomeLength);

    // Update state
    setGenomicCoordsState(clamped);

    // Update URL immediately (no debounce for user action)
    setGenomicCoordsInURL(clamped);

    // Return viewState for parent to apply
    return genomicToWorld(
      clamped,
      deckWidth,
      globalBpPerUnit,
      viewState?.target?.[1] ?? 0,
      viewState?.zoom?.[1] ?? 8
    );
  }, [enabled, deckWidth, globalBpPerUnit, genomeLength, viewState]);

  // =========================================================================
  // Bound utility functions for external use
  // =========================================================================
  const genomicToWorldBound = useCallback((coords) => {
    if (!deckWidth || !globalBpPerUnit) return null;
    return genomicToWorld(
      coords,
      deckWidth,
      globalBpPerUnit,
      viewState?.target?.[1] ?? 0,
      viewState?.zoom?.[1] ?? 8
    );
  }, [deckWidth, globalBpPerUnit, viewState]);

  const worldToGenomicBound = useCallback(() => {
    if (!viewState || !deckWidth || !globalBpPerUnit) return null;
    return worldToGenomic(viewState, deckWidth, globalBpPerUnit);
  }, [viewState, deckWidth, globalBpPerUnit]);

  // =========================================================================
  // Return memoized API
  // =========================================================================
  return useMemo(() => ({
    // Current genomic coordinates [startBp, endBp] | null
    genomicCoords,

    // Set genomic coordinates programmatically, returns viewState update
    setGenomicCoords,

    // Initial viewState from URL/tsconfig (for parent to apply once)
    initialViewState: initialViewStateRef.current,

    // Bound utility functions
    genomicToWorld: genomicToWorldBound,
    worldToGenomic: worldToGenomicBound,

    // Whether the hook is ready (has required data)
    isReady: enabled && !!globalBpPerUnit && !!deckWidth
  }), [
    genomicCoords,
    setGenomicCoords,
    genomicToWorldBound,
    worldToGenomicBound,
    enabled,
    globalBpPerUnit,
    deckWidth
  ]);
}

export default useGenomicCoordinates;
