import React, { useState, useRef, useEffect, useCallback } from 'react';
import EditableRange from './EditableRange';
import { useSearchParams } from 'react-router-dom';

export default function PositionSlider({ config, project, ucgbMode, view, valueRef }) {
  
  const { tsconfig, intervals } = config;
  
  const [genomeLength, setGenomeLength] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const { moveLeftView, moveRightView, changeView } = view;

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
  }, [valueRef, tsconfig.chrom, project, ucgbMode, setSearchParams]);


  // Track min/max genome length
  useEffect(() => {
    if (intervals && intervals.length > 0) {
      setGenomeLength([intervals[0][0], intervals[intervals.length - 1][0]]);
    }
  }, [intervals]);

  const moveLeft = () => {
    const [left, right] = valueRef.current ?? [];
    const newLeft = left - 100;
    const newRight = right - 100;
    if (newLeft >= genomeLength[0]) {
      const newVal = [newLeft, newRight];
      valueRef.current = newVal;
      // setValue(newVal);
      moveLeftView(newVal);
    } else {
      alert(`ERROR: cannot move more left`);
    }
  };

  const moveRight = () => {
    const [left, right] = valueRef.current ?? [];
    const newRight = right + 100;
    const newLeft = left + 100;
    if (newRight <= genomeLength[1]) {
      const newVal = [newLeft, newRight];
      valueRef.current = newVal;
      // setValue(newVal);
      moveRightView(newVal);
    } else {
      alert(`ERROR: cannot move more right`);
    }
  };

  const onChange = useCallback(
    (input_values) => {
      if (intervals) {
        console.log('onChange input_values', input_values);
        const newVal = [input_values[0], input_values[1]];
        valueRef.current = newVal;
        // setValue(newVal);
        changeView(newVal); // always call when user changes
      }
    },
    [intervals, changeView]
  );

  return (
    <div
      style={{
        width: '60%',
        border: '1px',
        borderColor: 'black',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <button
        onClick={moveLeft}
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
        onClick={moveRight}
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
    </div>
  );
}
