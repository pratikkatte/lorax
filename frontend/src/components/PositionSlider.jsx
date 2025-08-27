import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TextField, Slider, Box } from '@mui/material';
import { Rnd } from 'react-rnd';
import EditableRange from './EditableRange';
import { useSearchParams } from 'react-router-dom';

export default function PositionSlider(props) {
  
    const containerRef = useRef(null);
    const [value, setValue] = useState(null);
    const sliderRef = useRef(null)
    const containerWidth = useRef(null);
    const sliderWidth = useRef(null)
  
    const [genomeLength, setGenomeLength] = useState([])

    const tree_index = useRef(null);

    const { config, setConfig, project} = props
    
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
      if (value) {
        // console.log("searchParams", searchParams.get("project"), searchParams.get("start"), searchParams.get("end"))
        setConfig({...config, value: [value[0], value[1]]})
        console.log("value", value)
      } else {
        setValue(config.value)
      }
    }, [value])

    useEffect(() => {
      if (value) {
      setSearchParams({project: project, start: value[0], end: value[1]});
      }
    }, [value]) 

    const { intervals } = config
    const tree_length = 10;
    
    function findFloorStartIndex(intervals, value, position) {
      let low = 0;
      let high = intervals.length - 1;
      let result = -1;
    
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const startVal = intervals[mid][position];
    
        if (startVal === value) {
          return mid; // exact match
        } else if (startVal < value) {
          if (position === 0) {result = mid;}    // potential floor, move right to look for a closer one
          low = mid + 1; 
        } else {
          if (position === 1) {result = mid;}
          high = mid - 1;
        }
      }
      return result; // returns -1 if all starts are greater than value
    }

    const getIntervals = useCallback((start, end ) => {

      if (intervals) {
        var value1 = intervals[start][0]
        var value2 = intervals[end][1]
        setValue([value1, value2])
      }
    }, [intervals])

    useEffect(() => {
      if (intervals && intervals.length > 0){
        setGenomeLength([intervals[0][0], intervals[intervals.length-1][0]])
          tree_index.current = [0, tree_length]

          getIntervals(0, tree_length)
      }
    }, [intervals])

    useEffect(() => {
      if(containerRef.current){
        containerWidth.current = containerRef.current.getBoundingClientRect().width
      }
      if (sliderRef.current) {
        sliderWidth.current = sliderRef.current.resizableElement.current.offsetWidth
      }
    })

    const moveLeft = () => {
      console.log("tree index", tree_index.current, intervals)
      if (intervals) {
        var left_index = tree_index.current[0]
      if (left_index === 0 ){
        console.log("ERROR: cannot move more left" )
        alert(`ERROR: cannot move more left`)
      }else{
        let new_left_index = Math.max(0, Math.floor(left_index - (tree_length / 2)));

      tree_index.current = [new_left_index, parseInt(new_left_index+(tree_length))]
      getIntervals(new_left_index, parseInt(new_left_index+(tree_length)))
      }
      
      }
      // setPosition(prev => ({ ...prev, x: prev.x - POS_SHIFT }));
    };

     const moveRight = () => {
      console.log("tree index", tree_index.current)
      if (intervals) {

        var right_index = tree_index.current[1]

      if (right_index >= intervals.length ){
        console.log("ERROR: cannot move more right" )
        alert(`ERROR: cannot move more right`)
      }
      else {
        let new_right_index = Math.min(intervals.length, Math.floor(right_index + (tree_length/2)));
        console.log("new right index", new_right_index, intervals.length, right_index)
        tree_index.current = [parseInt(new_right_index-(tree_length)), new_right_index]
        getIntervals(parseInt(new_right_index-(tree_length)), new_right_index)
      }
      }
    };

    const onChange = (input_values) => {
      if (intervals){
        setValue(prev => {
          console.log("prev", prev, input_values)
          var value1 = input_values[0]
          var value2 = input_values[1]
          if (value1 !== prev[0]) {
            var res = Math.max(0, findFloorStartIndex(intervals, value1,0))
            console.log("result left", res, [intervals[res][0],intervals[Math.min(intervals.length-1,res+tree_length)][1]])
            tree_index.current = [res, res+tree_length]
            return [intervals[res][0],intervals[Math.min(intervals.length-1,res+tree_length)][1]]
          } else{
            let res = findFloorStartIndex(intervals, value2, 1);
            res = res === -1 ? 0 : Math.min(intervals.length - 1, res);
            tree_index.current = [res-tree_length, res]
            console.log("result right", res, intervals[res])
            console.log("tree index", tree_index.current)

            return [intervals[Math.max(0, res-tree_length)][0],intervals[res][1]]
          }
      });
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
        ↓
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
        ↑
      </button>
  
      </div>
      </>
    )  
}