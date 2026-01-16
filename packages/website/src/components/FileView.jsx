import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLorax, LoraxDeckGL } from '@lorax/core';
import PositionSlider from './PositionSlider';
import ViewportOverlay from './ViewportOverlay';
import Info from './Info';
import { useViewportDimensions } from '../hooks/useViewportDimensions';

/**
 * FileView component - displays loaded file with viewport and position controls.
 * Handles both navigation from LandingPage and direct URL access.
 */
function FileView() {
  const { file } = useParams();
  const [searchParams] = useSearchParams();
  const deckRef = useRef(null);

  const {
    queryFile,
    handleConfigUpdate,
    tsconfig,
    filename,
    genomeLength,
    isConnected
  } = useLorax();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [genomicPosition, setGenomicPosition] = useState(null); // [start, end] - synced with deck
  const [statusMessage, setStatusMessage] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  // Viewport and view dimensions with localStorage persistence
  const {
    viewport,
    views,
    updateViewport,
    updateView
  } = useViewportDimensions();

  // Get project and genomic coordinates from URL params
  const project = searchParams.get('project');
  const sid = searchParams.get('sid');
  const genomiccoordstart = searchParams.get('genomiccoordstart');
  const genomiccoordend = searchParams.get('genomiccoordend');

  // Load file config from URL params if not already loaded
  useEffect(() => {
    // Only load if we have required params and config isn't loaded for this file
    if (file && project && isConnected && !tsconfig?.filename) {
      setLoading(true);
      setError(null);
      setStatusMessage({ status: 'loading', message: 'Loading config...' });

      // Build payload with genomic coords if present
      const payload = {
        file,
        project,
        share_sid: sid
      };

      if (genomiccoordstart && genomiccoordend) {
        payload.genomiccoordstart = parseInt(genomiccoordstart, 10);
        payload.genomiccoordend = parseInt(genomiccoordend, 10);
      }

      queryFile(payload)
        .then(result => {
          if (result && result.config) {
            // Pass null for value - backend initial_position takes precedence
            handleConfigUpdate(result.config, null, project, sid);
          }
        })
        .catch(err => {
          console.error('FileView: Error loading config:', err);
          setError(err.message || 'Failed to load file');
        })
        .finally(() => {
          setLoading(false);
          setStatusMessage(null);
        });
    }
  }, [file, project, sid, genomiccoordstart, genomiccoordend, isConnected, tsconfig?.filename, queryFile, handleConfigUpdate]);

  // Initialize position when config loads (only if deck hasn't set it yet)
  useEffect(() => {
    if (tsconfig && genomeLength && !genomicPosition) {
      // Use value from config if available, otherwise full genome range
      const initialValue = tsconfig.value || [0, genomeLength];
      setGenomicPosition(initialValue);
    }
  }, [tsconfig, genomeLength, genomicPosition]);

  // Callback when deck.gl view changes (pan/zoom) - syncs deck → slider
  const handleGenomicCoordsChange = useCallback((coords) => {
    if (coords) {
      setGenomicPosition(coords);
    }
  }, []);

  // Handle slider position change - syncs slider → deck
  const handlePositionChange = useCallback((newPosition) => {
    setGenomicPosition(newPosition);
    // Update deck view via ref
    if (deckRef.current?.setGenomicCoords) {
      deckRef.current.setGenomicCoords(newPosition);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Position Slider - Header bar */}
      <PositionSlider
        filename={filename || file}
        genomeLength={genomeLength}
        value={genomicPosition}
        onChange={handlePositionChange}
        project={project}
        showInfo={showInfo}
        setShowInfo={setShowInfo}
      />

      {/* Main viewport area */}
      <div className="flex-1 relative bg-white">
        {/* ViewportOverlay - Container box with loading state */}
        <ViewportOverlay
          statusMessage={loading ? { status: 'loading', message: 'Loading config...' } : statusMessage}
          filename={filename || file}
          viewport={viewport}
          onViewportChange={updateViewport}
          views={views}
          onViewChange={updateView}
          resizable={!loading && !error && tsconfig}
        />

        {/* Error display */}
        {error && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-red-800">Error</h3>
              <p className="text-red-600 mt-2">{error}</p>
              <a
                href="/"
                className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Back to Projects
              </a>
            </div>
          </div>
        )}

        {/* Config info overlay - shown when loaded and not in error state */}
        {!loading && !error && tsconfig && (
          <div className="absolute bottom-4 right-4 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg p-4 text-sm max-w-xs">
            <h4 className="font-semibold text-slate-800 mb-2">File Info</h4>
            <div className="space-y-1 text-slate-600">
              <p>
                <span className="text-slate-400">Genome:</span>{' '}
                {genomeLength?.toLocaleString()} bp
              </p>
              <p>
                <span className="text-slate-400">Intervals:</span>{' '}
                {tsconfig.intervals?.length?.toLocaleString() || '-'}
              </p>
              {tsconfig.project && (
                <p>
                  <span className="text-slate-400">Project:</span>{' '}
                  {tsconfig.project}
                </p>
              )}
            </div>
          </div>
        )}

        {/* LoraxDeckGL canvas - renders when config is loaded */}
        {!loading && !error && tsconfig && (
          <div
            style={{
              position: 'absolute',
              top: viewport.top,
              left: viewport.left,
              width: viewport.width,
              height: viewport.height
            }}
          >
            <LoraxDeckGL
              ref={deckRef}
              viewConfig={{
                ortho: { enabled: true, ...views?.ortho },
                genomeInfo: { enabled: true, ...views?.genomeInfo },
                genomePositions: { enabled: true, ...views?.genomePositions },
                treeTime: { enabled: true, ...views?.treeTime }
              }}
              onGenomicCoordsChange={handleGenomicCoordsChange}
            />
          </div>
        )}

        {/* Info Panel - Right sidebar */}
        <div
          className={`fixed top-0 right-0 w-[25%] min-w-[320px] h-full z-40 shadow-xl transition-transform duration-300 ease-in-out ${showInfo ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          <Info setShowInfo={setShowInfo} />
        </div>
      </div>
    </div>
  );
}

export default FileView;
