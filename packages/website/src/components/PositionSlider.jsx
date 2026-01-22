import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * PositionSlider - Header bar with genome position controls
 * Based on frontend's PositionSlider + EditableRange
 */
export default function PositionSlider({
  filename,
  genomeLength,
  value,
  onChange,
  project,
  showInfo,
  setShowInfo,
  showSettings,
  setShowSettings
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [start, setStart] = useState(value?.[0] || 0);
  const [end, setEnd] = useState(value?.[1] || genomeLength || 0);
  const [hasChanges, setHasChanges] = useState(false);

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

  const handleReset = useCallback(() => {
    if (genomeLength) {
      onChange?.([0, genomeLength]);
    }
  }, [genomeLength, onChange]);

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-white border-b border-slate-200 relative">
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

      {/* Filename badge */}
      {filename && (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 mr-4">
          {filename}
        </span>
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
          className="w-24 px-2 py-1 text-center text-sm font-mono border-none outline-none bg-transparent"
          min={0}
          max={genomeLength}
        />
        <span className="text-slate-400 text-sm">...</span>
        <input
          type="number"
          value={end}
          onChange={handleEndChange}
          onKeyPress={handleKeyPress}
          className="w-24 px-2 py-1 text-center text-sm font-mono border-none outline-none bg-transparent"
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
        className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        title="Reset view"
      >
        &#x21BA;
      </button>

      {/* Genome length display */}
      {genomeLength && (
        <span className="text-xs text-slate-400 ml-2">
          / {genomeLength.toLocaleString()} bp
        </span>
      )}

      {/* Info panel toggle button */}
      {setShowInfo && (
        <button
          onClick={() => {
            setShowInfo(!showInfo);
            if (!showInfo && setShowSettings) setShowSettings(false);
          }}
          className={`absolute right-14 p-2 rounded-lg transition-colors ${
            showInfo
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title={showInfo ? 'Close info panel' : 'Open info panel'}
        >
          {/* Kanban/list icon similar to frontend */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </button>
      )}

      {/* Settings panel toggle button */}
      {setShowSettings && (
        <button
          onClick={() => {
            setShowSettings(!showSettings);
            if (!showSettings && setShowInfo) setShowInfo(false);
          }}
          className={`absolute right-4 p-2 rounded-lg transition-colors ${
            showSettings
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title={showSettings ? 'Close settings panel' : 'Open settings panel'}
        >
          {/* Gear icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}
