import React from 'react';

type RgbaColor = [number, number, number, number];

interface SettingsProps {
  setShowSettings: (show: boolean) => void;
  polygonFillColor: RgbaColor;
  setPolygonFillColor: (color: RgbaColor) => void;
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
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <label className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Tree Background</span>
            <input
              type="color"
              value={rgbToHex(polygonFillColor[0], polygonFillColor[1], polygonFillColor[2])}
              onChange={(e) => {
                const [r, g, b] = hexToRgb(e.target.value);
                setPolygonFillColor([r, g, b, polygonFillColor[3]]);
              }}
              className="w-6 h-6 cursor-pointer rounded border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
            />
          </label>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <label className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Edges</span>
            <input
              type="color"
              value={rgbToHex(edgeColor[0], edgeColor[1], edgeColor[2])}
              onChange={(e) => {
                const [r, g, b] = hexToRgb(e.target.value);
                setEdgeColor([r, g, b, edgeColor[3]]);
              }}
              className="w-6 h-6 cursor-pointer rounded border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
            />
          </label>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Compare Topology</h3>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showCompareInsertion}
                onChange={(e) => setShowCompareInsertion(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-600">Insertion</span>
              <input
                type="color"
                value={rgbToHex(compareInsertionColor[0], compareInsertionColor[1], compareInsertionColor[2])}
                onChange={(e) => {
                  const [r, g, b] = hexToRgb(e.target.value);
                  setCompareInsertionColor([r, g, b, compareInsertionColor[3]]);
                }}
                className="w-6 h-6 cursor-pointer rounded border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showCompareDeletion}
                onChange={(e) => setShowCompareDeletion(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-600">Deletion</span>
              <input
                type="color"
                value={rgbToHex(compareDeletionColor[0], compareDeletionColor[1], compareDeletionColor[2])}
                onChange={(e) => {
                  const [r, g, b] = hexToRgb(e.target.value);
                  setCompareDeletionColor([r, g, b, compareDeletionColor[3]]);
                }}
                className="w-6 h-6 cursor-pointer rounded border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
