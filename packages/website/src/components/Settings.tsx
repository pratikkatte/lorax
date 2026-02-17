import React from 'react';

type RgbaColor = [number, number, number, number];

interface SettingsProps {
  setShowSettings: (show: boolean) => void;
  polygonFillColor: RgbaColor;
  setPolygonFillColor: (color: RgbaColor) => void;
  defaultTipColor: RgbaColor;
  setDefaultTipColor: (color: RgbaColor) => void;
  compareInsertionColor: RgbaColor;
  setCompareInsertionColor: (color: RgbaColor) => void;
  compareDeletionColor: RgbaColor;
  setCompareDeletionColor: (color: RgbaColor) => void;
  showCompareInsertion: boolean;
  setShowCompareInsertion: (show: boolean) => void;
  showCompareDeletion: boolean;
  setShowCompareDeletion: (show: boolean) => void;
  edgeColor: RgbaColor;
  setEdgeColor: (color: RgbaColor) => void;
}

// Convert RGB array to hex string
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Convert hex string to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ];
  }
  return [145, 194, 244]; // fallback to default
}

const Settings: React.FC<SettingsProps> = ({
  setShowSettings,
  polygonFillColor,
  setPolygonFillColor,
  defaultTipColor,
  setDefaultTipColor,
  compareInsertionColor,
  setCompareInsertionColor,
  compareDeletionColor,
  setCompareDeletionColor,
  showCompareInsertion,
  setShowCompareInsertion,
  showCompareDeletion,
  setShowCompareDeletion,
  edgeColor,
  setEdgeColor
}) => {
  return (
    <div className="w-full h-full bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="w-full p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Settings</h2>
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

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          <div className="border-l-4 border-slate-400 flex items-center justify-between gap-4 pl-3 pr-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 tracking-tight">Tree Background</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Color of the area behind tree nodes.</p>
            </div>
            <input
              type="color"
              value={rgbToHex(polygonFillColor[0], polygonFillColor[1], polygonFillColor[2])}
              onChange={(e) => {
                const [r, g, b] = hexToRgb(e.target.value);
                setPolygonFillColor([r, g, b, polygonFillColor[3]]);
              }}
              className="shrink-0 w-6 h-6 cursor-pointer rounded-full border border-slate-300 p-0.5 bg-white shadow-inner [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
            />
          </div>
        </div>
        <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          <div className="border-l-4 border-slate-400 flex items-center justify-between gap-4 pl-3 pr-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 tracking-tight">Tree Edges</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Color of the edges connecting nodes.</p>
            </div>
            <input
              type="color"
              value={rgbToHex(edgeColor[0], edgeColor[1], edgeColor[2])}
              onChange={(e) => {
                const [r, g, b] = hexToRgb(e.target.value);
                setEdgeColor([r, g, b, edgeColor[3]]);
              }}
              className="shrink-0 w-6 h-6 cursor-pointer rounded-full border border-slate-300 p-0.5 bg-white shadow-inner [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
            />
          </div>
        </div>
        <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          <div className="border-l-4 border-slate-400 flex items-center justify-between gap-4 pl-3 pr-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 tracking-tight">Tree Tip Default</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Fallback color used for tips when no metadata color is applied.</p>
            </div>
            <input
              type="color"
              value={rgbToHex(defaultTipColor[0], defaultTipColor[1], defaultTipColor[2])}
              onChange={(e) => {
                const [r, g, b] = hexToRgb(e.target.value);
                setDefaultTipColor([r, g, b, defaultTipColor[3]]);
              }}
              className="shrink-0 w-6 h-6 cursor-pointer rounded-full border border-slate-300 p-0.5 bg-white shadow-inner [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
            />
          </div>
        </div>
        <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          <div className="border-l-4 border-slate-400 pl-3 pr-4 pt-4 pb-3">
            <h3 className="text-sm font-semibold text-slate-700 tracking-tight">Compare Topology</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">Control visibility of added and removed edges during topology comparison.</p>
          </div>
          <div className="flex gap-3 px-4 pb-4 pt-1">
            <label className="flex flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 transition-colors hover:bg-slate-100/80 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompareInsertion}
                onChange={(e) => setShowCompareInsertion(e.target.checked)}
                className="rounded border-slate-300 text-slate-700 focus:ring-slate-400"
              />
              <span className="text-sm font-medium text-slate-600">Added Edges</span>
              <input
                type="color"
                value={rgbToHex(compareInsertionColor[0], compareInsertionColor[1], compareInsertionColor[2])}
                onChange={(e) => {
                  const [r, g, b] = hexToRgb(e.target.value);
                  setCompareInsertionColor([r, g, b, compareInsertionColor[3]]);
                }}
                className="ml-auto w-6 h-6 cursor-pointer rounded-full border border-slate-300 p-0.5 bg-white shadow-inner [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
              />
            </label>
            <label className="flex flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 transition-colors hover:bg-slate-100/80 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompareDeletion}
                onChange={(e) => setShowCompareDeletion(e.target.checked)}
                className="rounded border-slate-300 text-slate-700 focus:ring-slate-400"
              />
              <span className="text-sm font-medium text-slate-600">Removed Edges</span>
              <input
                type="color"
                value={rgbToHex(compareDeletionColor[0], compareDeletionColor[1], compareDeletionColor[2])}
                onChange={(e) => {
                  const [r, g, b] = hexToRgb(e.target.value);
                  setCompareDeletionColor([r, g, b, compareDeletionColor[3]]);
                }}
                className="ml-auto w-6 h-6 cursor-pointer rounded-full border border-slate-300 p-0.5 bg-white shadow-inner [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
