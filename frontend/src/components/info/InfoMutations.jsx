import React, { useState, useMemo, useRef, useCallback } from "react";

const ITEMS_PER_PAGE = 100; // Load 100 items at a time

export default function InfoMutations({ mutationsByPosition, sortedPositions, changeViewRef }) {
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

    // Handle click on mutation to navigate to that position
    const handleMutationClick = useCallback((position) => {
        if (changeViewRef?.current) {
            changeViewRef.current([position - 200, position + 200]);
        }
    }, [changeViewRef]);

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
                                className="border-b border-slate-100 last:border-0 py-2 cursor-pointer hover:bg-slate-50 transition-colors rounded px-1 -mx-1"
                                onClick={() => handleMutationClick(position)}
                            >
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-semibold text-emerald-700">
                                        Position {position.toLocaleString()}
                                    </span>
                                    <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                        {mutation}
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
