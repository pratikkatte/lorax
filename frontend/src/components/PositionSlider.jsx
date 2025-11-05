import React, { useState, useRef, useEffect, useCallback } from 'react';
import EditableRange from './EditableRange';
import { useSearchParams } from 'react-router-dom';
import { faArrows } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function PositionSlider({ config, project, ucgbMode, view, valueRef }) {
  
  const { tsconfig, filename } = config;
  const { genome_length } = tsconfig;
  
  const [searchParams, setSearchParams] = useSearchParams();
  const { changeView , startPan, stopPan, viewReset, decksize, genomicValues} = view;

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
    </div>
  );
}
