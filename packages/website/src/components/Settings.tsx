import React, { useEffect, useState } from 'react';
import { getChatApiKey, getChatModel, setChatApiKey, setChatModel } from '../lib/chatStorage';

interface SettingsProps {
  setShowSettings: (show: boolean) => void;
  polygonFillColor: [number, number, number, number];
  setPolygonFillColor: (color: [number, number, number, number]) => void;
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
  setPolygonFillColor
}) => {
  const [r, g, b, a] = polygonFillColor;
  const hexColor = rgbToHex(r, g, b);
  const opacity = Math.round((a / 255) * 100);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');

  useEffect(() => {
    setApiKey(getChatApiKey());
    setModel(getChatModel());
  }, []);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [newR, newG, newB] = hexToRgb(e.target.value);
    setPolygonFillColor([newR, newG, newB, polygonFillColor[3]]);
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseInt(e.target.value, 10);
    const newAlpha = Math.round((newOpacity / 100) * 255);
    setPolygonFillColor([r, g, b, newAlpha]);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    setChatApiKey(value);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setModel(value);
    setChatModel(value);
  };

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
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-white rounded-lg p-4 border border-slate-200 mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">LLM Settings</h3>

          <label className="block mb-3">
            <span className="text-sm text-slate-600">OpenAI API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="sk-..."
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
            />
            <p className="mt-1 text-xs text-slate-400">Stored locally in your browser.</p>
          </label>

          <label className="block">
            <span className="text-sm text-slate-600">Model</span>
            <input
              type="text"
              value={model}
              onChange={handleModelChange}
              placeholder="gpt-4o-mini"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
            />
          </label>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Polygon Color</h3>

          {/* Color preview swatch */}
          <div className="mb-4">
            <div
              className="w-full h-12 rounded-lg border border-slate-300"
              style={{
                backgroundColor: `rgba(${r}, ${g}, ${b}, ${a / 255})`
              }}
            />
          </div>

          {/* Color picker */}
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Color</span>
              <input
                type="color"
                value={hexColor}
                onChange={handleColorChange}
                className="w-8 h-8 cursor-pointer rounded-none border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
              />
            </label>

            {/* Opacity slider */}
            <label className="block">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Opacity</span>
                <span className="text-sm text-slate-500">{opacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={handleOpacityChange}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </label>
          </div>

          {/* RGBA values display */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-mono">
              RGBA: [{r}, {g}, {b}, {a}]
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
