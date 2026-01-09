import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { debounce } from "lodash";

const DEBOUNCE_DELAY = 300; // ms
const DEFAULT_LIMIT = 1000;
const DEFAULT_SEARCH_RANGE = 5000; // bp

/**
 * Hook for managing mutation data fetching and state.
 * Supports automatic viewport-based fetching with debounce,
 * position search with configurable range, and pagination.
 *
 * @param {Object} options
 * @param {Array} options.genomicValues - Current genomic window [start, end]
 * @param {Function} options.queryMutationsWindow - Function to fetch mutations in window
 * @param {Function} options.searchMutations - Function to search mutations by position
 * @param {boolean} options.isConnected - Whether socket is connected
 */
function useMutations({
  genomicValues,
  queryMutationsWindow,
  searchMutations,
  isConnected
}) {
  // Mutation data state
  const [mutations, setMutations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search state
  const [searchPosition, setSearchPosition] = useState(null);
  const [searchRange, setSearchRange] = useState(DEFAULT_SEARCH_RANGE);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Pagination state
  const [offset, setOffset] = useState(0);

  // Track current request to avoid race conditions
  const currentRequestRef = useRef(null);

  // Track last fetched window to avoid duplicate requests
  const lastFetchedWindowRef = useRef(null);

  /**
   * Fetch mutations for the current genomic window
   */
  const fetchMutationsForWindow = useCallback(async (start, end, offsetVal = 0, append = false) => {
    if (!queryMutationsWindow || !isConnected) return;

    // Skip if same window and offset
    const windowKey = `${start}-${end}-${offsetVal}`;
    if (!append && lastFetchedWindowRef.current === windowKey) {
      return;
    }

    const requestId = Date.now();
    currentRequestRef.current = requestId;

    setIsLoading(true);
    setError(null);

    try {
      const result = await queryMutationsWindow(start, end, offsetVal, DEFAULT_LIMIT);

      // Check if this is still the current request
      if (currentRequestRef.current !== requestId) return;

      lastFetchedWindowRef.current = windowKey;

      if (append) {
        setMutations(prev => [...prev, ...result.mutations]);
      } else {
        setMutations(result.mutations);
      }
      setTotalCount(result.total_count);
      setHasMore(result.has_more);
      setOffset(offsetVal + result.mutations.length);
    } catch (err) {
      if (currentRequestRef.current === requestId) {
        setError(err.message);
        console.error("Error fetching mutations:", err);
      }
    } finally {
      if (currentRequestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [queryMutationsWindow, isConnected]);

  /**
   * Search mutations around a position
   */
  const searchMutationsByPosition = useCallback(async (position, range, offsetVal = 0, append = false) => {
    if (!searchMutations || !isConnected || position === null) return;

    const requestId = Date.now();
    currentRequestRef.current = requestId;

    setIsLoading(true);
    setError(null);
    setIsSearchMode(true);

    try {
      const result = await searchMutations(position, range, offsetVal, DEFAULT_LIMIT);

      // Check if this is still the current request
      if (currentRequestRef.current !== requestId) return;

      if (append) {
        setMutations(prev => [...prev, ...result.mutations]);
      } else {
        setMutations(result.mutations);
      }
      setTotalCount(result.total_count);
      setHasMore(result.has_more);
      setOffset(offsetVal + result.mutations.length);
    } catch (err) {
      if (currentRequestRef.current === requestId) {
        setError(err.message);
        console.error("Error searching mutations:", err);
      }
    } finally {
      if (currentRequestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [searchMutations, isConnected]);

  /**
   * Debounced fetch for viewport changes
   */
  const debouncedFetch = useMemo(
    () => debounce((start, end) => {
      // Clear search mode when viewport changes
      if (isSearchMode) {
        setIsSearchMode(false);
        setSearchPosition(null);
      }
      fetchMutationsForWindow(start, end, 0, false);
    }, DEBOUNCE_DELAY),
    [fetchMutationsForWindow, isSearchMode]
  );

  /**
   * Effect to fetch mutations when genomic window changes
   */
  useEffect(() => {
    if (!genomicValues || !Array.isArray(genomicValues) || genomicValues.length < 2) {
      return;
    }

    const [start, end] = genomicValues;
    if (start === undefined || end === undefined || start >= end) {
      return;
    }

    // Don't auto-fetch if in search mode
    if (isSearchMode) {
      return;
    }

    debouncedFetch(start, end);

    return () => {
      debouncedFetch.cancel();
    };
  }, [genomicValues, debouncedFetch, isSearchMode]);

  /**
   * Load more mutations (pagination)
   */
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;

    if (isSearchMode && searchPosition !== null) {
      searchMutationsByPosition(searchPosition, searchRange, offset, true);
    } else if (genomicValues && genomicValues.length >= 2) {
      const [start, end] = genomicValues;
      fetchMutationsForWindow(start, end, offset, true);
    }
  }, [
    hasMore,
    isLoading,
    isSearchMode,
    searchPosition,
    searchRange,
    offset,
    genomicValues,
    fetchMutationsForWindow,
    searchMutationsByPosition
  ]);

  /**
   * Trigger search by position
   */
  const triggerSearch = useCallback((position, range = searchRange) => {
    if (position === null || position === undefined) {
      // Clear search and return to viewport mode
      setIsSearchMode(false);
      setSearchPosition(null);
      setOffset(0);
      lastFetchedWindowRef.current = null; // Force refetch
      if (genomicValues && genomicValues.length >= 2) {
        const [start, end] = genomicValues;
        fetchMutationsForWindow(start, end, 0, false);
      }
      return;
    }

    setSearchPosition(position);
    setSearchRange(range);
    setOffset(0);
    searchMutationsByPosition(position, range, 0, false);
  }, [searchRange, genomicValues, fetchMutationsForWindow, searchMutationsByPosition]);

  /**
   * Clear search and return to viewport mode
   */
  const clearSearch = useCallback(() => {
    setIsSearchMode(false);
    setSearchPosition(null);
    setOffset(0);
    lastFetchedWindowRef.current = null;

    if (genomicValues && genomicValues.length >= 2) {
      const [start, end] = genomicValues;
      fetchMutationsForWindow(start, end, 0, false);
    }
  }, [genomicValues, fetchMutationsForWindow]);

  /**
   * Refresh current data
   */
  const refresh = useCallback(() => {
    setOffset(0);
    lastFetchedWindowRef.current = null;

    if (isSearchMode && searchPosition !== null) {
      searchMutationsByPosition(searchPosition, searchRange, 0, false);
    } else if (genomicValues && genomicValues.length >= 2) {
      const [start, end] = genomicValues;
      fetchMutationsForWindow(start, end, 0, false);
    }
  }, [
    isSearchMode,
    searchPosition,
    searchRange,
    genomicValues,
    fetchMutationsForWindow,
    searchMutationsByPosition
  ]);

  return {
    // Data
    mutations,
    totalCount,
    hasMore,
    isLoading,
    error,

    // Search state
    searchPosition,
    searchRange,
    isSearchMode,

    // Actions
    loadMore,
    triggerSearch,
    clearSearch,
    refresh,
    setSearchRange,
  };
}

export default useMutations;
