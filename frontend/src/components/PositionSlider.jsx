import React, { useState, useRef, useEffect, useCallback } from 'react';
import EditableRange from './EditableRange';
import { useSearchParams } from 'react-router-dom';

export default function PositionSlider( { config, project, ucgbMode, value, setValue}) {
    
    const [genomeLength, setGenomeLength] = useState([])

    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
      if (!value) {
        setValue(config.value)
      }
    }, [value])

    useEffect(() => {
      if (value) {
        if (ucgbMode.current) {
          setSearchParams({chrom: config.chrom, genomiccoordstart: value[0], genomiccoordend: value[1]});
        }
        else {  
          setSearchParams({project: project, genomiccoordstart: value[0], genomiccoordend: value[1]});
        }
      }
    }, [value]) 

    const { intervals } = config
    const tree_length = 10;
    
    const getIntervals = useCallback((start, end ) => {

      if (intervals) {
        var value1 = intervals[start][0]
        var value2 = intervals[end][1]
        setValue([value1, value2])
      }
    }, [intervals])

    useEffect(() => {
      if (intervals && intervals.length > 0) {
        setGenomeLength([intervals[0][0], intervals[intervals.length-1][0]])

          getIntervals(0, tree_length)
      }
    }, [intervals])

    const moveLeft = () => {

      setValue(prev => {
        const new_left_genome_length = prev[0]-100
        if (new_left_genome_length >= genomeLength[0]) {
          return [new_left_genome_length, prev[1]]
        }
        else {
          alert(`ERROR: cannot move more left`)
          return prev
        }
      })
    };

     const moveRight = () => {
  
      setValue(prev => {
        const new_right_genome_length = prev[1]+100
        if (new_right_genome_length <= genomeLength[1]) {
          return [prev[0], new_right_genome_length]
        }
        else {
          alert(`ERROR: cannot move more right`)
          return prev
        }
      })
    };

    const onChange = (input_values) => {
      if (intervals) {
        setValue(prev => {
          var value1 = input_values[0]
          var value2 = input_values[1]
          if (value1 !== prev[0]) {
            return [value1, prev[1]]
          } else {
            return [prev[0], value2]
          }
        })
    }
    }

    return (
      <>
        <div style={{  
          width: '60%',
          border: '1px',
          borderColor: 'black',
          display: 'flex',
          justifyContent: 'center'
        }}>
      <button 
        onClick={moveLeft}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: 'black'
        }}
      >
        ←
      </button>
      {value && (
        <EditableRange value={value} onChange={onChange}/>
      )}

        <button 
        onClick={moveRight}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: 'black'
        }}
      >
        →
      </button>
  
      </div>
      </>
    )  
}