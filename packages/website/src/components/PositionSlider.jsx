import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Format base pairs with appropriate Kb/Mb units
 */
const formatBp = (bp) => {
  if (bp >= 1_000_000) {
    return `${(bp / 1_000_000).toFixed(1)} Mb`;
  } else if (bp >= 1_000) {
    return `${(bp / 1_000).toFixed(1)} Kb`;
  }
  return `${bp} bp`;
};

/**
 * Calculate input width based on digit count using ch units
 */
const getInputWidth = (value) => {
  const digits = String(value).length;
  return `${Math.max(digits + 6, 10)}ch`; // +6 for padding and spinner arrows, min 10 chars
};

/**
 * PositionSlider - Header bar with genome position controls
 * Based on frontend's PositionSlider + EditableRange
 */
export default function PositionSlider({
  filename,
  genomeLength,
  value,
  onChange,
  onResetY,
  project,
  tsconfig
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [start, setStart] = useState(value?.[0] || 0);
  const [end, setEnd] = useState(value?.[1] || genomeLength || 0);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFileInfo, setShowFileInfo] = useState(false);
  const fileInfoRef = useRef(null);

  // Sync local state with prop value
  useEffect(() => {
    if (value) {
      setStart(value[0]);
      setEnd(value[1]);
    }
  }, [value]);

  // Update URL params when value changes
  useEffect(() => {
    if (value && project) {
      const updatedParams = new URLSearchParams(searchParams);
      updatedParams.set('project', project);
      updatedParams.set('genomiccoordstart', value[0]);
      updatedParams.set('genomiccoordend', value[1]);
      setSearchParams(updatedParams, { replace: true });
    }
  }, [value, project, setSearchParams]);

  // Close file info dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fileInfoRef.current && !fileInfoRef.current.contains(event.target)) {
        setShowFileInfo(false);
      }
    };
    if (showFileInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFileInfo]);

  const handleStartChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setStart(val);
    setHasChanges(true);
  };

  const handleEndChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setEnd(val);
    setHasChanges(true);
  };

  const handleSubmit = useCallback(() => {
    if (!hasChanges) return;

    let newStart = Math.max(0, start);
    let newEnd = Math.min(end, genomeLength || end);

    if (newStart >= newEnd) {
      console.warn('Invalid range: start must be less than end');
      return;
    }

    onChange?.([newStart, newEnd]);
    setHasChanges(false);
  }, [hasChanges, start, end, genomeLength, onChange]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handlePan = useCallback((direction) => {
    if (!value || !genomeLength) return;

    const range = value[1] - value[0];
    const panAmount = Math.floor(range * 0.2); // Pan 20% of current view

    let newStart, newEnd;
    if (direction === 'L') {
      newStart = Math.max(0, value[0] - panAmount);
      newEnd = newStart + range;
    } else {
      newEnd = Math.min(genomeLength, value[1] + panAmount);
      newStart = newEnd - range;
    }

    onChange?.([newStart, newEnd]);
  }, [value, genomeLength, onChange]);

  // Reset ONLY the vertical (Y) view, keeping the current genomic window (X) intact.
  const handleReset = useCallback(() => {
    onResetY?.();
  }, [onResetY]);

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 bg-white border-b border-slate-200 relative"
      data-tour="viewer-position"
    >
      {/* Lorax logo/home link */}
      <a
        href="/"
        className="absolute left-4 flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
        title="Go to Lorax Home"
      >
        <img
          src="/logo.png"
          alt="Lorax Logo"
          className="h-6 w-auto"
        />
        <span className="font-bold text-slate-800">Lorax</span>
      </a>

      {/* Filename badge with file info dropdown */}
      {filename && (
        <div className="relative mr-4" ref={fileInfoRef}>
          <button
            onClick={() => setShowFileInfo(!showFileInfo)}
            data-tour="viewer-fileinfo"
            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              showFileInfo
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Show file info"
          >
            {filename}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 ml-1 transition-transform ${showFileInfo ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* File info dropdown */}
          {showFileInfo && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[200px] z-50">
              <h4 className="font-semibold text-slate-800 mb-2">File Info</h4>
              <div className="space-y-1 text-slate-600">
                <p>
                  <span className="text-slate-400">Genome:</span>{' '}
                  {genomeLength?.toLocaleString()} bp
                </p>
                <p>
                  <span className="text-slate-400">Intervals:</span>{' '}
                  {tsconfig?.intervals?.length?.toLocaleString() || '-'}
                </p>
                {tsconfig?.project && (
                  <p>
                    <span className="text-slate-400">Project:</span>{' '}
                    {tsconfig.project}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pan left button */}
      <button
        onClick={() => handlePan('L')}
        className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        title="Pan left"
      >
        &larr;
      </button>

      {/* Editable range inputs */}
      <div className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">
        <input
          type="number"
          value={start}
          onChange={handleStartChange}
          onKeyPress={handleKeyPress}
          className="px-2 py-1 text-center text-sm font-mono border-none outline-none bg-transparent"
          style={{ width: getInputWidth(start) }}
          min={0}
          max={genomeLength}
        />
        <span className="text-slate-400 text-sm">...</span>
        <input
          type="number"
          value={end}
          onChange={handleEndChange}
          onKeyPress={handleKeyPress}
          className="px-2 py-1 text-center text-sm font-mono border-none outline-none bg-transparent"
          style={{ width: getInputWidth(end) }}
          min={0}
          max={genomeLength}
        />
        <button
          onClick={handleSubmit}
          disabled={!hasChanges}
          className={`px-2 py-1 text-sm rounded border border-slate-200 transition-colors ${
            hasChanges
              ? 'text-slate-600 hover:bg-slate-50 cursor-pointer'
              : 'text-slate-300 cursor-not-allowed'
          }`}
          title="Apply changes"
        >
          Go
        </button>
      </div>

      {/* Pan right button */}
      <button
        onClick={() => handlePan('R')}
        className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        title="Pan right"
      >
        &rarr;
      </button>

      {/* Reset view button */}
      <button
        onClick={handleReset}
        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        title="Reset vertical view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      {/* Genome window size and length display */}
      {value && genomeLength && (
        <span className="text-xs text-slate-400 ml-2">
          {formatBp(value[1] - value[0])} / {formatBp(genomeLength)}
        </span>
      )}
    </div>
  );
}
