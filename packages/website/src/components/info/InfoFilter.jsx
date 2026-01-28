import React, { useState, useCallback } from "react";
import { useLorax } from "@lorax/core";

const ITEMS_PER_PAGE = 100;

// Helper to convert RGBA array to hex color
const rgbaToHex = (rgba) => {
  if (!Array.isArray(rgba)) return '#969696';
  const [r, g, b] = rgba;
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

// Helper to convert hex color to RGB array
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [150, 150, 150];
};

export default function InfoFilter({
  // FileView-specific props (not available via useLorax)
  visibleTrees = [],
  treeColors = {},
  setTreeColors,
  colorByTree = false,
  setColorByTree,
  hoveredTreeIndex = null,
  setHoveredTreeIndex
}) {
  // Get filter state from context (via useMetadataFilter in LoraxProvider)
  const {
    tsconfig,
    searchTerm = "",
    setSearchTerm,
    searchTags = [],
    setSearchTags,
    selectedColorBy = null,
    setSelectedColorBy,
    coloryby = {},
    metadataColors = {},
    setMetadataColors,
    enabledValues = new Set(),
    setEnabledValues,
    highlightedMetadataValue = null,
    setHighlightedMetadataValue,
    displayLineagePaths = false,
    setDisplayLineagePaths
  } = useLorax();
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isTreesExpanded, setIsTreesExpanded] = useState(true);

  const isCsvFile = Boolean(
    String(tsconfig?.filename || '').toLowerCase().endsWith('.csv') || tsconfig?.tree_info
  );

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

  // Debug: verify component is rendering with updated code
  console.log('[InfoFilter] Rendering, items:', displayItems.length, 'hasSetHighlight:', !!setHighlightedMetadataValue);

  return (
    <div
      className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-3"
      onClick={(e) => console.log('[InfoFilter] Main container clicked, target:', e.target.tagName, 'class:', e.target.className?.slice?.(0, 50) || e.target.className)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm font-medium">Search</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Display Lineages</span>
            <button
              type="button"
              className={`w-4 h-4 rounded-full border-2 transition-colors ${displayLineagePaths
                ? 'bg-gray-700 border-gray-700'
                : 'bg-white border-gray-400'
              }`}
              onClick={() => {
                if (setDisplayLineagePaths) {
                  setDisplayLineagePaths(prev => !prev);
                }
              }}
              title="Display Lineage Paths"
            />
          </div>
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
                if (!setEnabledValues) return;
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
            onChange={(e) => {
              if (setSelectedColorBy) setSelectedColorBy(e.target.value);
              if (setSearchTerm) setSearchTerm("");
              if (setSearchTags) setSearchTags([]);
            }}
          >
            {Object.keys(coloryby).length === 0 ? (
              <option value="">No metadata available</option>
            ) : (
              Object.entries(coloryby).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))
            )}
          </select>
          <input
            type="text"
            placeholder="Search..."
            className="flex-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm || ""}
            onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const term = searchTerm.trim();
                if (term && !searchTags.includes(term) && setSearchTags) {
                  setSearchTags(prev => [...prev, term]);
                  if (setSearchTerm) setSearchTerm("");
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
                      if (setSearchTags) {
                        setSearchTags(prev => prev.filter((_, i) => i !== index));
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div
          className="max-h-64 overflow-auto border border-gray-200 rounded-md divide-y divide-gray-100"
          onClick={(e) => console.log('[InfoFilter] Scrollable container clicked, target:', e.target.tagName, 'class:', e.target.className?.slice?.(0, 50) || e.target.className)}
        >
          {allItems.length > 0 ? (
            <>
              {displayItems.map(([val, color]) => {
                const isEnabled = enabledValues.has(val);
                const isHighlighted = highlightedMetadataValue === val;
                return (
                  <div
                    key={val}
                    className={`group relative w-full flex items-center transition-colors ${
                      isHighlighted
                        ? 'bg-yellow-100 ring-1 ring-inset ring-yellow-400'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={(e) => {
                      console.log('[InfoFilter] Row clicked, target:', e.target.tagName, e.target.className);
                    }}
                  >
                    <div className={`flex-1 flex items-center px-2 py-1 ${isEnabled ? '' : 'opacity-40'}`}>
                      {/* Color picker - clickable swatch */}
                      <input
                        type="color"
                        value={rgbaToHex(color)}
                        onChange={(e) => {
                          if (setMetadataColors && selectedColorBy) {
                            const rgb = hexToRgb(e.target.value);
                            setMetadataColors(prev => ({
                              ...prev,
                              [selectedColorBy]: {
                                ...prev[selectedColorBy],
                                [val]: [...rgb, 255]
                              }
                            }));
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded-full mr-2 border border-gray-200 cursor-pointer p-0 flex-shrink-0"
                        style={{
                          backgroundColor: Array.isArray(color) ? rgbaToHex(color) : undefined,
                          appearance: 'none',
                          WebkitAppearance: 'none'
                        }}
                        title="Click to change color"
                      />
                      <button
                        type="button"
                        className="flex-1 text-left"
                        onClick={() => {
                          console.log('[InfoFilter] Metadata value clicked:', val);
                          // Toggle highlight on click
                          if (setHighlightedMetadataValue) {
                            console.log('[InfoFilter] Calling setHighlightedMetadataValue');
                            setHighlightedMetadataValue(prev => {
                              const newVal = prev === val ? null : val;
                              console.log('[InfoFilter] highlightedMetadataValue changing:', prev, '→', newVal);
                              return newVal;
                            });
                          } else {
                            console.log('[InfoFilter] setHighlightedMetadataValue is NOT available!');
                          }
                        }}
                        onDoubleClick={() => {
                          // Double-click adds to search tags (original behavior)
                          if (!searchTags.includes(val) && setSearchTags) {
                            setSearchTags(prev => [...prev, val]);
                          }
                        }}
                        title="Click to highlight, double-click to add to search"
                      >
                        <span className="text-sm text-gray-800 truncate">{val}</span>
                      </button>
                    </div>

                    {/* Hover Actions */}
                    <div className="hidden group-hover:flex items-center gap-1 absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 shadow-sm border border-gray-200 rounded px-1 py-0.5">
                      <button
                        type="button"
                        className={`p-1 rounded focus:outline-none ${isEnabled ? 'text-gray-500 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                        title={isEnabled ? "Search & highlight on tree" : "Enable item to search"}
                        disabled={!isEnabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('[InfoFilter] Magnifying glass clicked:', val);
                          // Add to search tags (original behavior)
                          if (!searchTags.includes(val) && setSearchTags) {
                            setSearchTags(prev => [...prev, val]);
                          }
                          // Also trigger highlight on tree
                          if (setHighlightedMetadataValue) {
                            setHighlightedMetadataValue(prev => {
                              const newVal = prev === val ? null : val;
                              console.log('[InfoFilter] highlightedMetadataValue changing:', prev, '→', newVal);
                              return newVal;
                            });
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
                          if (setEnabledValues) {
                            setEnabledValues(prev => {
                              const next = new Set(prev);
                              if (isEnabled) {
                                next.delete(val);
                                // Also remove from search tags if present
                                if (searchTags.includes(val) && setSearchTags) {
                                  setSearchTags(prevTags => prevTags.filter(tag => tag !== val));
                                }
                              } else {
                                next.add(val);
                              }
                              return next;
                            });
                          }
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
          <div
            className="flex items-center justify-between mb-2 cursor-pointer select-none"
            onClick={() => setIsTreesExpanded(!isTreesExpanded)}
          >
            <h3 className="text-sm font-medium text-gray-700">
              Trees {visibleTrees.length > 0 && (
                <span className="text-gray-400 font-normal">({visibleTrees.length})</span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              {isCsvFile && (
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs text-gray-500">Color by tree</span>
                  <button
                    type="button"
                    className={`w-4 h-4 rounded-full border-2 transition-colors ${colorByTree
                      ? 'bg-gray-700 border-gray-700'
                      : 'bg-white border-gray-400'
                    }`}
                    onClick={() => setColorByTree?.(prev => !prev)}
                    title="Color edges by tree index (CSV)"
                  />
                </div>
              )}
              <button type="button" className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <svg className={`w-4 h-4 transform transition-transform duration-200 ${isTreesExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
          {isTreesExpanded && (
            <div className="max-h-64 overflow-auto border border-gray-100 rounded-md divide-y divide-gray-100">
              {visibleTrees && visibleTrees.length > 0 ? (
                visibleTrees.map(treeIndex => {
                  const isHovered = (hoveredTreeIndex === treeIndex || hoveredTreeIndex?.tree_index === treeIndex);
                  return (
                    <div
                      key={treeIndex}
                      className={`flex items-center justify-between px-2 py-1 transition-colors cursor-pointer ${isHovered ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                      onMouseEnter={() => setHoveredTreeIndex && setHoveredTreeIndex(treeIndex)}
                      onMouseLeave={() => setHoveredTreeIndex && setHoveredTreeIndex(null)}
                    >
                      <span className="text-sm text-gray-800">Tree {treeIndex}</span>
                      <div className="flex items-center">
                        <input
                          type="color"
                          className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                          value={treeColors[treeIndex] || "#91C2F4"}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (setTreeColors) {
                              setTreeColors(prev => ({ ...prev, [String(treeIndex)]: e.target.value }));
                            }
                          }}
                        />
                        {treeColors[treeIndex] && (
                          <button
                            className="ml-2 text-xs text-gray-500 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
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
                  );
                })
              ) : (
                <div className="px-2 py-2 text-sm text-gray-500">No visible trees</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
