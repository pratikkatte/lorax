import React, { useState, useRef, useEffect, useCallback } from 'react';
import EditableRange from './EditableRange';
import { useSearchParams } from 'react-router-dom';
import { faArrows } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function PositionSlider({ config, project, ucgbMode, view, valueRef }) {

  const { tsconfig, filename } = config;
  const { genome_length } = tsconfig;

  const [searchParams, setSearchParams] = useSearchParams();
  const { changeView, startPan, stopPan, viewReset, decksize, genomicValues } = view;

  // Initialize value if missing
  useEffect(() => {
    if (genomicValues) {

      // valueRef.current = tsconfig.value;
      // console.log("value is set to", genomicValues);
    }
  }, [genomicValues, tsconfig.value]);

  // Keep ref and search params in sync with React state
  useEffect(() => {
    if (valueRef.current) {
      // Preserve existing search params and only update the ones we need to change
      const updatedParams = new URLSearchParams(searchParams);

      if (ucgbMode.current) {
        updatedParams.set('chrom', tsconfig.chrom);
        updatedParams.set('genomiccoordstart', valueRef.current[0]);
        updatedParams.set('genomiccoordend', valueRef.current[1]);
      } else {
        updatedParams.set('project', project);
        updatedParams.set('genomiccoordstart', valueRef.current[0]);
        updatedParams.set('genomiccoordend', valueRef.current[1]);
      }

      setSearchParams(updatedParams);
    }
  }, [valueRef.current, tsconfig.chrom, project, ucgbMode, setSearchParams, searchParams]);


  return (
    <div
      style={{
        width: '100%',
        border: '1px',
        borderColor: 'black',
        display: 'flex',
        justifyContent: 'center',
        position: 'relative'
      }}
    >
      {/* Professional Lorax logo in top left corner, clickable, links to home */}
      <a
        href="/"
        style={{
          position: 'absolute',
          left: '1.5rem',
          top: '0.4rem',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.2rem 0.8rem 0.2rem 0.5rem',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '0.6rem',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
          textDecoration: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid #e2e8f0',
        }}
        className="hover:shadow-lg hover:border-emerald-200 hover:-translate-y-0.5"
        title="Go to Lorax Home"
      >
        <img
          src="/logo.png"
          alt="Lorax Logo"
          style={{
            height: '1.8rem',
            width: 'auto',
            display: 'block'
          }}
        />
        <span
          style={{
            fontWeight: 800,
            color: '#0f172a',
            fontSize: '1.1rem',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          Lorax
        </span>
      </a>
      <div className="flex justify-center items-center gap-2" >
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
      // aria-label="Pan left"
      >
        ←
      </button>
      {valueRef.current && (
        <EditableRange valueRef={valueRef} onChange={changeView} genomeLength={genome_length} />
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
      // aria-label="Pan right"
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
        aria-label="Reset view"
      >
        <FontAwesomeIcon icon={faArrows} style={{ color: 'black' }} />
      </button>
    </div>
  );
}
