import React from 'react';

/**
 * ViewportOverlay - Container box for tree visualization
 * Based on frontend's ViewportOverlay
 *
 * Shows loading overlay when statusMessage indicates loading status
 */
const ViewportOverlay = React.memo(({ statusMessage, filename }) => (
  <>
    {/* Main Genome Container Box */}
    <div
      style={{
        position: 'absolute',
        top: '1%',
        left: '5%',
        height: '85%',
        width: '95%',
        zIndex: 1,
        pointerEvents: 'none',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        backgroundColor: 'transparent',
      }}
    >
      {/* Divider for Genome Positions area */}
      <div
        style={{
          position: 'absolute',
          top: '3.5%',
          left: 0,
          right: 0,
          height: '1px',
          backgroundColor: '#e2e8f0',
        }}
      />
      {/* Divider for Genome Info area */}
      <div
        style={{
          position: 'absolute',
          top: '5.8%',
          left: 0,
          right: 0,
          height: '1px',
          backgroundColor: '#e2e8f0',
        }}
      />
    </div>

    {/* Timeline Label (Rotated, on left side) */}
    <div
      style={{
        position: 'absolute',
        top: '6%',
        left: '0%',
        height: '80%',
        width: '2%',
        zIndex: 11,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          transform: 'rotate(-90deg)',
          whiteSpace: 'nowrap',
          fontSize: '10px',
          color: '#64748b',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          opacity: 0.8,
        }}
      >
        Timeline
      </div>
    </div>

    {/* Loading Overlay - shown when loading */}
    {(statusMessage?.status === 'processing-file' ||
      statusMessage?.status === 'file-load' ||
      statusMessage?.status === 'loading') && (
      <div
        style={{
          position: 'absolute',
          top: '6%',
          left: '5%',
          height: '80%',
          width: '95%',
          zIndex: 20,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '0 0 8px 8px',
        }}
      >
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border border-slate-200 shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-800">
              {statusMessage?.message || 'Loading...'}
            </h3>
            {filename && (
              <p className="text-sm text-slate-500">{filename}</p>
            )}
          </div>
        </div>
      </div>
    )}
  </>
));

ViewportOverlay.displayName = 'ViewportOverlay';

export default ViewportOverlay;
