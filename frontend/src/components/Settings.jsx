import { useState, useCallback } from 'react';

// Helper to convert RGBA array to hex color
const rgbaToHex = (rgba) => {
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
  ] : [145, 194, 244];
};

// Selection strategy options with descriptions
const SELECTION_STRATEGIES = [
  { 
    value: 'largestSpan', 
    label: 'Largest Span', 
    description: 'Show tree with the largest genomic span in each slot' 
  },
  { 
    value: 'centerWeighted', 
    label: 'Center Weighted', 
    description: 'Show tree closest to the center of each slot' 
  },
  { 
    value: 'spanWeightedRandom', 
    label: 'Weighted Random', 
    description: 'Randomly select, weighted by span size' 
  },
  { 
    value: 'first', 
    label: 'First', 
    description: 'Show the first tree by genomic position' 
  }
];

export default function Settings({
  settings,
  setSettings,
  showSettings,
  setShowSettings,
}) {
  const DEFAULT_POLYGON_COLOR = [145, 194, 244, 46];
  const DEFAULT_TREE_DISPLAY = {
    selectionStrategy: 'largestSpan',
    maxVisibleTrees: 50,
    fixedVisualWidth: null
  };
  
  const polygonColor = settings?.polygonColor || DEFAULT_POLYGON_COLOR;
  const treeDisplay = settings?.treeDisplay || DEFAULT_TREE_DISPLAY;

  const handleColorChange = useCallback((e) => {
    const rgb = hexToRgb(e.target.value);
    setSettings(prev => ({
      ...prev,
      polygonColor: [...rgb, prev.polygonColor?.[3] ?? 46]
    }));
  }, [setSettings]);

  const handleOpacityChange = useCallback((e) => {
    const opacity = parseInt(e.target.value, 10);
    setSettings(prev => ({
      ...prev,
      polygonColor: [
        prev.polygonColor?.[0] ?? 145,
        prev.polygonColor?.[1] ?? 194,
        prev.polygonColor?.[2] ?? 244,
        opacity
      ]
    }));
  }, [setSettings]);

  const handleReset = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      polygonColor: DEFAULT_POLYGON_COLOR
    }));
  }, [setSettings]);

  // Tree display setting handlers
  const handleSelectionStrategyChange = useCallback((e) => {
    setSettings(prev => ({
      ...prev,
      treeDisplay: {
        ...prev.treeDisplay,
        selectionStrategy: e.target.value
      }
    }));
  }, [setSettings]);

  const handleMaxVisibleTreesChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1) {
      setSettings(prev => ({
        ...prev,
        treeDisplay: {
          ...prev.treeDisplay,
          maxVisibleTrees: value
        }
      }));
    }
  }, [setSettings]);

  const handleTreeDisplayReset = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      treeDisplay: DEFAULT_TREE_DISPLAY
    }));
  }, [setSettings]);

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col font-sans">
      <div className="w-full p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-slate-800">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="space-y-6">
          {/* Polygon Color Setting */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Tree highlight color</h3>
            <p className="text-xs text-slate-500 mb-4">
              Customize the color that is used to highlight the tree.
            </p>

            <div className="space-y-4">
              {/* Color Picker */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-600 w-16">Color:</label>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    value={rgbaToHex(polygonColor)}
                    onChange={handleColorChange}
                    className="w-10 h-10 rounded cursor-pointer border border-slate-300 p-0.5"
                  />
                  <span className="text-xs text-slate-500 font-mono">
                    {rgbaToHex(polygonColor).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-600 w-16">Opacity:</label>
                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={polygonColor[3]}
                    onChange={handleOpacityChange}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-xs text-slate-500 font-mono w-12 text-right">
                    {Math.round((polygonColor[3] / 255) * 100)}%
                  </span>
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="text-xs font-medium text-slate-600 block mb-2">Preview:</label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-full h-12 rounded-lg border border-slate-200"
                    style={{
                      backgroundColor: `rgba(${polygonColor[0]}, ${polygonColor[1]}, ${polygonColor[2]}, ${polygonColor[3] / 255})`,
                      backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                      backgroundSize: '10px 10px',
                      backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                    }}
                  >
                    <div
                      className="w-full h-full rounded-lg"
                      style={{
                        backgroundColor: `rgba(${polygonColor[0]}, ${polygonColor[1]}, ${polygonColor[2]}, ${polygonColor[3] / 255})`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Reset Button */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          </div>

          {/* Tree Display Settings */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Tree Display</h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure how trees are selected and displayed when zoomed out.
            </p>

            <div className="space-y-4">
              {/* Selection Strategy */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-2">
                  Selection Strategy
                </label>
                <select
                  value={treeDisplay.selectionStrategy}
                  onChange={handleSelectionStrategyChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {SELECTION_STRATEGIES.map(strategy => (
                    <option key={strategy.value} value={strategy.value}>
                      {strategy.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  {SELECTION_STRATEGIES.find(s => s.value === treeDisplay.selectionStrategy)?.description}
                </p>
              </div>

              {/* Max Visible Trees */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-2">
                  Max Visible Trees
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={treeDisplay.maxVisibleTrees}
                    onChange={handleMaxVisibleTreesChange}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={treeDisplay.maxVisibleTrees}
                    onChange={handleMaxVisibleTreesChange}
                    className="w-16 px-2 py-1 text-sm border border-slate-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Maximum number of trees to display at once when zoomed out.
                </p>
              </div>

              {/* Reset Button */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleTreeDisplayReset}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}