import React, { useState, useRef, useEffect, useCallback } from 'react';
import EditableRange from './EditableRange';
import { useSearchParams } from 'react-router-dom';
import { faArrows } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function PositionSlider({ config, project, ucgbMode, view, valueRef }) {
  
  const { tsconfig, filename } = config;
  const { genome_length } = tsconfig;
  
  const [searchParams, setSearchParams] = useSearchParams();
  const { changeView , startPan, stopPan, viewReset, decksize} = view;

  // Initialize value if missing
  useEffect(() => {
    if (!valueRef.current) {
      // valueRef.current = tsconfig.value;
    }
  }, [tsconfig.value]);

  // Keep ref and search params in sync with React state
  useEffect(() => {
    if (valueRef.current) {
      if (ucgbMode.current) {
        setSearchParams({
          chrom: tsconfig.chrom,
          genomiccoordstart: valueRef.current[0],
          genomiccoordend: valueRef.current[1],
        });
      } else {
        setSearchParams({
          project,
          genomiccoordstart: valueRef.current[0],
          genomiccoordend: valueRef.current[1],
        });
      }
    }
  }, [valueRef.current, tsconfig.chrom, project, ucgbMode, setSearchParams]);



  const onChange = useCallback((input_values) => {
      if (input_values[0] >= 0 && input_values[1] <= genome_length) {
        const newVal = [input_values[0], input_values[1]];
        // valueRef.current = newVal;
        // setValue(newVal);
        changeView(newVal); // always call when user changes
      }else{
        alert(`ERROR: cannot change to ${input_values}`);
      }
    },[decksize]);

  return (
    <div
      style={{
        width: '100%',
        border: '1px',
        borderColor: 'black',
        display: 'flex',
        justifyContent: 'center',
      }}
      // className="flex justify-center items-center"
    >
      <div className="flex justify-center items-center gap-2">
  {filename && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {filename}
            </span>
          )}
        </div>
      <button
        onMouseDown={() => startPan('L')}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: 'black',
        }}
      >
        ←
      </button>
      {valueRef.current && (
        <EditableRange valueRef={valueRef} onChange={onChange} />
      )}
      <button
        onMouseDown={() => startPan('R')}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: 'black',
        }}
      >
        →
      </button>
      <button
        onClick={() => {
          viewReset();
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: '#18b34c',
        }}
        title="Reset view"
      >
        <FontAwesomeIcon icon={faArrows} style={{ color: 'black' }} />
      </button>
      {/* <button
        onMouseDown={() => startPan('reset')}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onClick={() => {
          if (valueRef.current) {
            // Reset the range to the initial/default value(s)
            if (valueRef.current.default) {
              valueRef.current.value = [...valueRef.current.default];
              onChange([...valueRef.current.default]);
            } else if (Array.isArray(valueRef.current.initial)) {
              valueRef.current.value = [...valueRef.current.initial];
              onChange([...valueRef.current.initial]);
            }
          }
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: 'black',
        }}
        title="Reset range"
      >
        <span style={{ color: '#18b34c' }}>🔄</span>
      </button> */}
      {/* <button
        onClick={() => {
          // Try to use the browser's built-in 'screenshot' API if available,
          // otherwise just snapshot the component/DOM node by ID (instruct user if not supported)
          const mainDeckEl = document.querySelector('.w-full .relative');
          if (!mainDeckEl) {
            alert('Could not find genome visualization area to screenshot.');
            return;
          }
          if ("startViewTransition" in document) {
              // The experimental View Transitions API with screenshot is not widely available yet;
              // fallback to using html2canvas if present
              alert('Screenshotting using startViewTransition is not supported in your browser. Please use the browser\'s screenshot feature or ensure html2canvas is loaded.');
              return;
          }
          // Try to use html2canvas if available
          if (window.html2canvas) {
            window.html2canvas(mainDeckEl).then(canvas => {
              const link = document.createElement('a');
              link.download = 'lorax-screenshot.png';
              link.href = canvas.toDataURL();
              link.click();
            });
          } else {
            alert("Automatic screenshot not supported in this browser.\n\nYou can use your OS/browser's screenshot tool, or load html2canvas for this button to work.");
          }
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: 'black',
        }}
        title="Capture screenshot"
      >
        <svg
          width="40"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="screenshot"
          style={{ verticalAlign: "middle" }}
        >
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <circle cx="12" cy="13.5" r="3.5" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button> */}
    </div>
  );
}
