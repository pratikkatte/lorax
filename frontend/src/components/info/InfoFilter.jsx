import React from "react";

export default function InfoFilter({ 
  searchTerm, 
  setSearchTerm, 
  searchTags, 
  setSearchTags, 
  selectedColorBy, 
  setSelectedColorBy, 
  coloryby, 
  metadataColors, 
  populations, 
  sampleNames, 
  enabledValues, 
  setEnabledValues,
  visibleTrees,
  treeColors,
  setTreeColors
}) {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-3">
      <h2 className="text-lg font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">Filter</h2>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Search</label>
          <input
              type="text"
              placeholder="Search sample or metadata..."
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <div className="flex flex-wrap gap-2 mt-2">
              {searchTags && searchTags.map((tag, index) => (
                  <div key={index} className="flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                      <span>{tag}</span>
                      <button
                          type="button"
                          className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                          onClick={() => {
                              setSearchTags(prev => prev.filter((_, i) => i !== index));
                          }}
                      >
                          ×
                      </button>
                  </div>
              ))}
          </div>
        </div>
        <div className="flex items-center">
          <label className="text-sm font-medium text-gray-700 mr-3">Color by</label>
          <select
            className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedColorBy}
            onChange={(e) => setSelectedColorBy(e.target.value)}
          >
            {Object.entries(coloryby).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Values</div>
          <div className="max-h-64 overflow-auto border border-gray-100 rounded-md divide-y divide-gray-100">
            {(() => {
              // Check if we are in metadata mode
              if (metadataColors && metadataColors[selectedColorBy]) {
                   const valueToColor = metadataColors[selectedColorBy];
                   const items = Object.entries(valueToColor);
                   
                   return items.length > 0 ? items.map(([val, color]) => {
                       const isEnabled = enabledValues.has(val);
                       return (
                          <button
                            key={val}
                            type="button"
                            className={`w-full flex items-center px-2 py-1 text-left transition ${isEnabled ? '' : 'opacity-40'}`}
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
                              className="inline-block w-3 h-3 rounded-full mr-2 border border-gray-200"
                              style={{ backgroundColor: Array.isArray(color) ? `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})` : undefined }}
                            />
                            <span className="text-sm text-gray-800">{val}</span>
                          </button>
                       );
                    }) : <div className="px-2 py-2 text-sm text-gray-500">No values</div>;
              }

              // Fallback to original logic for populations/sample_names
              if (populations || sampleNames) {
                const valueToKeys = new Map();
                let data = selectedColorBy === 'sample_name' ? sampleNames.sample_names : populations;
                
                // Safety check if data is null/undefined
                if (!data) return <div className="px-2 py-2 text-sm text-gray-500">No data available</div>;

                Object.entries(data).forEach(([key, p]) => {
                  const val = p?.[selectedColorBy] || 'N/A';
                  if (!valueToKeys.has(val)) valueToKeys.set(val, { keys: [], color: p?.color });
                  valueToKeys.get(val).keys.push(key);
                });
                const items = Array.from(valueToKeys.entries());
                return items.length > 0 ? items.map(([val, info]) => {
                  const { keys, color } = info;
       
                  const allEnabled = keys.every(k => enabledValues.has(k));
                  return (
                    <button
                      key={val}
                      type="button"
                      className={`w-full flex items-center px-2 py-1 text-left transition ${allEnabled ? '' : 'opacity-40'}`}
                      onClick={() => {
                        setEnabledValues(prev => {
                          const next = new Set(prev);
                          const currentlyAll = keys.every(k => next.has(k));
                          if (currentlyAll) {
                            keys.forEach(k => next.delete(k));
                          } else {
                            keys.forEach(k => next.add(k));
                          }
                          return next;
                        });
                      }}
                    >
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2 border border-gray-200"
                        style={{ backgroundColor: Array.isArray(color) ? `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})` : undefined }}
                      />
                      <span className="text-sm text-gray-800">{val}</span>
                    </button>
                  );
                }) : (
                  <div className="px-2 py-2 text-sm text-gray-500">No values</div>
                );
              } else {
                  return <div className="px-2 py-2 text-sm text-gray-500">No populations loaded</div>;
              }
            })()}
          </div>
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
                                                const newState = {...prev, [String(treeIndex)]: e.target.value};
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
                                                    const next = {...prev};
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
