import React, { useState, useEffect, useCallback } from "react";

const ITEMS_PER_PAGE = 100;

export default function InfoFilter({
  searchTerm,
  setSearchTerm,
  searchTags,
  setSearchTags,
  selectedColorBy,
  setSelectedColorBy,
  coloryby,
  metadataColors,
  enabledValues,
  setEnabledValues,
  visibleTrees,
  treeColors,
  setTreeColors,
  settings,
  setSettings
}) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Reset visible count when search or colorBy changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchTerm, selectedColorBy]);

  // Get filtered items
  const getFilteredItems = useCallback(() => {
    if (!metadataColors || !selectedColorBy || !metadataColors[selectedColorBy]) {
      return [];
    }
    const valueToColor = metadataColors[selectedColorBy];
    let items = Object.entries(valueToColor);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(([val]) => val.toLowerCase().includes(term));
    }
    return items;
  }, [metadataColors, selectedColorBy, searchTerm]);

  const allItems = getFilteredItems();
  const displayItems = allItems.slice(0, visibleCount);
  const hasMore = visibleCount < allItems.length;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm font-medium">Search</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Display Lineages</span>
          <button
            type="button"
            className={`w-4 h-4 rounded-full border-2 transition-colors ${settings?.display_lineage_paths
              ? 'bg-gray-700 border-gray-700'
              : 'bg-white border-gray-400'
              }`}
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                display_lineage_paths: !prev?.display_lineage_paths
              }));
            }}
            title="Display Lineage Paths"
          />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-stretch border border-gray-300 rounded-md overflow-hidden">
          <div className="flex items-center justify-center px-3 border-r border-gray-300 bg-gray-50">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              checked={enabledValues && enabledValues.size > 0}
              onChange={(e) => {
                if (e.target.checked && metadataColors && selectedColorBy && metadataColors[selectedColorBy]) {
                  setEnabledValues(new Set(Object.keys(metadataColors[selectedColorBy])));
                } else {
                  setEnabledValues(new Set());
                }
              }}
            />
          </div>
          <select
            className="px-3 py-2 text-sm text-gray-700 bg-white border-r border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
            value={selectedColorBy || ""}
            onChange={(e) => setSelectedColorBy(e.target.value)}
          >
            {Object.entries(coloryby).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search..."
            className="flex-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm || ""}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const term = searchTerm.trim();
                if (term && !searchTags.includes(term)) {
                  setSearchTags(prev => [...prev, term]);
                  setSearchTerm("");
                }
              }
            }}
          />
        </div>
        {searchTags && searchTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {searchTags.map((tag, index) => {
              // Get the assigned color for this tag from metadataColors
              const tagColor = metadataColors && selectedColorBy && metadataColors[selectedColorBy]
                ? metadataColors[selectedColorBy][tag]
                : null;

              // Create background and text colors based on assigned color
              const bgStyle = tagColor
                ? { backgroundColor: `rgba(${tagColor[0]}, ${tagColor[1]}, ${tagColor[2]}, 0.25)` }
                : {};
              const textStyle = tagColor
                ? { color: `rgb(${Math.max(0, tagColor[0] - 40)}, ${Math.max(0, tagColor[1] - 40)}, ${Math.max(0, tagColor[2] - 40)})` }
                : {};
              const btnStyle = tagColor
                ? { color: `rgb(${Math.max(0, tagColor[0] - 20)}, ${Math.max(0, tagColor[1] - 20)}, ${Math.max(0, tagColor[2] - 20)})` }
                : {};

              return (
                <div
                  key={index}
                  className={`flex items-center text-xs font-medium px-2 py-0.5 rounded ${!tagColor ? 'bg-blue-100 text-blue-800' : ''}`}
                  style={tagColor ? { ...bgStyle, ...textStyle } : {}}
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    className={`ml-1 focus:outline-none ${!tagColor ? 'text-blue-600 hover:text-blue-800' : 'hover:opacity-70'}`}
                    style={tagColor ? btnStyle : {}}
                    onClick={() => {
                      setSearchTags(prev => prev.filter((_, i) => i !== index));
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="max-h-64 overflow-auto border border-gray-200 rounded-md divide-y divide-gray-100">
          {allItems.length > 0 ? (
            <>
              {displayItems.map(([val, color]) => {
                const isEnabled = enabledValues.has(val);
                return (
                  <div
                    key={val}
                    className="group relative w-full flex items-center hover:bg-gray-50 transition-colors"
                  >
                    <button
                      type="button"
                      className={`flex-1 flex items-center px-2 py-1 text-left ${isEnabled ? '' : 'opacity-40'}`}
                      onClick={() => {
                        setEnabledValues(prev => {
                          const next = new Set(prev);
                          if (next.has(val)) next.delete(val);
                          else next.add(val);
                          return next;
                        });
                      }}
                    >
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2 border border-gray-200 flex-shrink-0"
                        style={{ backgroundColor: Array.isArray(color) ? `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})` : undefined }}
                      />
                      <span className="text-sm text-gray-800 truncate">{val}</span>
                    </button>

                    {/* Hover Actions */}
                    <div className="hidden group-hover:flex items-center gap-1 absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 shadow-sm border border-gray-200 rounded px-1 py-0.5">
                      <button
                        type="button"
                        className="p-1 text-gray-500 hover:text-blue-600 rounded focus:outline-none"
                        title="Search"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!searchTags.includes(val)) {
                            setSearchTags(prev => [...prev, val]);
                          }
                        }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`p-1 text-gray-500 rounded focus:outline-none ${isEnabled ? 'hover:text-red-600' : 'hover:text-green-600'}`}
                        title={isEnabled ? "Remove" : "Add"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEnabledValues(prev => {
                            const next = new Set(prev);
                            if (isEnabled) {
                              next.delete(val);
                            } else {
                              next.add(val);
                            }
                            return next;
                          });
                        }}
                      >
                        {isEnabled ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <div className="px-2 py-2 flex items-center justify-between bg-gray-50 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    Showing {displayItems.length} of {allItems.length}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          ) : metadataColors && selectedColorBy ? (
            <div className="px-2 py-2 text-sm text-gray-500">No values found</div>
          ) : (
            <div className="px-2 py-2 text-sm text-gray-500">No metadata available</div>
          )}
        </div>
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Trees</h3>
          <div className="max-h-64 overflow-auto border border-gray-100 rounded-md divide-y divide-gray-100">
            {visibleTrees && visibleTrees.length > 0 ? (
              visibleTrees.map(treeIndex => (
                <div key={treeIndex} className="flex items-center justify-between px-2 py-1">
                  <span className="text-sm text-gray-800">Tree {treeIndex}</span>
                  <div className="flex items-center">
                    <input
                      type="color"
                      className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                      value={treeColors[treeIndex] || "#000000"}
                      onChange={(e) => {
                        console.log("Color picker change", treeIndex, e.target.value);
                        if (setTreeColors) {
                          setTreeColors(prev => {
                            const newState = { ...prev, [String(treeIndex)]: e.target.value };
                            console.log("New treeColors state:", newState);
                            return newState;
                          });
                        } else {
                          console.error("setTreeColors is missing");
                        }
                      }}
                    />
                    {treeColors[treeIndex] && (
                      <button
                        className="ml-2 text-xs text-gray-500 hover:text-red-500"
                        onClick={() => {
                          if (setTreeColors) {
                            setTreeColors(prev => {
                              const next = { ...prev };
                              delete next[treeIndex];
                              return next;
                            });
                          }
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-2 py-2 text-sm text-gray-500">No visible trees</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
