import React, { useState } from 'react';

interface SettingsProps {
  setShowSettings: (show: boolean) => void;
}

const Settings: React.FC<SettingsProps> = ({ setShowSettings }) => {
  const [activeTab, setActiveTab] = useState<'visualization' | 'display' | 'export'>('visualization');

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="w-full p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4">
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

        {/* Tab buttons */}
        <div className="w-full flex p-1 bg-slate-100 rounded-lg">
          <button
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200
              ${activeTab === 'visualization'
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700"}
            `}
            onClick={() => setActiveTab('visualization')}
          >
            Visualization
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200
              ${activeTab === 'display'
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700"}
            `}
            onClick={() => setActiveTab('display')}
          >
            Display
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200
              ${activeTab === 'export'
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700"}
            `}
            onClick={() => setActiveTab('export')}
          >
            Export
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'visualization' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Tree Rendering</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Show node labels</span>
                  <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Animate transitions</span>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded" />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Edge Style</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Edge width</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    defaultValue="2"
                    className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Edge opacity</span>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    defaultValue="80"
                    className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'display' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Interface</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Show grid lines</span>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Show coordinates</span>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Show tooltips</span>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded" />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Performance</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">High quality rendering</span>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded" />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Export Options</h3>
              <div className="space-y-3">
                <button className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Export as PNG
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Export as SVG
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Export Data (JSON)
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Image Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Resolution</span>
                  <select className="px-2 py-1 text-sm border border-slate-200 rounded-md">
                    <option>1x</option>
                    <option>2x</option>
                    <option>4x</option>
                  </select>
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Include background</span>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded" />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
