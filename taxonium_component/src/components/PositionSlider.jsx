import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TextField, Slider, Box } from '@mui/material';
import { Rnd } from 'react-rnd';
import EditableRange from './EditableRange';
export default function PositionSlider(props) {
  
    const POS_SHIFT = 1000
  
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const sliderRef = useRef(null)
    const containerWidth = useRef(null);
    const sliderWidth = useRef(null)
    const [resizing, isResizing] = useState(false)
  
    const [genomePosition, setGenomePosition] = useState({'start':0, 'end': 1000000})
    const [genomeLength, setGenomeLength] = useState([])

    const tree_index = useRef(null);



    const { config, genome_position, value, setValue } = props
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
      console.log("tree index", tree_index.current)
      if (intervals) {
        var left_index = tree_index.current[0]
      if (left_index === 0 ){
        console.log("ERROR: cannot move more left" )
        alert(`ERROR: cannot move more left`)
      }
      let new_left_index = Math.max(0, Math.floor(left_index - (tree_length / 2)));

      tree_index.current = [new_left_index, parseInt(new_left_index+(tree_length))]
      getIntervals(new_left_index, parseInt(new_left_index+(tree_length)))
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


      // setValue(input_values)
    }
  
    // const handleResizeStop = (e, direction, ref, delta, position) => {
    //   if(direction=='left'){
    //     setPosition(prev => ({ ...prev, x: prev.x - delta.width}))
    //   }
    //   sliderWidth.current = ref.style.width
    //   isResizing(true)
    // };
  
    // const posToPixel = (pos) => {
    //     const ratio = (pos - genome_position.min) / (genome_position.max - genome_position.min);
    //     return ratio * (containerWidth.current - sliderWidth.current);
    // }

    // // console.log("posToPixel", posToPixel(value[0]), posToPixel(value[1]))

    // const pixelToPos = (pixel) => {
    //   const ratio = pixel / containerWidth.current;
    //   return Math.round(genome_position.min + (ratio * (genome_position.max - genome_position.min)));
    // };
    // const calculate_start_end = () => {
    //   let start_position_value = pixelToPos(position.x)
    //   let end_position_value = pixelToPos(position.x+sliderWidth.current)
    //   return [start_position_value, end_position_value]
    // }
  
    // const onDrag = (e,d) => {
    //     setPosition({x: d.x, y:d.y});
    // }
    // useEffect(() => {
    //     const [start, end] = calculate_start_end();
    //     setGenomePosition({'start': start, 'end': end})
    //     setValue([start,end])
    //     isResizing(false)
    // }, [position, resizing])


  
    return (
      <>
        <div style={{  
          width: '50%',
          height: '10%', // Match the background height
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
        <EditableRange value={value} onChange={onChange}/>
        {/* <div ref={containerRef} style={{
          // position: 'fixed',
          width: '70%',
          height: '100%',
          display: "flex",
          // position:'relative',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          alignContent: 'center',
        }}>      
        <Rnd
            // style={style}
            ref={sliderRef}
            position={position}
            default={{
              x: 0,
              y: 0,
            }}
            onDragStop={onDrag}
            onResizeStop={handleResizeStop}
            maxWidth='100%'
            enableResizing={{
              top: false,
              right: true,
              bottom: false,
              left: true,
              topRight: false,
              bottomRight: false,
              bottomLeft: false,
              topLeft: false
            }}
            dragAxis="x"
            bounds="parent"
            style={{
              zIndex: 2, // Ensure it's above the background
              overflow: 'hidden',
              position: 'relative',
  
            }}
            >
              <TextField
                variant="outlined"
                size="small"
                value={`${value[0].toLocaleString()} ... ${value[1].toLocaleString()}`}
                // value={`${genomePosition.start}..${genomePosition.end}`}
                sx={{
                  width: '2%',
                  height: '100%',
                  backgroundColor: 'white',
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    borderRadius: '4px',
                    textAlign: 'center', // Center the text
                    '& input': {
                      textAlign: 'center', // Center the input text specifically
                      // padding: '0px 0', // Adjust vertical padding
                    }
                  }
                }}
              />
            </Rnd> */}

        {/* </div> */}
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