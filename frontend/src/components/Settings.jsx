

export default function Settings({
    settings,
    setSettings,
    showSettings,
    setShowSettings,
}) {

    // if (!showSettings) return null;

    return (
    <div className="w-full h-full bg-gray-50 p-3 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
      <div className="flex justify-start mb-4">
          <button
            onClick={() => setShowSettings(false)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200"
          >
            Close
          </button>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Settings</h2>

        <div className="bg-white p-4 rounded-lg shadow mb-4">
            <div className="flex items-center justify-between">
                <label htmlFor="lineage-paths" className="text-gray-700 font-medium">
                    Display Lineage Paths
                </label>
                <input
                    id="lineage-paths"
                    type="checkbox"
                    checked={settings.display_lineage_paths}
                    onChange={(e) => setSettings({ ...settings, display_lineage_paths: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
            </div>
            <p className="text-sm text-gray-500 mt-1">
                Show ancestral paths when searching for samples
            </p>
        </div>
     </div>
    </div>
    );
}