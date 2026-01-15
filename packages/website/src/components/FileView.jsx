import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useLorax } from '@lorax/core';

/**
 * FileView component - displays loaded file info based on URL params.
 * Handles both navigation from LandingPage and direct URL access.
 */
function FileView({ upload }) {
  const { file } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    queryFile,
    handleConfigUpdate,
    tsconfig,
    filename,
    sampleNames,
    genomeLength,
    metadataKeys,
    isConnected
  } = useLorax();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load file config from URL params if not already loaded
  useEffect(() => {
    const project = searchParams.get('project');
    const sid = searchParams.get('sid');

    // Only load if we have required params and config isn't loaded for this file
    if (file && project && isConnected && !tsconfig?.filename) {
      setLoading(true);
      setError(null);

      console.log('FileView: Loading config from URL params:', { file, project, sid });

      queryFile({ file, project, share_sid: sid })
        .then(result => {
          if (result && result.config) {
            handleConfigUpdate(result.config, null, project, sid);
            console.log('FileView: Config loaded successfully');
          }
        })
        .catch(err => {
          console.error('FileView: Error loading config:', err);
          setError(err.message || 'Failed to load file');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [file, searchParams, isConnected, tsconfig?.filename, queryFile, handleConfigUpdate]);

  // Get population count
  const populationCount = sampleNames?.sample_names
    ? Object.keys(sampleNames.sample_names).length
    : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">File Viewer</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            ← Back to Projects
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="ml-3">Loading file config...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-300">Error: {error}</p>
          </div>
        )}

        {/* File info */}
        {!loading && tsconfig && (
          <div className="space-y-6">
            {/* File name card */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-400 mb-2">File</h2>
              <p className="text-xl font-mono">{filename || file}</p>
              {tsconfig.project && (
                <p className="text-gray-400 mt-1">Project: {tsconfig.project}</p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Genome Length</p>
                <p className="text-xl font-semibold">
                  {genomeLength ? genomeLength.toLocaleString() : '-'}
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Intervals</p>
                <p className="text-xl font-semibold">
                  {tsconfig.intervals?.length?.toLocaleString() || '-'}
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Populations</p>
                <p className="text-xl font-semibold">{populationCount}</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Metadata Keys</p>
                <p className="text-xl font-semibold">{metadataKeys?.length || 0}</p>
              </div>
            </div>

            {/* Populations list */}
            {sampleNames?.sample_names && populationCount > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-400 mb-4">Populations</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(sampleNames.sample_names).map(([name, data]) => (
                    <div
                      key={name}
                      className="px-3 py-1 rounded-full text-sm flex items-center gap-2"
                      style={{
                        backgroundColor: data.color
                          ? `rgba(${data.color[0]}, ${data.color[1]}, ${data.color[2]}, 0.3)`
                          : 'rgba(100, 100, 100, 0.3)',
                        borderColor: data.color
                          ? `rgba(${data.color[0]}, ${data.color[1]}, ${data.color[2]}, 0.8)`
                          : 'rgba(100, 100, 100, 0.8)',
                        borderWidth: '1px'
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: data.color
                            ? `rgb(${data.color[0]}, ${data.color[1]}, ${data.color[2]})`
                            : 'rgb(100, 100, 100)'
                        }}
                      />
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata keys */}
            {metadataKeys && metadataKeys.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-400 mb-4">Available Metadata</h2>
                <div className="flex flex-wrap gap-2">
                  {metadataKeys.map((key) => (
                    <span
                      key={key}
                      className="px-3 py-1 bg-gray-700 rounded-full text-sm"
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No config loaded yet */}
        {!loading && !error && !tsconfig && (
          <div className="text-center py-12 text-gray-400">
            <p>No file loaded. Select a file from the project library.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              Go to Projects
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FileView;
