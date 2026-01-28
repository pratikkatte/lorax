import React, { useState, useCallback } from "react";

/**
 * Find the tree index that contains the given position using binary search.
 * intervals is a sorted array of tree start positions.
 * Returns the index of the interval that contains the position.
 */
function findTreeIndex(intervals, position) {
  if (!intervals || intervals.length === 0) return -1;

  let low = 0;
  let high = intervals.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (intervals[mid] <= position) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

/**
 * Format search range for display
 */
function formatRange(range) {
  if (range >= 1000000) {
    return `${(range / 1000000).toFixed(1)}M bp`;
  } else if (range >= 1000) {
    return `${(range / 1000).toFixed(1)}K bp`;
  }
  return `${range} bp`;
}

export default function InfoMutations({
  // Data props from useMutations hook
  mutations = [],
  totalCount = 0,
  hasMore = false,
  isLoading = false,
  error = null,
  searchPosition = null,
  searchRange = 10000,
  isSearchMode = false,
  loadMore,
  triggerSearch,
  clearSearch,
  setSearchRange,
  // Navigation props
  intervals,
  genomeLength,
  setClickedGenomeInfo,
  setHighlightedMutationNode,
  setHighlightedMutationTreeIndex
}) {
  const [searchInput, setSearchInput] = useState("");

  // Handle click on a mutation - navigate to the tree containing this position
  const handleMutationClick = useCallback((mutation) => {
    if (!intervals || !setClickedGenomeInfo) return;

    const position = mutation.position;

    // Find the tree index for this position
    const treeIndex = findTreeIndex(intervals, position);
    if (treeIndex < 0) return;

    // Set the highlighted mutation tree index (so we can draw exactly one ring)
    if (setHighlightedMutationTreeIndex) {
      setHighlightedMutationTreeIndex(treeIndex);
    }

    // Get the start and end positions for this tree
    const start = intervals[treeIndex];
    const end = intervals[treeIndex + 1] !== undefined
      ? intervals[treeIndex + 1]
      : (genomeLength || start + 1000);

    // Trigger the zoom to this tree
    setClickedGenomeInfo({ s: start, e: end });

    // Set the highlighted mutation node
    if (setHighlightedMutationNode && mutation.node_id !== undefined) {
      setHighlightedMutationNode(String(mutation.node_id));
    }
  }, [intervals, genomeLength, setClickedGenomeInfo, setHighlightedMutationNode, setHighlightedMutationTreeIndex]);

  // Search range options (in bp)
  const rangeOptions = [
    { value: 1000, label: "1K bp" },
    { value: 5000, label: "5K bp" },
    { value: 10000, label: "10K bp" },
    { value: 50000, label: "50K bp" },
    { value: 100000, label: "100K bp" },
  ];

  // Handle search submission (placeholder)
  const handleSearch = (e) => {
    e?.preventDefault();
    const position = parseInt(searchInput.trim());
    if (!isNaN(position) && position >= 0 && triggerSearch) {
      triggerSearch(position, searchRange);
    }
  };

  // Handle clear search (placeholder)
  const handleClearSearch = () => {
    setSearchInput("");
    if (clearSearch) clearSearch();
  };

  // Handle search range change (placeholder)
  const handleRangeChange = (e) => {
    const newRange = parseInt(e.target.value);
    if (setSearchRange) setSearchRange(newRange);
  };

  // Show loading state when no mutations and loading
  if (isLoading && (!mutations || mutations.length === 0)) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
        <div className="text-gray-400 text-sm">Loading mutations...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="text-center py-6">
        <div className="text-red-400 text-sm mb-2">Error loading mutations</div>
        <div className="text-gray-400 text-xs">{error}</div>
      </div>
    );
  }

  return (
    <>
      {/* Search form */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative mb-2">
          <input
            type="text"
            placeholder="Search by position..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 pr-20 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <button
            type="submit"
            disabled={!searchInput.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-emerald-500 text-white text-xs rounded hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </div>

        {/* Search range selector */}
        <div className="flex items-center gap-2 text-sm">
          <label className="text-slate-500">Range:</label>
          <select
            value={searchRange}
            onChange={handleRangeChange}
            className="px-2 py-1 border border-slate-200 rounded text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {rangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isSearchMode && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="ml-auto text-slate-400 hover:text-slate-600 text-xs"
            >
              Clear search
            </button>
          )}
        </div>
      </form>

      {/* Search mode indicator */}
      {isSearchMode && searchPosition !== null && (
        <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
          <span className="text-emerald-700">
            Showing mutations around position <strong>{searchPosition.toLocaleString()}</strong>
          </span>
          <span className="text-emerald-500 ml-1">
            ({formatRange(searchRange)} range)
          </span>
        </div>
      )}

      {/* Stats bar */}
      <div className="mb-3 text-sm text-slate-500">
        {totalCount > 0 ? (
          <span>
            Showing {mutations.length} of {totalCount.toLocaleString()} mutation{totalCount !== 1 ? 's' : ''}
            {isSearchMode ? ' in search range' : ' in current view'}
          </span>
        ) : (
          <span>No mutations in {isSearchMode ? 'search range' : 'current view'}</span>
        )}
      </div>

      {/* Mutations list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
          {mutations.map((mutation, index) => (
            <div
              key={`${mutation.position}-${mutation.node_id}-${index}`}
              className="border-b border-slate-100 last:border-0 py-2 cursor-pointer hover:bg-emerald-50 transition-colors rounded px-2 -mx-2"
              onClick={() => handleMutationClick(mutation)}
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span className="font-semibold text-emerald-700 hover:text-emerald-900">
                    Position {mutation.position.toLocaleString()}
                  </span>
                  {isSearchMode && mutation.distance !== undefined && mutation.distance > 0 && (
                    <span className="text-xs text-slate-400">
                      {mutation.distance.toLocaleString()} bp from search
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {mutation.mutation}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5">
                    Node {mutation.node_id}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {mutations.length === 0 && !isLoading && (
            <div className="text-center py-4 text-gray-400 text-sm">
              {isSearchMode
                ? `No mutations found near position ${searchPosition?.toLocaleString()}`
                : 'No mutations in current view. Pan or zoom to see mutations.'}
            </div>
          )}

          {/* Loading indicator for pagination */}
          {isLoading && mutations.length > 0 && (
            <div className="flex items-center justify-center py-3 border-t border-slate-100">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500 mr-2"></div>
              <span className="text-sm text-slate-500">Loading more...</span>
            </div>
          )}

          {/* Load more button */}
          {hasMore && !isLoading && (
            <div className="flex items-center justify-between py-3 border-t border-slate-100 text-sm text-slate-500 sticky bottom-0 bg-white">
              <span>Showing {mutations.length} of {totalCount.toLocaleString()}</span>
              <button
                onClick={loadMore}
                className="text-emerald-500 hover:text-emerald-600 font-medium transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
