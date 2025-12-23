import React, { useState, useMemo, useRef, useCallback } from "react";

const ITEMS_PER_PAGE = 100; // Load 100 items at a time

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

export default function InfoMutations({ mutationsByPosition, sortedPositions, intervals, genomeLength, setClickedGenomeInfo, setHighlightedMutationNode }) {
    const [searchPosition, setSearchPosition] = useState("");
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
    const [showLoadMore, setShowLoadMore] = useState(false);
    const scrollContainerRef = useRef(null);

    // Filter and sort positions based on search - find positions around the searched number
    const filteredPositions = useMemo(() => {
        if (!searchPosition.trim()) {
            return sortedPositions;
        }

        const searchNum = parseInt(searchPosition.trim());
        if (isNaN(searchNum)) {
            return sortedPositions;
        }

        // Sort by distance from search number, showing closest positions first
        return [...sortedPositions].sort((a, b) => {
            return Math.abs(a - searchNum) - Math.abs(b - searchNum);
        });
    }, [sortedPositions, searchPosition]);

    // Reset display count when search changes
    React.useEffect(() => {
        setDisplayCount(ITEMS_PER_PAGE);
        setShowLoadMore(false);
    }, [searchPosition]);

    // Limit displayed items
    const displayedPositions = useMemo(() => {
        return filteredPositions.slice(0, displayCount);
    }, [filteredPositions, displayCount]);

    const hasMore = filteredPositions.length > displayCount;

    const handleLoadMore = () => {
        setDisplayCount(prev => prev + ITEMS_PER_PAGE);
        setShowLoadMore(false);
    };

    // Handle scroll to detect when user reaches bottom
    const handleScroll = useCallback((e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
        setShowLoadMore(isNearBottom && hasMore);
    }, [hasMore]);

    // Handle click on a mutation position - navigate to the tree containing this position
    const handlePositionClick = useCallback((position) => {
        if (!intervals || !setClickedGenomeInfo) return;

        // Find the tree index for this position
        const treeIndex = findTreeIndex(intervals, position);
        if (treeIndex < 0) return;

        // Get the start and end positions for this tree
        const start = intervals[treeIndex];
        const end = intervals[treeIndex + 1] !== undefined
            ? intervals[treeIndex + 1]
            : (genomeLength || start + 1000);

        // Trigger the zoom to this tree
        setClickedGenomeInfo({ s: start, e: end });

        // Set the highlighted mutation node (using node ID from mutation data)
        if (setHighlightedMutationNode) {
            const mutationData = mutationsByPosition[position];
            // If mutation data is an object with node, use it; otherwise use node ID string
            const nodeId = typeof mutationData === 'object' && mutationData.node !== undefined
                ? String(mutationData.node)
                : null;

            setHighlightedMutationNode(nodeId);
        }
    }, [intervals, genomeLength, setClickedGenomeInfo, setHighlightedMutationNode, mutationsByPosition]);

    if (!sortedPositions || sortedPositions.length === 0) {
        return (
            <div className="text-center py-6">
                <div className="text-gray-400 text-base">
                    No mutations data available
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Search input */}
            <div className="mb-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search by position..."
                        value={searchPosition}
                        onChange={(e) => setSearchPosition(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
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
                    {searchPosition && (
                        <button
                            onClick={() => setSearchPosition("")}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Mutations list by position */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="max-h-[500px] overflow-y-auto custom-scrollbar"
                >
                    {displayedPositions.map((position) => {
                        const mutation = mutationsByPosition[position];

                        return (
                            <div
                                key={position}
                                className="border-b border-slate-100 last:border-0 py-2 cursor-pointer hover:bg-emerald-50 transition-colors rounded px-2 -mx-2"
                                onClick={() => handlePositionClick(position)}
                            >
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-semibold text-emerald-700 hover:text-emerald-900">
                                        Position {position.toLocaleString()}
                                    </span>
                                    <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                        {typeof mutation === 'object' ? mutation.mutation : mutation}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {displayedPositions.length === 0 && (
                        <div className="text-center py-4 text-gray-400 text-sm">
                            No mutations match position "{searchPosition}"
                        </div>
                    )}

                    {/* Show Load more only when scrolled to bottom */}
                    {showLoadMore && (
                        <div className="flex items-center justify-between py-3 border-t border-slate-100 text-sm text-slate-500 sticky bottom-0 bg-white">
                            <span>Showing {displayedPositions.length} of {filteredPositions.length}</span>
                            <button
                                onClick={handleLoadMore}
                                className="text-blue-500 hover:text-blue-600 font-medium transition-colors"
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
