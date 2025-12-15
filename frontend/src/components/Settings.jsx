

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

        <p className="text-sm text-gray-500">No settings available</p>
     </div>
    </div>
    );
}